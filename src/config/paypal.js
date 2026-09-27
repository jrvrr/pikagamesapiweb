require('dotenv').config();

// Fase 2: no hay ruta de ejecución hacia PayPal Live.
const PAYPAL_CONFIG = {
  baseUrl: 'https://api-m.sandbox.paypal.com',
  env: 'sandbox',
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  webhookId: process.env.PAYPAL_WEBHOOK_ID,
};

module.exports = { PAYPAL_CONFIG };
