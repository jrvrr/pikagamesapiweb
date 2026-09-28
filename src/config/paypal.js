require('dotenv').config();

const urls = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
};
const configuredUrl = (process.env.PAYPAL_BASE_URL || '').replace(/\/+$/, '');
const configuredEnv = (process.env.PAYPAL_ENV || '').toLowerCase();
const inferredEnv = Object.keys(urls).find((env) => urls[env] === configuredUrl);
const env = configuredEnv === 'production' ? 'live' : configuredEnv || inferredEnv ||
  (process.env.NODE_ENV === 'production' ? 'live' : 'sandbox');
if (!urls[env] || (configuredUrl && configuredUrl !== urls[env])) {
  throw new Error('PAYPAL_ENV y PAYPAL_BASE_URL deben seleccionar Sandbox o Live de forma consistente');
}

const PAYPAL_CONFIG = {
  baseUrl: urls[env],
  env,
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  webhookId: process.env.PAYPAL_WEBHOOK_ID,
};

module.exports = { PAYPAL_CONFIG };
