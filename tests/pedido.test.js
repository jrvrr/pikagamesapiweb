const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

// Dobles de persistencia: no se carga app.js ni se conecta una base de datos.
const source = readFileSync(path.join(__dirname, '../src/controllers/pedido.controller.js'), 'utf8');
const copy = (value) => JSON.parse(JSON.stringify(value));
const producto = (overrides = {}) => ({
  id: '1', precio: '650.00', stock: 10, activo: true, tipo_cuenta: 'principal',
  Videojuego: { titulo: 'Juego del servidor', activo: true }, ...overrides,
});
const solicitud = () => ({ productos: [{ producto_id: '1', cantidad: 2 }] });

function setup(catalogo = [producto()], fallo) {
  const state = { pedidos: [], detalles: [], commits: 0, rollbacks: 0, logs: [] };
  let current;
  const checkTransaction = (options) => assert.equal(options.transaction, current);
  const models = {
    Videojuego: { async findOrCreate(options) { checkTransaction(options); state.juego = copy(options); return [{ id: '10' }, true]; } },
    sequelize: {
      async transaction(callback) {
        current = { pedidos: [], detalles: [] };
        try {
          const result = await callback(current);
          if (fallo === 'commit') throw new Error('detalle interno del commit');
          state.pedidos.push(...current.pedidos);
          state.detalles.push(...current.detalles);
          state.commits++;
          return result;
        } catch (error) {
          state.rollbacks++;
          throw error;
        } finally {
          current = undefined;
        }
      },
    },
    ProductoVideojuego: {
      async findOrCreate(options) {
        checkTransaction(options); state.producto = copy(options);
        catalogo.push(producto({ id: '5', stock: 0, tipo_cuenta: options.where.tipo_cuenta }));
        return [{ id: '5' }, true];
      },
      async findAll(options) {
        checkTransaction(options);
        assert.equal(options.include[0].model, models.Videojuego);
        assert.equal(options.include[0].required, true);
        if (fallo === 'consulta') throw new Error('detalle interno de consulta');
        state.ids = copy(options.where.id);
        return catalogo.filter((p) => options.where.id.includes(String(p.id)) && p.Videojuego);
      },
    },
    Pedido: {
      async create(values, options) {
        checkTransaction(options);
        if (fallo === 'pedido') throw new Error('detalle interno de pedido');
        const row = { id: '77', ...copy(values) };
        current.pedidos.push(row);
        return row;
      },
    },
    PedidoDetalle: {
      async bulkCreate(values, options) {
        checkTransaction(options);
        assert.equal(options.validate, true);
        current.detalles.push(copy(values[0]));
        if (fallo === 'detalles') throw new Error('detalle interno de inserción');
        current.detalles.push(...copy(values.slice(1)));
      },
    },
  };
  const context = {
    module: { exports: {} },
    require: (id) => { assert.equal(id, '../models'); return models; },
    console: { error: (...args) => state.logs.push(args) },
  };
  vm.runInNewContext(source, context, { filename: 'pedido.controller.js' });
  return {
    state,
    async crear(body) {
      const res = {
        code: 200,
        status(code) { this.code = code; return this; },
        json(value) { this.body = copy(value); return this; },
      };
      await context.module.exports.crearPedido({ body, user: { id: 'usuario-autenticado' } }, res);
      return res;
    },
  };
}

test('manipular importes no cambia pedido ni detalles calculados en servidor', async () => {
  const baseline = setup();
  const normal = await baseline.crear(solicitud());
  for (const importe of ['0.01', -100, 999999999, null]) {
    const { crear, state } = setup();
    const body = solicitud();
    Object.assign(body, {
      subtotal: importe, total: importe, descuento: 999999,
      usuario_id: 'otro-usuario', estado: 'pagado',
      detalles: [{ total_linea: importe }],
    });
    Object.assign(body.productos[0], {
      precio: importe, precio_unitario: importe, total_linea: importe,
      descuento_unitario: 999999, titulo_snapshot: 'Título falso', tipo_cuenta_snapshot: 'falso',
    });
    const res = await crear(body);
    assert.equal(res.code, 201);
    assert.deepEqual(res.body, normal.body);
    assert.equal(res.body.total, '1300.00');
    assert.equal(res.body.usuario_id, 'usuario-autenticado');
    assert.equal(res.body.estado, 'pendiente_pago');
    assert.deepEqual(state.detalles, [{
      pedido_id: '77', producto_id: '1', titulo_snapshot: 'Juego del servidor',
      tipo_cuenta_snapshot: 'principal', precio_unitario: '650.00',
      descuento_unitario: '0.00', cantidad: 2, total_linea: '1300.00',
    }]);
    assert.equal(state.commits, 1);
  }
});

test('suma varios productos en centavos y permite identificadores BIGINT como texto', async () => {
  const id = '9007199254740993';
  const { crear, state } = setup([producto({ precio: '0.10' }), producto({ id, precio: '0.29', tipo_cuenta: 'secundaria' })]);
  const res = await crear({ productos: [{ producto_id: 1, cantidad: 3 }, { producto_id: id, cantidad: 3 }] });
  assert.equal(res.code, 201);
  assert.equal(res.body.subtotal, '2730.00');
  assert.equal(res.body.total, '2730.00');
  assert.equal(res.body.descuento, '0.00');
  assert.deepEqual(state.detalles.map((d) => d.total_linea), ['1950.00', '780.00']);
});

test('rechaza lista vacía, entradas malformadas, IDs inválidos y cantidades inválidas', async () => {
  const bodies = [undefined, null, {}, [], { total: 100 }, { productos: [] }, { productos: {} },
    { productos: [null] }, { productos: [{}] }];
  for (const id of [0, -1, 1.5, true, {}, '01', '1e2', '1 OR 1=1', '9223372036854775808', Number.MAX_SAFE_INTEGER + 1]) {
    bodies.push({ productos: [{ producto_id: id, cantidad: 1 }] });
  }
  for (const cantidad of [undefined, null, 0, -1, 1.5, '2', true, NaN, Infinity, 2147483648]) {
    bodies.push({ productos: [{ producto_id: 1, cantidad }] });
  }
  for (const body of bodies) {
    const { crear, state } = setup();
    assert.equal((await crear(body)).code, 400, JSON.stringify(body));
    assert.deepEqual(state.pedidos, []);
    assert.deepEqual(state.detalles, []);
    assert.equal(state.commits, 0);
    assert.equal(state.ids, undefined);
  }
});

test('rechaza duplicados incluso mezclando ID numérico y texto', async () => {
  const { crear, state } = setup();
  const res = await crear({ productos: [{ producto_id: 1, cantidad: 1 }, { producto_id: '1', cantidad: 1 }] });
  assert.equal(res.code, 400);
  assert.match(res.body.message, /duplicados/);
  assert.equal(state.ids, undefined);
});

test('rechaza productos inexistentes, inactivos, sin juego ', async () => {
  for (const catalogo of [[], [producto({ activo: false })],
    [producto({ Videojuego: { titulo: 'Inactivo', activo: false } })],
    [producto({ Videojuego: null })]]) {
    const { crear, state } = setup(catalogo);
    assert.equal((await crear(solicitud())).code, 400);
    assert.equal(state.rollbacks, 1);
    assert.deepEqual(state.pedidos, []);
    assert.deepEqual(state.detalles, []);
  }
});

test('un producto inválido rechaza el pedido completo', async () => {
  const { crear, state } = setup();
  const res = await crear({ productos: [{ producto_id: 1, cantidad: 1 }, { producto_id: 2, cantidad: 1 }] });
  assert.equal(res.code, 400);
  assert.deepEqual(state.pedidos, []);
  assert.deepEqual(state.detalles, []);
});

test('tarifas fijas, disponibilidad ilimitada y limite monetario', async () => {
  for (const [tipo_cuenta, total] of [['principal', '1300.00'], ['secundaria', '520.00']]) {
    const { crear } = setup([producto({ tipo_cuenta, precio: '0.01', stock: 0 })]);
    assert.equal((await crear(solicitud())).body.total, total);
  }
  assert.equal((await setup().crear({ productos: [{ producto_id: 1, cantidad: 2147483647 }] })).code, 400);
});

test('crea juego y producto bajo demanda con tarifa del servidor', async () => {
  for (const [tipo_cuenta, total] of [['principal', '650.00'], ['secundaria', '260.00']]) {
    const { crear, state } = setup([]);
    const res = await crear({ juego: { rawg_id: 3328, titulo: 'The Witcher 3', tipo_cuenta, precio: '0.01' } });
    assert.equal(res.code, 201);
    assert.equal(res.body.total, total);
    assert.equal(state.producto.defaults.precio, total);
    assert.equal(state.juego.where.rawg_id, 3328);
    assert.equal(state.detalles[0].producto_id, '5');
  }
});

test('rechaza juego malformado y peticiones ambiguas', async () => {
  for (const juego of [null, {}, { rawg_id: -1 }, { rawg_id: 3328, titulo: '', tipo_cuenta: 'principal' },
    { rawg_id: 3328, titulo: 'Juego', tipo_cuenta: 'gratis' }]) {
    assert.equal((await setup([]).crear({ juego })).code, 400);
  }
  assert.equal((await setup().crear({ juego: {}, productos: [] })).code, 400);
});

test('fallos de consulta, pedido, detalles o commit no dejan escrituras parciales', async () => {
  for (const fallo of ['consulta', 'pedido', 'detalles', 'commit']) {
    const { crear, state } = setup([producto()], fallo);
    const res = await crear(solicitud());
    assert.equal(res.code, 500, fallo);
    assert.deepEqual(res.body, { message: 'Error al crear pedido' });
    assert.equal(state.rollbacks, 1);
    assert.equal(state.commits, 0);
    assert.deepEqual(state.pedidos, []);
    assert.deepEqual(state.detalles, []);
    assert.equal(state.logs.length, 1);
  }
});
