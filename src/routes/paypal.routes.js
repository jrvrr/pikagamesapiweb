const express = require('express');
const router = express.Router();
const paypalController = require('../controllers/paypal.controller');
const auth = require('../middlewares/auth');
const { PAYPAL_CONFIG } = require('../config/paypal');

// Client ID y entorno son datos públicos del SDK; nunca exponer el secreto.
router.get('/config', (req, res) => res.json({ clientId: PAYPAL_CONFIG.clientId || null, env: PAYPAL_CONFIG.env }));

// Rutas que requieren autenticación (usuario logueado)
router.post('/crear-orden', auth, paypalController.crearOrden);
router.post('/capturar-orden', auth, paypalController.capturarOrden);
router.get('/orden/:paypalOrderId', auth, paypalController.obtenerOrden);

// Webhook de PayPal (NO requiere JWT, PayPal lo llama directamente)
router.post('/webhook', paypalController.webhook);

module.exports = router;
