const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validation = require('../src/config/auth.validation');

const owner = '9223372036854775807';
const secret = 'phase-three-test-only';
const load = (file, dependencies, extra = {}) => {
  const context = { module: { exports: {} }, Buffer, console: { error() {} },
    require: id => id in dependencies ? dependencies[id] : require(id), ...extra };
  vm.runInNewContext(readFileSync(path.join(__dirname, '../src', file), 'utf8'), context);
  return context.module.exports;
};
const response = () => ({ code: 200, status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; } });
const registration = (overrides = {}) => ({ nombre: ' Ana ', apellidos: ' López ',
  email: ' ANA@EXAMPLE.COM ', password: 'Clave segura 123', ...overrides });

function setup() {
  const rows = [];
  const state = { reads: 0, writes: 0, fail: false, unique: false };
  const Usuario = {
    async findAll({ where, limit }) {
      state.reads++;
      if (state.fail) throw new Error('SQL privado');
      assert.equal(where.attribute.fn, 'lower');
      assert.equal(where.attribute.args[0].fn, 'btrim');
      assert.equal(where.attribute.args[0].args[0].col, 'email');
      return rows.filter(row => row.email.trim().toLowerCase() === where.logic).slice(0, limit);
    },
    async findByPk(id) {
      if (state.fail) throw new Error('SQL privado');
      return rows.find(row => row.id === id);
    },
    async create(value) {
      if (state.unique) throw Object.assign(new Error('SQL privado'), { name: 'SequelizeUniqueConstraintError' });
      state.writes++;
      const row = { id: owner, activo: true, ...value,
        async save() { state.writes++; },
        toJSON() { return { ...this }; } };
      rows.push(row);
      return row;
    },
  };
  const deps = { '../models': { Usuario }, '../config/auth.config': { secret, expiresIn: '1h' },
    '../config/auth.validation': validation };
  const controller = load('controllers/auth.controller.js', deps);
  const middleware = load('middlewares/auth.js', deps);
  return { rows, state, async call(action, body) {
    const res = response();
    await controller[action]({ body, user: { id: owner } }, res);
    return res;
  }, async authenticate(token) {
    const res = response(); const req = { header: () => `Bearer ${token}` };
    let next = false;
    await middleware(req, res, () => { next = true; });
    return { res, req, next };
  } };
}

test('registro válido normaliza correo y nombres, conserva bcrypt coste 10 y emite JWT', async () => {
  const app = setup();
  const res = await app.call('registrar', registration({ rol: 'admin', activo: false }));
  assert.equal(res.code, 201);
  assert.equal(app.rows[0].email, 'ana@example.com');
  assert.equal(app.rows[0].nombre, 'Ana');
  assert.equal(app.rows[0].rol, 'cliente');
  assert.equal(app.rows[0].activo, true);
  assert.equal(bcrypt.getRounds(app.rows[0].password_hash), 10);
  assert.ok(await bcrypt.compare(registration().password, app.rows[0].password_hash));
  assert.equal(jwt.verify(res.body.token, secret).user.id, owner);
});

test('registro inválido rechaza tipos, vacíos, límites y correo antes de consultar BD', async () => {
  const invalid = [null, [], {}, registration({ nombre: ' ' }), registration({ nombre: 7 }),
    registration({ nombre: 'n'.repeat(31) }), registration({ apellidos: [] }),
    registration({ apellidos: 'a'.repeat(31) }), registration({ email: 'no-correo' }),
    registration({ email: 'a'.repeat(40) + '@example.com' }), registration({ email: {} }),
    registration({ password: '1234567' }), registration({ password: {} }),
    registration({ password: 'a'.repeat(73) }), registration({ password: 'é'.repeat(37) })];
  const app = setup();
  for (const body of invalid) assert.equal((await app.call('registrar', body)).code, 400);
  assert.equal(app.state.reads, 0); assert.equal(app.state.writes, 0);
});

test('login válido, contraseña incorrecta, tipos inválidos y usuario inexistente', async () => {
  const app = setup();
  await app.call('registrar', registration());
  assert.equal((await app.call('login', registration())).code, 200);
  for (const body of [null, {}, registration({ password: 'incorrecta' }),
    registration({ password: [] }), registration({ email: 'otro@example.com' })]) {
    assert.equal((await app.call('login', body)).code, 400);
  }
  app.rows[0].email = ' Ana@Example.com ';
  assert.equal((await app.call('login', registration())).code, 200);
});

test('desactivación bloquea login y JWT existente; rol proviene de BD y usuario eliminado se rechaza', async () => {
  const app = setup();
  const { body: { token } } = await app.call('registrar', registration());
  assert.ok((await app.authenticate(token)).next);
  app.rows[0].rol = 'admin';
  assert.equal((await app.authenticate(token)).req.user.role, 'admin');
  app.rows[0].rol = 'cliente';
  assert.equal((await app.authenticate(jwt.sign({ user: { id: owner, role: 'admin' } }, secret))).req.user.role, 'cliente');
  app.rows[0].activo = false;
  assert.equal((await app.call('login', registration())).code, 400);
  const denied = await app.authenticate(token);
  assert.equal(denied.res.code, 401); assert.equal(denied.next, false);
  app.rows.length = 0;
  assert.equal((await app.authenticate(token)).res.code, 401);
  app.state.fail = true;
  assert.equal((await app.authenticate(token)).res.code, 503);
  assert.equal((await app.authenticate('invalid')).res.code, 401);
  for (const id of ['0', '01', '9223372036854775808', '11111111-1111-4111-8111-111111111111']) {
    assert.equal((await app.authenticate(jwt.sign({ user: { id } }, secret))).res.code, 401);
  }
});

test('cambio de contraseña exige la actual; acepta máximo ASCII y UTF-8 y permite login posterior', async () => {
  for (const newPassword of ['a'.repeat(72), 'é'.repeat(36), '🔑'.repeat(18)]) {
    const app = setup();
    await app.call('registrar', registration());
    const original = app.rows[0].password_hash;
    for (const body of [null, {}, { currentPassword: 'incorrecta', newPassword },
      { currentPassword: registration().password, newPassword: 'a'.repeat(73) },
      { currentPassword: registration().password, newPassword: '🔑'.repeat(19) }]) {
      assert.equal((await app.call('updatePassword', body)).code, 400);
      assert.equal(app.rows[0].password_hash, original);
    }
    assert.equal((await app.call('updatePassword', { currentPassword: registration().password, newPassword })).code, 200);
    assert.equal((await app.call('login', registration({ password: newPassword }))).code, 200);
    assert.equal((await app.call('login', registration())).code, 400);
    assert.equal(bcrypt.getRounds(app.rows[0].password_hash), 10);
    const other = setup();
    assert.equal((await other.call('registrar', registration({ password: newPassword }))).code, 201);
    assert.equal((await other.call('login', registration({ password: newPassword }))).code, 200);
  }
});

test('credenciales históricas siguen permitiendo login y cambio sin recortar espacios', async () => {
  for (const password of ['abc', 'a'.repeat(80), ' Clave con espacios ']) {
    const app = setup(); await app.call('registrar', registration());
    app.rows[0].password_hash = await bcrypt.hash(password, 10);
    assert.equal((await app.call('login', registration({ password }))).code, 200);
    assert.equal((await app.call('updatePassword', { currentPassword: password, newPassword: 'Nueva clave 123' })).code, 200);
  }
});

test('perfil valida campos presentes, normaliza correo y no permite cambiar rol/activo', async () => {
  const app = setup(); await app.call('registrar', registration());
  for (const body of [null, {}, { nombre: '' }, { apellidos: 2 }, { email: 'bad' }]) {
    assert.equal((await app.call('updateProfile', body)).code, 400);
  }
  const result = await app.call('updateProfile', { email: ' NUEVO@EXAMPLE.COM ', nombre: ' Eva ', rol: 'admin', activo: false });
  assert.equal(result.code, 200); assert.equal(result.body.usuario.email, 'nuevo@example.com');
  assert.equal(result.body.usuario.nombre, 'Eva'); assert.equal(result.body.usuario.rol, 'cliente');
  assert.equal(result.body.usuario.activo, true); assert.equal(result.body.usuario.password_hash, undefined);
});

test('duplicados normalizados y carreras del índice no filtran errores SQL', async () => {
  const app = setup(); await app.call('registrar', registration());
  assert.equal((await app.call('registrar', registration())).code, 400);
  app.rows.push({ ...app.rows[0], id: 'otro', email: ' ANA@example.com ' });
  assert.equal((await app.call('login', registration())).code, 400);
  assert.equal((await app.call('updateProfile', { email: ' ANA@example.com ' })).code, 400);
  const race = setup(); race.state.unique = true;
  const res = await race.call('registrar', registration());
  assert.equal(res.code, 400); assert.ok(!JSON.stringify(res.body).includes('SQL'));
});

test('comentarios aprobados: un fallo nunca consulta ni devuelve pendientes', async () => {
  let calls = 0;
  const controller = load('controllers/comentario.controller.js', { '../models': { Comentario: {
    async findAll(options) {
      calls++;
      if (options.where?.estado === 'aprobado') throw new Error('SQL privado');
      return [{ mensaje: 'PENDIENTE PRIVADO', estado: 'pendiente' }];
    },
  } } });
  const res = response(); await controller.obtenerAprobados({}, res);
  assert.equal(res.code, 503); assert.equal(calls, 1);
  assert.ok(!JSON.stringify(res.body).includes('PRIVADO'));
  assert.ok(!JSON.stringify(res.body).includes('SQL'));
});

test('comentarios validan entradas y conservan identidad autenticada sin reintento', async () => {
  const created = [];
  const controller = load('controllers/comentario.controller.js', { '../models': { Comentario: {
    async create(value) { created.push(value); throw new Error('SQL privado'); },
  } } });
  const valid = { nombre: 'Ana', mensaje: 'Buen servicio', calificacion: 5, user_id: 'suplantado', estado: 'aprobado' };
  for (const body of [null, {}, { ...valid, calificacion: '5' }, { ...valid, calificacion: 1.5 },
    { ...valid, calificacion: 6 }, { ...valid, mensaje: [] }, { ...valid, mensaje: ' ' },
    { ...valid, nombre: 'a'.repeat(256) }, { ...valid, mensaje: 'a'.repeat(5001) }]) {
    const res = response(); await controller.crearComentario({ body, user: { id: owner } }, res);
    assert.equal(res.code, 400);
  }
  assert.equal(created.length, 0);
  const res = response(); await controller.crearComentario({ body: valid, user: { id: owner } }, res);
  assert.equal(res.code, 500); assert.equal(created.length, 1);
  assert.equal(created[0].user_id, owner); assert.equal(created[0].estado, 'pendiente');
});

test('arranque de producción y desarrollo nunca sincroniza ni altera esquema', () => {
  for (const env of ['production', 'development']) {
    let ddl = 0;
    const app = { use() {}, get() {}, listen() {} };
    const express = Object.assign(() => app, { json: () => () => {} });
    load('app.js', new Proxy({ express, cors: () => () => {}, morgan: () => () => {}, dotenv: { config() {} } }, {
      has: () => true,
      get: (target, key) => key in target ? target[key] : key === './models'
        ? { sequelize: { sync() { ddl++; return Promise.resolve(); } } } : {},
    }), { process: { env: { NODE_ENV: env } } });
    assert.equal(ddl, 0);
  }
});

test('Usuario mapea la API a usuarios.email con ID BIGINT sin conectar ni cambiar esquema', () => {
  const { Sequelize } = require('sequelize');
  const sequelize = new Sequelize('postgres://test:test@localhost/test', { logging: false });
  const Usuario = load('models/auth.model.js', { '../config/database': { sequelize } });
  assert.equal(Usuario.getTableName(), 'usuarios');
  assert.equal(Usuario.rawAttributes.id.type.key, 'BIGINT');
  assert.equal(Usuario.rawAttributes.id.autoIncrement, true);
  assert.equal(Usuario.rawAttributes.email.field, 'email');
  const sql = sequelize.getQueryInterface().queryGenerator.selectQuery(Usuario.getTableName(), { attributes: ['id', 'email'] });
  assert.match(sql, /FROM "usuarios"/);
  assert.match(sql, /"email"/);
});
