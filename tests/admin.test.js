const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const load = (dependencies) => {
  const context = {
    module: { exports: {} },
    console: { error() {} },
    require: (id) => id in dependencies ? dependencies[id] : require(id),
  };
  vm.runInNewContext(readFileSync(path.join(__dirname, '../src/controllers/pago.controller.js'), 'utf8'), context);
  return context.module.exports;
};

const response = () => ({
  code: 200,
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; },
});

test('admin lista todos los pagos y no expone modelos completos', async () => {
  let query;
  const controller = load({
    '../models': {
      Pago: { async findAll(options) { query = options; return [{ toJSON: () => ({
        id: 4, pedido_id: 9, metodo: 'transferencia', estado: 'pendiente', monto: '250.00',
        created_at: '2026-10-06T12:00:00.000Z', Pedido: { id: 9, estado: 'pendiente_pago', total: '250.00', created_at: '2026-10-06T12:00:00.000Z', Usuario: { id: 2, nombre: 'Ana', apellidos: 'López', email: 'ana@example.com' } },
      }) }]; } },
      Pedido: {}, Usuario: {}, Comprobante: {}, Entrega: {}, sequelize: {},
    },
  });
  const res = response();
  await controller.obtenerPagosAdmin({}, res);
  assert.equal(res.code, 200);
  assert.equal(query.where, undefined);
  assert.equal(res.body[0].usuario.id, '2');
  assert.equal(res.body[0].usuario.nombre, 'Ana López');
  assert.equal(res.body[0].usuario.email, 'ana@example.com');
  assert.equal(res.body[0].password_hash, undefined);
});

test('aprobar transferencia marca pedido pagado y crea entrega pendiente', async () => {
  const pedido = { id: '9', estado: 'pendiente_pago', async update(values) { Object.assign(this, values); } };
  const pago = {
    id: '4', pedido_id: '9', metodo: 'transferencia', estado: 'pendiente', monto: '250.00', fecha_pago: null, Pedido: pedido,
    async update(values) { Object.assign(this, values); },
    toJSON() { return { ...this, Pedido: this.Pedido }; },
  };
  let deliveryCreated = false;
  const controller = load({
    '../models': {
      sequelize: { transaction: async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }) },
      Pago: { async findByPk() { return pago; } },
      Pedido: {}, Usuario: {}, Comprobante: {},
      Entrega: { async findOrCreate() { deliveryCreated = true; }, async update() {} },
    },
  });
  const res = response();
  await controller.actualizarEstado({ params: { id: '4' }, body: { estado: 'aprobado' } }, res);
  assert.equal(res.code, 200);
  assert.equal(pago.estado, 'aprobado');
  assert.equal(pedido.estado, 'pagado');
  assert.equal(deliveryCreated, true);
});
