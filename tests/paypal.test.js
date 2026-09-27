const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const load = (file, dependencies, extra = {}) => {
  const context = { module: { exports: {} }, require: (id) => {
    if (id in dependencies) return dependencies[id];
    return require(id);
  }, console: { error() {} }, ...extra };
  vm.runInNewContext(readFileSync(path.join(__dirname, '../src', file), 'utf8'), context);
  return context.module.exports;
};
const copy = (value) => JSON.parse(JSON.stringify(value));
const owner = '11111111-1111-4111-8111-111111111111';

function setup() {
  let state = {
    Pedido: [{ id: '7', usuario_id: owner, total: '650.00', estado: 'pendiente_pago' }],
    Pago: [{ id: '9', pedido_id: '7', metodo: 'paypal', estado: 'pendiente', monto: '650.00',
      referencia_externa: 'ORDER1', paypal_request_id: '11111111-1111-4111-8111-111111111111', created_at: new Date().toISOString() }],
    Comprobante: [], Entrega: [],
  };
  let tail = Promise.resolve();
  const controls = { fail: '', captures: 0, reads: 0, creates: 0, valid: true, timeout: false, order: {
    id: 'ORDER1', intent: 'CAPTURE', status: 'APPROVED', purchase_units: [{ reference_id: '7', custom_id: '7',
      amount: { currency_code: 'MXN', value: '650.00' } }],
  } };
  const matches = (row, where) => Object.entries(where).every(([key, value]) => String(row[key]) === String(value));
  const failure = (key) => { if (controls.fail === key) { controls.fail = ''; throw new Error(`Falló ${key}`); } };
  const models = { sequelize: { transaction(fn) {
    const execute = async () => {
      const snapshot = copy(state);
      const transaction = { LOCK: { UPDATE: 'UPDATE' } };
      try { const result = await fn(transaction); failure('commit'); return result; }
      catch (error) { state = snapshot; throw error; }
    };
    const result = tail.then(execute);
    tail = result.catch(() => {});
    return result;
  } } };
  for (const table of ['Pedido', 'Pago', 'Comprobante', 'Entrega']) {
    const wrap = (row) => row && { ...row, async update(values, options) {
      assert.ok(options.transaction);
      failure(`${table}.update`);
      Object.assign(row, copy(values)); Object.assign(this, copy(values)); return this;
    } };
    models[table] = {
      async findOne(options) {
        if (table === 'Pedido') { assert.ok(options.transaction); assert.equal(options.lock, 'UPDATE'); }
        return wrap(state[table].find((row) => matches(row, options.where)));
      },
      async create(values, options) {
        assert.ok(options.transaction); failure(`${table}.create`);
        const row = { id: '9', created_at: new Date().toISOString(), ...copy(values) };
        state[table].push(row); return wrap(row);
      },
      async findOrCreate(options) {
        assert.ok(options.transaction); failure(`${table}.create`);
        let row = state[table].find((row) => matches(row, options.where));
        if (!row) { row = { id: '1', ...copy(options.defaults), ...copy(options.where) }; state[table].push(row); }
        return [wrap(row)];
      },
      async update(values, options) {
        assert.ok(options.transaction); failure(`${table}.update`);
        for (const row of state[table].filter((row) => matches(row, options.where))) Object.assign(row, copy(values));
      },
    };
  }
  const paypal = {
    async obtenerOrden() { controls.reads++; return copy(controls.order); },
    async crearOrden({ requestId, monto, pedidoId }) {
      assert.ok(requestId); assert.equal(monto, '650.00'); assert.equal(String(pedidoId), '7');
      controls.creates++; return copy(controls.order);
    },
    async capturarOrden(id, key) {
      assert.equal(id, 'ORDER1'); assert.equal(key, 'capture-ORDER1');
      controls.captures++; controls.order.status = 'COMPLETED';
      controls.order.purchase_units[0].payments = { captures: [{ id: 'CAPTURE1', status: 'COMPLETED',
        amount: { currency_code: 'MXN', value: '650.00' } }] };
      if (controls.timeout) throw new Error('Respuesta perdida después del cobro');
      return copy(controls.order);
    },
    async verificarWebhook() { failure('signature'); return controls.valid; },
  };
  const controller = load('controllers/paypal.controller.js', { '../models': models, '../services/paypal.service': paypal });
  return { controls, get state() { return state; }, async call(action, user = owner, body) {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = copy(body); return this; } };
    const event = { event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { supplementary_data: { related_ids: { order_id: 'ORDER1' } } } };
    await controller[action]({ user: { id: user }, params: { paypalOrderId: 'ORDER1' }, headers: {},
      body: body || (action === 'webhook' ? event : { pedidoId: '7', paypalOrderId: 'ORDER1' }) }, res);
    return res;
  } };
}

test('propietario paga: commit de pago, pedido, comprobante y entrega antes de confirmar', async () => {
  const app = setup();
  const result = await app.call('capturarOrden');
  assert.equal(result.code, 200); assert.equal(result.body.confirmed, true);
  assert.equal(result.body.captureId, 'CAPTURE1');
  assert.equal(app.state.Pago[0].paypal_capture_id, 'CAPTURE1');
  assert.equal(app.state.Pedido[0].estado, 'pagado');
  assert.equal(app.state.Comprobante[0].archivo_url, 'paypal:CAPTURE1');
  assert.equal(app.state.Entrega[0].estado, 'pendiente');
});

for (const action of ['crearOrden', 'obtenerOrden', 'capturarOrden']) {
  test(`${action}: usuario ajeno recibe 404 sin llamar PayPal ni modificar datos`, async () => {
    const app = setup(); const before = copy(app.state);
    assert.equal((await app.call(action, 'otro-usuario')).code, 404);
    assert.equal(app.controls.reads + app.controls.captures + app.controls.creates, 0);
    assert.deepEqual(app.state, before);
  });
}

test('captura y webhook repetidos y concurrentes no duplican operaciones', async () => {
  const app = setup();
  const results = await Promise.all(['capturarOrden', 'capturarOrden', 'webhook', 'webhook', 'obtenerOrden'].map((action) => app.call(action)));
  assert.ok(results.every((result) => result.code === 200));
  assert.equal(app.controls.captures, 1);
  for (const table of ['Pedido', 'Pago', 'Comprobante', 'Entrega']) assert.equal(app.state[table].length, 1);
});

for (const failure of ['Pago.update', 'Pedido.update', 'Comprobante.create', 'Entrega.create', 'commit']) {
  test(`fallo ${failure} después del cobro: rollback local y reconciliación sin otro cobro`, async () => {
    const app = setup(); const before = copy(app.state); app.controls.fail = failure;
    assert.equal((await app.call('capturarOrden')).code, 503);
    assert.equal(app.controls.captures, 1); assert.deepEqual(app.state, before);
    assert.equal((await app.call('obtenerOrden')).body.confirmed, true);
    assert.equal(app.controls.captures, 1);
    assert.equal(app.state.Comprobante.length, 1); assert.equal(app.state.Entrega.length, 1);
  });
}

test('timeout remoto después del cobro se recupera consultando la misma orden', async () => {
  const app = setup(); app.controls.timeout = true;
  assert.equal((await app.call('capturarOrden')).body.confirmed, true);
  assert.equal(app.controls.captures, 1);
});

test('webhook primero, fallo parcial y reentrega: 503 hasta registrar todas las escrituras', async () => {
  const app = setup();
  app.controls.fail = 'commit'; await app.call('capturarOrden');
  app.controls.fail = 'Entrega.create';
  assert.equal((await app.call('webhook')).code, 503);
  assert.equal(app.state.Pago[0].estado, 'pendiente');
  assert.equal((await app.call('webhook')).code, 200);
  assert.equal((await app.call('webhook')).code, 200);
  assert.equal(app.state.Entrega.length, 1); assert.equal(app.state.Comprobante.length, 1);
});

test('webhook con firma inválida no procesa; fallo de verificación o referencia desconocida pide reintento', async () => {
  const app = setup(); app.controls.valid = false;
  assert.equal((await app.call('webhook')).code, 400); assert.equal(app.controls.reads, 0);
  app.controls.valid = true; app.controls.fail = 'signature';
  assert.equal((await app.call('webhook')).code, 503);
  assert.equal((await app.call('webhook', owner, { event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: {} })).code, 503);
});

test('webhook completado aún no visible en PayPal pide reintento', async () => {
  const app = setup();
  assert.equal((await app.call('webhook')).code, 503);
  assert.equal(app.state.Entrega.length, 0);
});

test('webhook de reembolso resuelve la captura desde su enlace sin seguir URLs externas', async () => {
  const app = setup(); await app.call('capturarOrden');
  app.controls.order.purchase_units[0].payments.captures[0].status = 'REFUNDED';
  const event = { event_type: 'PAYMENT.CAPTURE.REFUNDED', resource_type: 'refund', resource: {
    links: [{ rel: 'up', href: 'https://api.sandbox.paypal.com/v2/payments/captures/CAPTURE1' }],
  } };
  assert.equal((await app.call('webhook', owner, event)).code, 200);
  assert.equal(app.state.Pago[0].estado, 'reembolsado');
});

test('importe, moneda y referencia incorrectos nunca se capturan', async () => {
  for (const change of [unit => { unit.amount.value = '0.01'; }, unit => { unit.amount.currency_code = 'USD'; },
    unit => { unit.reference_id = 'otro'; }, unit => { unit.custom_id = 'otro'; }]) {
    const app = setup(); change(app.controls.order.purchase_units[0]);
    assert.equal((await app.call('capturarOrden')).code, 409); assert.equal(app.controls.captures, 0);
  }
});

test('aprobación y captura pendiente no confirman ni generan entrega', async () => {
  const app = setup();
  assert.equal((await app.call('obtenerOrden')).body.confirmed, false);
  app.controls.order.status = 'COMPLETED';
  app.controls.order.purchase_units[0].payments = { captures: [{ id: 'CAPTURE1', status: 'PENDING', amount: { value: '650.00', currency_code: 'MXN' } }] };
  assert.equal((await app.call('capturarOrden')).code, 202);
  assert.equal(app.state.Pedido[0].estado, 'pendiente_pago'); assert.equal(app.state.Entrega.length, 0);
});

test('reembolso repetido retiene entrega pendiente y evento antiguo no revive el pago', async () => {
  const app = setup(); await app.call('capturarOrden');
  app.controls.order.purchase_units[0].payments.captures[0].status = 'REFUNDED';
  await app.call('webhook'); await app.call('webhook');
  assert.equal(app.state.Pago[0].estado, 'reembolsado'); assert.equal(app.state.Entrega[0].estado, 'retenida');
  app.controls.order.purchase_units[0].payments.captures[0].status = 'COMPLETED';
  assert.equal((await app.call('obtenerOrden')).body.confirmed, false);
  assert.equal(app.state.Pago[0].estado, 'reembolsado');
});

test('crear orden reutiliza referencia; fallo al asociarla conserva la clave durable', async () => {
  const app = setup(); app.state.Pago.length = 0;
  app.controls.fail = 'Pago.update';
  assert.equal((await app.call('crearOrden')).code, 503);
  const key = app.state.Pago[0].paypal_request_id; assert.ok(key);
  assert.equal((await app.call('crearOrden')).body.id, 'ORDER1');
  assert.equal((await app.call('crearOrden')).body.id, 'ORDER1');
  assert.equal(app.state.Pago.length, 1); assert.equal(app.state.Pago[0].paypal_request_id, key);
  assert.equal(app.controls.creates, 2);
});

test('una creación ambigua vencida no crea otra orden', async () => {
  const app = setup(); app.state.Pago[0].referencia_externa = null;
  app.state.Pago[0].created_at = '2000-01-01';
  assert.equal((await app.call('crearOrden')).code, 409); assert.equal(app.controls.creates, 0);
});

test('middleware JWT rechaza tokens inválidos, sin usuario y secreto faltante', () => {
  const jwt = require('jsonwebtoken');
  const secret = 'sandbox-test-secret';
  for (const [token, configured, expected] of [
    ['invalid', secret, 401], [jwt.sign({}, secret), secret, 401],
    [jwt.sign({ user: { id: owner } }, secret), undefined, 503],
    [jwt.sign({ user: { id: owner } }, secret), secret, 200],
  ]) {
    const middleware = load('middlewares/auth.js', { '../config/auth.config': { secret: configured } });
    const req = { header: () => `Bearer ${token}` };
    const res = { code: 200, status(code) { this.code = code; return this; }, json() {} };
    let next = false; middleware(req, res, () => { next = true; });
    assert.equal(res.code, expected); assert.equal(next, expected === 200);
  }
});

test('servicio usa únicamente Sandbox, claves idempotentes y validación de firma', async () => {
  const config = load('config/paypal.js', { dotenv: { config() {} } }, { process: { env: {
    PAYPAL_ENV: 'production', PAYPAL_BASE_URL: 'https://api-m.paypal.com',
    PAYPAL_CLIENT_ID: 'sandbox-client', PAYPAL_CLIENT_SECRET: 'sandbox-secret', PAYPAL_WEBHOOK_ID: 'WH1',
  } } }).PAYPAL_CONFIG;
  const calls = [];
  const service = load('services/paypal.service.js', { '../config/paypal': { PAYPAL_CONFIG: config } }, {
    Buffer, AbortSignal, fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => url.endsWith('/token') ? { access_token: 'test' } : { verification_status: 'SUCCESS' } };
    },
  });
  await service.crearOrden({ monto: '650.00', pedidoId: '7', requestId: 'CREATE1' });
  await service.capturarOrden('ORDER1', 'CAPTURE1');
  assert.ok(calls.every(({ url }) => url.startsWith('https://api-m.sandbox.paypal.com/')));
  assert.equal(calls[1].options.headers['PayPal-Request-Id'], 'CREATE1');
  assert.equal(calls[3].options.headers['PayPal-Request-Id'], 'CAPTURE1');
  assert.equal(await service.verificarWebhook({ headers: {}, body: {} }), false);
  const headers = Object.fromEntries(['auth-algo', 'cert-url', 'transmission-id', 'transmission-sig', 'transmission-time'].map(key => [`paypal-${key}`, 'test']));
  assert.equal(await service.verificarWebhook({ headers, body: { id: 'EVENT1' } }), true);
  assert.equal(JSON.parse(calls.at(-1).options.body).webhook_id, 'WH1');
});
