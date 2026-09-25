const dotenv = require('dotenv');

dotenv.config();

const configuredBaseUrl = process.env.PAYPAL_BASE_URL
  ? process.env.PAYPAL_BASE_URL.trim()
  : undefined;

const envFromUrl = configuredBaseUrl && configuredBaseUrl.includes('sandbox')
  ? 'sandbox'
  : 'production';

const env = (process.env.PAYPAL_ENV || '').toLowerCase() || envFromUrl || 'production';

const defaultBaseUrl = env === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const PAYPAL_CONFIG = {
  baseUrl: configuredBaseUrl || defaultBaseUrl,
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  webhookId: process.env.PAYPAL_WEBHOOK_ID,
  env,
};

module.exports = { PAYPAL_CONFIG };
