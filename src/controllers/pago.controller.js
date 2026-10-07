const { sequelize, Pago, Pedido, Usuario, Comprobante, Entrega } = require('../models');

const METODOS_MANUALES = ['transferencia', 'oxxo'];
const ESTADOS_VALIDOS = ['pendiente', 'aprobado', 'rechazado'];
const idValido = (value) => /^[1-9]\d{0,18}$/.test(String(value));

const serializarPago = (pago) => {
  const value = pago.toJSON();
  const pedido = value.Pedido;
  const usuario = pedido?.Usuario;
  return {
    id: String(value.id),
    pedido_id: String(value.pedido_id),
    metodo: value.metodo,
    estado: value.estado,
    referencia_externa: value.referencia_externa,
    monto: String(value.monto),
    fecha_pago: value.fecha_pago,
    created_at: value.created_at,
    pedido: pedido ? {
      id: String(pedido.id),
      estado: pedido.estado,
      total: String(pedido.total),
      created_at: pedido.created_at,
    } : null,
    usuario: usuario ? {
      id: String(usuario.id),
      nombre: `${usuario.nombre} ${usuario.apellidos}`.trim(),
      email: usuario.email,
    } : null,
    comprobante: value.Comprobante ? {
      id: String(value.Comprobante.id),
      archivo_url: value.Comprobante.archivo_url,
      nombre_archivo: value.Comprobante.nombre_archivo,
      estado: value.Comprobante.estado,
      observaciones: value.Comprobante.observaciones,
    } : null,
  };
};

const obtenerPagosAdmin = async (req, res) => {
  try {
    const pagos = await Pago.findAll({
      where: { metodo: METODOS_MANUALES },
      include: [
        {
          model: Pedido,
          attributes: ['id', 'usuario_id', 'total', 'estado', 'created_at'],
          include: [{ model: Usuario, attributes: ['id', 'nombre', 'apellidos', 'email'] }],
        },
        { model: Comprobante, attributes: ['id', 'archivo_url', 'nombre_archivo', 'estado', 'observaciones'] },
      ],
      order: [['created_at', 'DESC']],
    });
    return res.json(pagos.map(serializarPago));
  } catch (error) {
    console.error('Error al obtener pagos para administración:', error);
    return res.status(500).json({ message: 'Error al obtener pagos' });
  }
};

const actualizarEstado = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body || {};
  if (!idValido(id)) return res.status(400).json({ message: 'Identificador inválido' });
  if (!ESTADOS_VALIDOS.includes(estado)) return res.status(400).json({ message: 'Estado no válido' });

  try {
    const pagoActualizado = await sequelize.transaction(async (transaction) => {
      const pago = await Pago.findByPk(id, {
        include: [{ model: Pedido }],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!pago) throw Object.assign(new Error('Pago no encontrado'), { status: 404 });
      if (!METODOS_MANUALES.includes(pago.metodo)) throw Object.assign(new Error('Este pago no se revisa manualmente'), { status: 400 });
      if (['aprobado', 'rechazado'].includes(pago.estado) && pago.estado !== estado) throw Object.assign(new Error('El estado final del pago no puede cambiarse'), { status: 409 });

      await pago.update({
        estado,
        ...(estado === 'aprobado' ? { fecha_pago: pago.fecha_pago || new Date() } : {}),
      }, { transaction });

      if (estado === 'aprobado') {
        if (pago.Pedido?.estado === 'pendiente_pago') await pago.Pedido.update({ estado: 'pagado' }, { transaction });
        await Entrega.findOrCreate({ where: { pedido_id: pago.pedido_id }, defaults: { estado: 'pendiente' }, transaction });
      } else if (estado === 'rechazado') {
        if (pago.Pedido && ['pendiente', 'pendiente_pago'].includes(pago.Pedido.estado)) {
          await pago.Pedido.update({ estado: 'cancelado' }, { transaction });
        }
        await Entrega.update({ estado: 'cancelado' }, { where: { pedido_id: pago.pedido_id, estado: 'pendiente' }, transaction });
      }

      return pago;
    });

    return res.json({ message: 'Estado del pago actualizado', pago: serializarPago(pagoActualizado) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error('Error al actualizar estado del pago:', error);
    return res.status(500).json({ message: 'Error al actualizar pago' });
  }
};

module.exports = { obtenerPagosAdmin, actualizarEstado };
