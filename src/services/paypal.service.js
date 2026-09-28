const { PAYPAL_CONFIG } = require('../config/paypal');

const getAccessToken = async () => {
  const { clientId, clientSecret, baseUrl } = PAYPAL_CONFIG;
  if (!clientId || !clientSecret) throw new Error('Faltan credenciales PayPal');
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`PayPal OAuth: ${response.status}`);
  return (await response.json()).access_token;
};

const request = async (path, { method = 'GET', body, requestId } = {}) => {
  const token = await getAccessToken();
  const response = await fetch(`${PAYPAL_CONFIG.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`PayPal API: ${response.status}`);
  return response.json();
};

const crearOrden = ({ monto, pedidoId, requestId }) => request('/v2/checkout/orders', {
  method: 'POST', requestId,
  body: {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: String(pedidoId),
      custom_id: String(pedidoId),
      invoice_id: `pika-${requestId}`,
      description: `Pedido PikaGames #${pedidoId}`,
      amount: { currency_code: 'MXN', value: String(monto) },
    }],
    payment_source: { paypal: { experience_context: {
      brand_name: 'PikaGames', user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING',
    } } },
  },
});
const capturarOrden = (id, requestId) => request(`/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {
  method: 'POST', body: {}, requestId,
});
const obtenerOrden = (id) => request(`/v2/checkout/orders/${encodeURIComponent(id)}`);

const verificarWebhook = async ({ headers, body }) => {
  if (!PAYPAL_CONFIG.webhookId) throw new Error('Falta PAYPAL_WEBHOOK_ID del entorno configurado');
  const names = ['auth-algo', 'cert-url', 'transmission-id', 'transmission-sig', 'transmission-time'];
  if (names.some((name) => !headers[`paypal-${name}`])) return false;
  const result = await request('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: {
      auth_algo: headers['paypal-auth-algo'], cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'], transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: PAYPAL_CONFIG.webhookId, webhook_event: body,
    },
  });
  return result.verification_status === 'SUCCESS';
};

module.exports = { crearOrden, capturarOrden, obtenerOrden, verificarWebhook };
