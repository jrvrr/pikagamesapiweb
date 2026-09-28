const { randomUUID } = require('node:crypto');
const paypal = require('../services/paypal.service');
const { sequelize, Pedido, Pago, Comprobante, Entrega } = require('../models');

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const orderId = (id) => {
  if (typeof id !== 'string' || !/^[A-Z0-9]{1,64}$/.test(id)) fail(400, 'Orden PayPal inválida');
  return id;
};
const cents = (value) => {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(String(value))) fail(409, 'Importe inválido');
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
};
const respondError = (res, error) => {
  console.error('PayPal:', error);
  return res.status(error.status || 503).json({
    message: error.status ? error.message : 'No se pudo confirmar el pago. Reintenta la consulta del mismo pedido.',
  });
};

const ownedPedido = async (id, userId, transaction) => {
  const pedido = await Pedido.findOne({
    where: { id, usuario_id: userId }, transaction, lock: transaction.LOCK.UPDATE,
  });
  if (!pedido) fail(404, 'Pedido no encontrado');
  return pedido;
};

const crearOrden = async (req, res) => {
  try {
    const id = req.body?.pedidoId;
    if (!((typeof id === 'number' && Number.isSafeInteger(id)) || typeof id === 'string') ||
        !/^[1-9]\d{0,18}$/.test(String(id)) || BigInt(id) > 9223372036854775807n) {
      fail(400, 'pedidoId inválido');
    }
    // La clave se confirma ANTES del efecto externo, también si su respuesta se pierde.
    await sequelize.transaction(async (transaction) => {
      const pedido = await ownedPedido(id, req.user.id, transaction);
      if (pedido.estado !== 'pendiente_pago' || cents(pedido.total) <= 0n) fail(409, 'Pedido no disponible para pago');
      const pago = await Pago.findOne({ where: { pedido_id: pedido.id }, transaction });
      if (pago && pago.metodo !== 'paypal') fail(409, 'Pedido asociado a otro método de pago');
      if (!pago) await Pago.create({
        pedido_id: pedido.id, metodo: 'paypal', estado: 'pendiente', monto: pedido.total,
        paypal_request_id: randomUUID(),
      }, { transaction });
    });
    const result = await sequelize.transaction(async (transaction) => {
      const pedido = await ownedPedido(id, req.user.id, transaction);
      const pago = await Pago.findOne({ where: { pedido_id: pedido.id }, transaction });
      if (pedido.estado !== 'pendiente_pago' || pago.estado !== 'pendiente') fail(409, 'Pedido no disponible para pago');
      if (!pago.referencia_externa) {
        // PayPal retiene las claves 6h por defecto. Nunca recrear una orden ambigua fuera de esa ventana.
        if (!pago.paypal_request_id || Date.now() - new Date(pago.created_at).getTime() > 5 * 3600000) {
          fail(409, 'Creación pendiente de revisión; no se generará otra orden');
        }
        const orden = await paypal.crearOrden({ monto: pago.monto, pedidoId: pedido.id, requestId: pago.paypal_request_id });
        orderId(orden.id);
        await pago.update({ referencia_externa: orden.id }, { transaction });
      }
      return { id: pago.referencia_externa, pedidoId: String(pedido.id), total: String(pago.monto), currency: 'MXN' };
    });
    res.json(result);
  } catch (error) { respondError(res, error); }
};

// Todos los caminos toman el mismo bloqueo y releen PayPal dentro de él.
// ponytail: el bloqueo por pedido incluye latencia de PayPal; usar leases si el volumen exige liberar conexiones.
const procesarOrden = async (id, userId, capture = false) => {
  const found = await Pago.findOne({ where: { referencia_externa: id, metodo: 'paypal' } });
  if (!found) fail(userId ? 404 : 503, 'Orden no registrada');
  return sequelize.transaction(async (transaction) => {
    const pedido = userId
      ? await ownedPedido(found.pedido_id, userId, transaction)
      : await Pedido.findOne({ where: { id: found.pedido_id }, transaction, lock: transaction.LOCK.UPDATE });
    if (!pedido) fail(503, 'Pedido no registrado');
    const pago = await Pago.findOne({ where: { id: found.id }, transaction });
    let orden = await paypal.obtenerOrden(id);
    const validateOrder = () => {
      const unit = orden.purchase_units?.[0];
      if (orden.id !== id || orden.intent !== 'CAPTURE' || orden.purchase_units?.length !== 1 ||
          unit?.reference_id !== String(pedido.id) ||
          (unit.custom_id !== undefined && unit.custom_id !== String(pedido.id)) ||
          unit?.amount?.currency_code !== 'MXN' || cents(unit.amount.value) !== cents(pago.monto) ||
          cents(pago.monto) !== cents(pedido.total)) fail(409, 'La orden PayPal no coincide con el pedido');
      return unit;
    };
    let unit = validateOrder();
    if (capture && orden.status === 'APPROVED' && !unit.payments?.captures?.length) {
      if (pedido.estado !== 'pendiente_pago' || pago.estado !== 'pendiente') fail(409, 'Pedido no disponible para captura');
      try {
        orden = await paypal.capturarOrden(id, `capture-${id}`);
      } catch {
        // Puede haber cobrado aunque se haya perdido la respuesta. Nunca crear otra orden.
        orden = await paypal.obtenerOrden(id);
      }
      unit = validateOrder();
    }
    const captures = unit.payments?.captures || [];
    if (captures.length > 1) fail(409, 'Capturas múltiples requieren revisión');
    const captured = captures[0];
    if (!captured) {
      if (orden.status === 'COMPLETED' || pago.estado === 'aprobado') fail(503, 'Falta referencia de captura');
      return { confirmed: false, status: orden.status, pedidoId: String(pedido.id), paypalOrderId: id };
    }
    if (!captured.id || captured.amount?.currency_code !== 'MXN' ||
        cents(captured.amount.value) !== cents(pago.monto) ||
        (pago.paypal_capture_id && pago.paypal_capture_id !== captured.id)) fail(409, 'Captura inconsistente');

    const states = { COMPLETED: 'aprobado', PENDING: 'pendiente', DECLINED: 'rechazado',
      FAILED: 'rechazado', REFUNDED: 'cancelado', PARTIALLY_REFUNDED: 'cancelado', REVERSED: 'cancelado' };
    const estado = states[captured.status];
    if (!estado) fail(503, 'Estado de captura desconocido');
    // Un evento atrasado no revive un pago cancelado ni revierte uno aprobado.
    const terminal = ['cancelado', 'rechazado'];
    if ((terminal.includes(pago.estado) && estado === 'aprobado') ||
        (pago.estado === 'aprobado' && ['pendiente', 'rechazado'].includes(estado))) {
      return { confirmed: false, status: pago.estado, pedidoId: String(pedido.id), paypalOrderId: id };
    }
    if (estado === 'aprobado' && orden.status !== 'COMPLETED') fail(503, 'Orden sin completar');
    await pago.update({ estado, paypal_capture_id: captured.id,
      ...(estado === 'aprobado' ? { fecha_pago: pago.fecha_pago || new Date() } : {}),
    }, { transaction });

    if (estado === 'aprobado') {
      if (!['pendiente_pago', 'pagado', 'entregado'].includes(pedido.estado)) fail(409, 'Pedido requiere revisión');
      if (pedido.estado === 'pendiente_pago') await pedido.update({ estado: 'pagado' }, { transaction });
      const receipt = {
        archivo_url: `paypal:${captured.id}`, nombre_archivo: `paypal_capture_${captured.id}`,
        mime_type: 'application/json', estado: 'aprobado',
      };
      const [comprobante] = await Comprobante.findOrCreate({ where: { pago_id: pago.id }, defaults: receipt, transaction });
      if (comprobante.estado !== 'aprobado' || comprobante.archivo_url !== receipt.archivo_url) {
        await comprobante.update(receipt, { transaction });
      }
      await Entrega.findOrCreate({ where: { pedido_id: pedido.id }, defaults: { estado: 'pendiente' }, transaction });
    } else if (terminal.includes(estado)) {
      await pedido.update({ estado: 'cancelado' }, { transaction });
      await Comprobante.update({ estado: 'rechazado' }, { where: { pago_id: pago.id }, transaction });
      await Entrega.update({ estado: 'cancelado' }, { where: { pedido_id: pedido.id, estado: 'pendiente' }, transaction });
    }
    return { confirmed: estado === 'aprobado', status: captured.status, pagoEstado: estado,
      pedidoId: String(pedido.id), paypalOrderId: id, captureId: captured.id, total: String(pago.monto), currency: 'MXN' };
  });
};

const capturarOrden = async (req, res) => {
  try {
    const result = await procesarOrden(orderId(req.body?.paypalOrderId), req.user.id, true);
    res.status(result.confirmed ? 200 : 202).json(result);
  } catch (error) { respondError(res, error); }
};
const obtenerOrden = async (req, res) => {
  try { res.json(await procesarOrden(orderId(req.params.paypalOrderId), req.user.id)); }
  catch (error) { respondError(res, error); }
};
const webhook = async (req, res) => {
  try {
    if (!await paypal.verificarWebhook({ headers: req.headers, body: req.body })) {
      return res.status(400).json({ message: 'Firma inválida' });
    }
    const event = req.body;
    if (['PAYMENT.CAPTURE.COMPLETED', 'PAYMENT.CAPTURE.PENDING', 'PAYMENT.CAPTURE.DENIED',
      'PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.CAPTURE.REVERSED', 'CHECKOUT.ORDER.COMPLETED'].includes(event.event_type)) {
      let id = event.resource?.supplementary_data?.related_ids?.order_id;
      if (event.event_type === 'CHECKOUT.ORDER.COMPLETED') id = event.resource?.id;
      if (!id) {
        const captureLink = event.resource?.links?.find((link) => link.rel === 'up')?.href;
        const captureId = event.resource?.supplementary_data?.related_ids?.capture_id ||
          (event.resource_type === 'capture' ? event.resource?.id : undefined) ||
          /^https:\/\/api(?:-m)?(?:\.sandbox)?\.paypal\.com\/v2\/payments\/captures\/([A-Z0-9]+)$/.exec(captureLink || '')?.[1];
        const pago = captureId && await Pago.findOne({ where: { paypal_capture_id: captureId, metodo: 'paypal' } });
        id = pago?.referencia_externa;
      }
      if (!id) fail(503, 'Evento pendiente de asociar a una orden');
      const result = await procesarOrden(orderId(id));
      if (['PAYMENT.CAPTURE.COMPLETED', 'CHECKOUT.ORDER.COMPLETED'].includes(event.event_type) &&
          !result.confirmed && !['cancelado', 'rechazado'].includes(result.pagoEstado || result.status)) {
        fail(503, 'PayPal aún no confirma el evento; reintentar');
      }
    }
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook PayPal:', error);
    res.status(503).json({ received: false, message: 'Evento pendiente de reconciliación' });
  }
};

module.exports = { crearOrden, capturarOrden, obtenerOrden, webhook };
