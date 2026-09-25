const paypalService = require('../services/paypal.service');
const { Pago, Pedido, PedidoDetalle, Comprobante } = require('../models');

// ──────────────────────────────────────────────
// POST /api/paypal/crear-orden
// Body: { pedidoId }
// ──────────────────────────────────────────────
const crearOrden = async (req, res) => {
  try {
    const { pedidoId } = req.body;

    if (!pedidoId) {
      return res.status(400).json({ message: 'Se requiere pedidoId' });
    }

    // Verificar que el pedido exista y pertenezca al usuario
    const pedido = await Pedido.findOne({
      where: { id: pedidoId, usuario_id: req.user.id },
      include: [PedidoDetalle],
    });

    if (!pedido) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    if (pedido.estado !== 'pendiente_pago') {
      return res.status(400).json({ message: `El pedido ya tiene estado: ${pedido.estado}` });
    }

    // Crear orden en PayPal
    const ordenPaypal = await paypalService.crearOrden({
      monto: pedido.total,
      moneda: 'MXN',
      descripcion: `Pedido PikaGames #${pedido.id}`,
      pedidoId: pedido.id,
    });

    // Guardar registro de pago con estado pendiente
    await Pago.upsert({
      pedido_id: pedido.id,
      metodo: 'paypal',
      estado: 'pendiente',
      referencia_externa: ordenPaypal.id,
      monto: pedido.total,
    });

    // Devolver el ID de la orden para el frontend (JS SDK)
    res.json({
      id: ordenPaypal.id,
      status: ordenPaypal.status,
    });
  } catch (error) {
    console.error('Error al crear orden PayPal:', error);
    res.status(500).json({
      message: 'Error al crear orden en PayPal',
      error: error.message,
    });
  }
};

// ──────────────────────────────────────────────
// POST /api/paypal/capturar-orden
// Body: { paypalOrderId }
// ──────────────────────────────────────────────
const capturarOrden = async (req, res) => {
  try {
    const { paypalOrderId } = req.body;

    if (!paypalOrderId) {
      return res.status(400).json({ message: 'Se requiere paypalOrderId' });
    }

    // Capturar el pago en PayPal
    const capturaResult = await paypalService.capturarOrden(paypalOrderId);

    if (capturaResult.status !== 'COMPLETED') {
      return res.status(400).json({
        message: 'La captura no se completó',
        status: capturaResult.status,
      });
    }

    // Buscar el pago vinculado por referencia_externa
    const pago = await Pago.findOne({
      where: { referencia_externa: paypalOrderId },
    });

    if (!pago) {
      return res.status(404).json({ message: 'Pago no encontrado para esta orden' });
    }

    // Extraer datos de la captura
    const capture = capturaResult.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId = capture?.id || paypalOrderId;

    // Actualizar pago a completado
    await pago.update({
      estado: 'completado',
      fecha_pago: new Date(),
    });

    // Actualizar estado del pedido
    await Pedido.update(
      { estado: 'pagado' },
      { where: { id: pago.pedido_id } }
    );

    // Crear comprobante
    await Comprobante.upsert({
      pago_id: pago.id,
      archivo_url: `paypal:${captureId}`,
      nombre_archivo: `paypal_capture_${captureId}`,
      mime_type: 'application/json',
      estado: 'aprobado',
    });

    res.json({
      message: 'Pago capturado exitosamente',
      captureId,
      status: capturaResult.status,
    });
  } catch (error) {
    console.error('Error al capturar orden PayPal:', error);
    res.status(500).json({
      message: 'Error al capturar pago',
      error: error.message,
    });
  }
};

// ──────────────────────────────────────────────
// POST /api/paypal/webhook
// PayPal envía eventos aquí (no requiere auth JWT)
// ──────────────────────────────────────────────
const webhook = async (req, res) => {
  try {
    // Verificar firma del webhook
    const isValid = await paypalService.verificarWebhook({
      headers: req.headers,
      body: req.body,
    });

    if (!isValid) {
      console.warn('Webhook PayPal con firma inválida');
      return res.status(400).json({ message: 'Firma inválida' });
    }

    const event = req.body;
    const eventType = event.event_type;

    console.log(`Webhook PayPal recibido: ${eventType}`);

    // Manejar eventos de pago
    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const resource = event.resource;
        const paypalOrderId = resource.supplementary_data?.related_ids?.order_id;

        if (paypalOrderId) {
          const pago = await Pago.findOne({
            where: { referencia_externa: paypalOrderId },
          });

          if (pago && pago.estado !== 'completado') {
            await pago.update({
              estado: 'completado',
              fecha_pago: new Date(),
            });

            await Pedido.update(
              { estado: 'pagado' },
              { where: { id: pago.pedido_id } }
            );

            console.log(`Pedido ${pago.pedido_id} marcado como pagado vía webhook`);
          }
        }
        break;
      }

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.REFUNDED': {
        const resource = event.resource;
        const paypalOrderId = resource.supplementary_data?.related_ids?.order_id;

        if (paypalOrderId) {
          const pago = await Pago.findOne({
            where: { referencia_externa: paypalOrderId },
          });

          if (pago) {
            const nuevoEstado = eventType === 'PAYMENT.CAPTURE.REFUNDED'
              ? 'reembolsado'
              : 'rechazado';

            await pago.update({ estado: nuevoEstado });
            await Pedido.update(
              { estado: nuevoEstado },
              { where: { id: pago.pedido_id } }
            );

            console.log(`Pedido ${pago.pedido_id} actualizado a ${nuevoEstado} vía webhook`);
          }
        }
        break;
      }

      default:
        console.log(`Evento no manejado: ${eventType}`);
    }

    // PayPal espera un 200 para confirmar recepción
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error en webhook PayPal:', error);
    // Devolver 200 igualmente para que PayPal no reintente excesivamente
    res.status(200).json({ received: true, error: error.message });
  }
};

// ──────────────────────────────────────────────
// GET /api/paypal/orden/:paypalOrderId
// Consultar estado de una orden
// ──────────────────────────────────────────────
const obtenerOrden = async (req, res) => {
  try {
    const { paypalOrderId } = req.params;
    const orden = await paypalService.obtenerOrden(paypalOrderId);
    res.json(orden);
  } catch (error) {
    console.error('Error al obtener orden PayPal:', error);
    res.status(500).json({
      message: 'Error al obtener orden',
      error: error.message,
    });
  }
};

module.exports = {
  crearOrden,
  capturarOrden,
  webhook,
  obtenerOrden,
};
