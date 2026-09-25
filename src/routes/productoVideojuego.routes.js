const express = require('express');
const router = express.Router();
const { obtenerTodos, obtenerPorId } = require('../controllers/productoVideojuego.controller');

router.get('/', obtenerTodos);
router.get('/:id', obtenerPorId);

module.exports = router;

