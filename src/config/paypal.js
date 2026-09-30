require('dotenv').config();

const urls = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
};
const configuredUrl = (process.env.PAYPAL_BASE_URL || '').replace(/\/+$/, '');
const configuredEnv = (process.env.PAYPAL_ENV || '').toLowerCase();
const inferredEnv = Object.keys(urls).find((env) => urls[env] === configuredUrl);
if (configuredEnv === 'sandbox') throw new Error('PayPal Sandbox is disabled; set PAYPAL_ENV=live and configure Live credentials');
const env = configuredEnv === 'production' ? 'live' : configuredEnv || inferredEnv || 'live';
if (!urls[env] || (configuredUrl && configuredUrl !== urls[env])) {
  throw new Error('PAYPAL_ENV y PAYPAL_BASE_URL deben seleccionar Sandbox o Live de forma consistente');
}

const PAYPAL_CONFIG = {
  baseUrl: urls[env],
  env,
  clientId: process.env.PAYPAL_CLIENT_ID?.trim(),
  clientSecret: process.env.PAYPAL_CLIENT_SECRET?.trim(),
  webhookId: process.env.PAYPAL_WEBHOOK_ID,
};

module.exports = { PAYPAL_CONFIG };