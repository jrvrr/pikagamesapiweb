const express = require('express');
const router = express.Router();
const { obtenerTodos, obtenerPorId, obtenerPorRawgId } = require('../controllers/productoVideojuego.controller');

router.get('/', obtenerTodos);
router.get('/rawg/:rawgId', obtenerPorRawgId);
router.get('/:id', obtenerPorId);

module.exports = router;
