const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function setup() {
  const rows = [];
  const Favorito = {
    async findAll({ where }) { return rows.filter((row) => row.usuario_id === where.usuario_id); },
    async findOrCreate({ where, defaults }) {
      let row = rows.find((item) => item.usuario_id === where.usuario_id && item.rawg_game_id === where.rawg_game_id);
      if (row) return [row, false];
      row = { ...defaults, created_at: new Date() }; rows.push(row); return [row, true];
    },
    async destroy({ where }) {
      const before = rows.length;
      for (let index = rows.length - 1; index >= 0; index--) {
        if (rows[index].usuario_id === where.usuario_id && rows[index].rawg_game_id === where.rawg_game_id) rows.splice(index, 1);
      }
      return before - rows.length;
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(readFileSync(path.join(__dirname, '../src/controllers/favoritos.controller.js'), 'utf8'), {
    module, require: (id) => id === '../models' ? { Favorito } : require(id), console: { error() {} }, Number,
  });
  const controller = module.exports;
  const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  return { rows, controller, response };
}

test('favoritos se guardan por usuario BIGINT y no se comparten entre cuentas', async () => {
  const app = setup();
  const input = { rawg_game_id: 968497, game_name: 'Juego de prueba' };
  for (const usuario_id of ['1', '2']) {
    const res = app.response();
    await app.controller.addFavorito({ user: { id: usuario_id }, body: input }, res);
    assert.equal(res.code, 201);
  }
  const res = app.response(); await app.controller.getFavoritos({ user: { id: '1' } }, res);
  assert.deepEqual(res.body.favoritos.map((game) => game.name), ['Juego de prueba']);
  const duplicate = app.response(); await app.controller.addFavorito({ user: { id: '1' }, body: input }, duplicate);
  assert.equal(duplicate.code, 200); assert.equal(app.rows.length, 2);
  const removed = app.response(); await app.controller.removeFavorito({ user: { id: '1' }, params: { rawgGameId: '968497' } }, removed);
  assert.equal(app.rows.length, 1); assert.equal(app.rows[0].usuario_id, '2');
});

test('favoritos rechazan valores inválidos antes de escribir', async () => {
  const app = setup();
  for (const body of [null, {}, { rawg_game_id: '9', game_name: 'A' }, { rawg_game_id: -1, game_name: 'A' },
    { rawg_game_id: 1, game_name: ' ' }, { rawg_game_id: 1, game_name: 'x'.repeat(301) },
    { rawg_game_id: 1, game_name: 'A', game_rating: '5' }, { rawg_game_id: 1, game_name: 'A', game_released: 'x'.repeat(51) }]) {
    const res = app.response(); await app.controller.addFavorito({ user: { id: '1' }, body }, res);
    assert.equal(res.code, 400);
  }
  assert.equal(app.rows.length, 0);
});
