const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const { Sequelize } = require('sequelize');

// Opcional: servidor PostgreSQL de pruebas LOCAL. Nunca utiliza DATABASE_URL ni .env.
const url = process.env.PAYPAL_TEST_DATABASE_URL;
test('PostgreSQL real: propietarios, concurrencia, rollback después del cobro y webhook recuperable', { skip: !url }, async () => {
  assert.equal(new URL(url).hostname, '127.0.0.1');
  const schema = `paypal_test_${randomUUID().replaceAll('-', '')}`;
  const sequelize = new Sequelize(url, { logging: false, define: { schema }, pool: { max: 8 } });
  const load = (file, dependencies) => {
    const context = { module: { exports: {} }, console: { error() {} }, require: (id) => dependencies[id] || require(id) };
    vm.runInNewContext(readFileSync(path.join(__dirname, '../src', file), 'utf8'), context);
    return context.module.exports;
  };
  const models = { sequelize };
  for (const name of ['Pedido', 'Pago', 'Comprobante', 'Entrega']) {
    models[name] = load(`models/${name.toLowerCase()}.model.js`, { '../config/database': { sequelize } });
  }
  models.Pago.belongsTo(models.Pedido, { foreignKey: 'pedido_id' });
  models.Comprobante.belongsTo(models.Pago, { foreignKey: 'pago_id' });
  models.Entrega.belongsTo(models.Pedido, { foreignKey: 'pedido_id' });
  const owner = randomUUID();
  let captures = 0;
  const orders = new Map();
  const paypal = {
    async obtenerOrden(id) { return structuredClone(orders.get(id)); },
    async capturarOrden(id) {
      captures++;
      const order = orders.get(id); order.status = 'COMPLETED';
      order.purchase_units[0].payments = { captures: [{ id: `CAP${id}`, status: 'COMPLETED', amount: { value: '650.00', currency_code: 'MXN' } }] };
      return structuredClone(order);
    },
    async verificarWebhook() { return true; },
  };
  const controller = load('controllers/paypal.controller.js', { '../models': models, '../services/paypal.service': paypal });
  const call = async (action, id, user = owner) => {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await controller[action]({ user: { id: user }, headers: {}, params: { paypalOrderId: id }, body: action === 'webhook'
      ? { event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { supplementary_data: { related_ids: { order_id: id } } } }
      : { paypalOrderId: id } }, res);
    return res;
  };
  const prepare = async (id) => {
    const pedido = await models.Pedido.create({ usuario_id: owner, subtotal: '650.00', total: '650.00' });
    await models.Pago.create({ pedido_id: pedido.id, metodo: 'paypal', referencia_externa: id, monto: '650.00', paypal_request_id: randomUUID() });
    orders.set(id, { id, status: 'APPROVED', intent: 'CAPTURE', purchase_units: [{ reference_id: String(pedido.id), amount: { value: '650.00', currency_code: 'MXN' } }] });
    return pedido;
  };
  try {
    await sequelize.createSchema(schema);
    await sequelize.sync();
    await prepare('ORDER1');
    assert.equal((await call('capturarOrden', 'ORDER1', randomUUID())).code, 404);
    assert.equal((await call('obtenerOrden', 'ORDER1', randomUUID())).code, 404);
    assert.equal(captures, 0);
    const results = await Promise.all(['capturarOrden', 'capturarOrden', 'webhook', 'webhook'].map(action => call(action, 'ORDER1')));
    assert.ok(results.every(result => result.code === 200));
    assert.equal(captures, 1);
    for (const name of ['Pedido', 'Pago', 'Comprobante', 'Entrega']) assert.equal(await models[name].count(), 1);
    const second = await prepare('ORDER2');
    models.Entrega.addHook('beforeCreate', 'fail-test', () => { throw new Error('Fallo después del cobro'); });
    assert.equal((await call('capturarOrden', 'ORDER2')).code, 503);
    assert.equal(captures, 2);
    assert.equal((await models.Pedido.findByPk(second.id)).estado, 'pendiente_pago');
    assert.equal((await models.Pago.findOne({ where: { pedido_id: second.id } })).estado, 'pendiente');
    assert.equal(await models.Comprobante.count(), 1);
    assert.equal((await call('webhook', 'ORDER2')).code, 503);
    models.Entrega.removeHook('beforeCreate', 'fail-test');
    assert.equal((await call('webhook', 'ORDER2')).code, 200);
    assert.equal((await call('obtenerOrden', 'ORDER2')).body.confirmed, true);
    assert.equal(captures, 2);
    for (const name of ['Pedido', 'Pago', 'Comprobante', 'Entrega']) assert.equal(await models[name].count(), 2);
    await assert.rejects(models.Entrega.create({ pedido_id: second.id }), /Validation error/);
  } finally {
    await sequelize.dropSchema(schema, { cascade: true });
    await sequelize.close();
  }
});
