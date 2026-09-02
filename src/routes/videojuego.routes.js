const express = require('express');
const router = express.Router();
const { obtenerTodos, crear } = require('../controllers/videojuego.controller');
const auth = require('../middlewares/auth');
const admin = require('../middlewares/admin');

router.get('/', obtenerTodos);
router.post('/', [auth, admin], crear); // Solo admin puede crear

module.exports = router;
