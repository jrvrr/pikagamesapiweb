const { PAYPAL_CONFIG } = require('../config/paypal');

// ──────────────────────────────────────────────
// 1. Obtener Access Token (OAuth2 Client Credentials)
// ──────────────────────────────────────────────
const getAccessToken = async () => {
  const { baseUrl, clientId, clientSecret } = PAYPAL_CONFIG;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`PayPal OAuth error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.access_token;
};

// ──────────────────────────────────────────────
// 2. Crear Orden en PayPal
// ──────────────────────────────────────────────
/**
 * @param {Object} params
 * @param {string} params.monto        - Monto total (ej. "19.99")
 * @param {string} params.moneda       - Código de moneda ISO 4217 (default "MXN")
 * @param {string} params.descripcion  - Descripción del pedido
 * @param {string} params.pedidoId     - ID interno del pedido (referencia)
 * @returns {Object} Orden creada de PayPal (incluye id y links)
 */
const crearOrden = async ({ monto, moneda = 'MXN', descripcion, pedidoId }) => {
  const accessToken = await getAccessToken();
  const { baseUrl } = PAYPAL_CONFIG;

  const orderPayload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: String(pedidoId),
        description: descripcion || `Pedido #${pedidoId}`,
        amount: {
          currency_code: moneda,
          value: String(monto),
        },
      },
    ],
    application_context: {
      brand_name: 'PikaGames',
      landing_page: 'NO_PREFERENCE',
      user_action: 'PAY_NOW',
      shipping_preference: 'NO_SHIPPING',
    },
  };

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(orderPayload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`PayPal crear orden error (${response.status}): ${errorBody}`);
  }

  return await response.json();
};

// ──────────────────────────────────────────────
// 3. Capturar Pago de una Orden aprobada
// ──────────────────────────────────────────────
/**
 * @param {string} paypalOrderId - El ID de la orden de PayPal
 * @returns {Object} Resultado de la captura
 */
const capturarOrden = async (paypalOrderId) => {
  const accessToken = await getAccessToken();
  const { baseUrl } = PAYPAL_CONFIG;

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`PayPal capturar orden error (${response.status}): ${errorBody}`);
  }

  return await response.json();
};

// ──────────────────────────────────────────────
// 4. Obtener detalles de una Orden
// ──────────────────────────────────────────────
const obtenerOrden = async (paypalOrderId) => {
  const accessToken = await getAccessToken();
  const { baseUrl } = PAYPAL_CONFIG;

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`PayPal obtener orden error (${response.status}): ${errorBody}`);
  }

  return await response.json();
};

// ──────────────────────────────────────────────
// 5. Verificar firma de Webhook
// ──────────────────────────────────────────────
const verificarWebhook = async ({ headers, body }) => {
  const accessToken = await getAccessToken();
  const { baseUrl, webhookId } = PAYPAL_CONFIG;

  const verificationPayload = {
    auth_algo: headers['paypal-auth-algo'],
    cert_url: headers['paypal-cert-url'],
    transmission_id: headers['paypal-transmission-id'],
    transmission_sig: headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id: webhookId,
    webhook_event: body,
  };

  const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(verificationPayload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`PayPal verificar webhook error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.verification_status === 'SUCCESS';
};

module.exports = {
  getAccessToken,
  crearOrden,
  capturarOrden,
  obtenerOrden,
  verificarWebhook,
};
