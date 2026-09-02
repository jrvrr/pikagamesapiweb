const express = require('express');
const router = express.Router();
const { crearPedido, misPedidos } = require('../controllers/pedido.controller');
const auth = require('../middlewares/auth');

router.post('/', auth, crearPedido);
router.get('/mis-pedidos', auth, misPedidos);

module.exports = router;
