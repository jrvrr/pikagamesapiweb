const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pago.controller');
const auth = require('../middlewares/auth');
const admin = require('../middlewares/admin');

router.get('/admin', auth, admin, pagoController.obtenerPagosAdmin);
router.put('/admin/:id/estado', auth, admin, pagoController.actualizarEstado);

module.exports = router;
