const express = require('express');
const router = express.Router();
const { obtenerTodos, obtenerPorId, obtenerPorRawgId, ensure } = require('../controllers/productoVideojuego.controller');
const auth = require('../middlewares/auth');

router.get('/', obtenerTodos);
router.get('/rawg/:rawgId', obtenerPorRawgId);
router.post('/ensure', auth, ensure);
router.get('/:id', obtenerPorId);

module.exports = router;
