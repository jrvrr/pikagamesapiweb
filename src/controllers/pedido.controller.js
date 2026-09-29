const { sequelize, Pedido, PedidoDetalle, Pago, ProductoVideojuego, Videojuego } = require('../models');

const MAX_CENTAVOS = 9999999999; // DECIMAL(10, 2)

const rechazarPedido = (message) => {
  throw Object.assign(new Error(message), { status: 400 });
};

const centavos = (value) => {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(String(value))) rechazarPedido('Precio de producto inválido');
  const [entero, decimal = ''] = String(value).split('.');
  return Number(entero) * 100 + Number(decimal.padEnd(2, '0'));
};

const crearPedido = async (req, res) => {
  try {
    const nuevoPedido = await sequelize.transaction(async (transaction) => {
      const productos = req.body?.productos;
      const metodoPago = req.body?.metodo_pago;
      const requestId = req.body?.request_id;
      if (!['paypal', 'oxxo', 'transferencia'].includes(metodoPago)) {
        rechazarPedido('Método de pago inválido');
      }
      if (typeof requestId !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
        rechazarPedido('request_id inválido');
      }
      const existente = await Pedido.findOne({
        where: { usuario_id: req.user.id, request_id: requestId }, transaction,
      });
      if (existente) {
        const pago = await Pago.findOne({ where: { pedido_id: existente.id }, transaction });
        if (!pago || pago.metodo !== metodoPago) rechazarPedido('request_id ya utilizado');
        return {
          id: existente.id, usuario_id: existente.usuario_id, subtotal: existente.subtotal,
          descuento: existente.descuento, total: existente.total, estado: existente.estado,
          metodo_pago: pago.metodo,
        };
      }
      if (!Array.isArray(productos) || productos.length === 0) {
        rechazarPedido('Se requiere una lista de productos no vacía');
      }

      const cantidades = new Map();
      for (const item of productos) {
        const id = item?.producto_id;
        if (!((typeof id === 'number' && Number.isSafeInteger(id)) || typeof id === 'string') ||
            !/^[1-9]\d{0,18}$/.test(String(id)) || BigInt(id) > 9223372036854775807n) {
          rechazarPedido('producto_id debe ser un identificador entero positivo válido');
        }
        if (!Number.isInteger(item.cantidad) || item.cantidad < 1 || item.cantidad > 2147483647) {
          rechazarPedido('cantidad debe ser un entero positivo válido');
        }
        if (cantidades.has(String(id))) {
          rechazarPedido('No se permiten productos duplicados');
        }
        cantidades.set(String(id), item.cantidad);
      }

      const catalogo = await ProductoVideojuego.findAll({
        where: { id: [...cantidades.keys()] },
        include: [{ model: Videojuego, attributes: ['titulo', 'activo'], required: true }],
        lock: transaction.LOCK?.UPDATE,
        transaction,
      });
      if (catalogo.length !== cantidades.size) {
        rechazarPedido('Uno o más productos no existen');
      }

      let subtotalCentavos = 0;
      const detalles = catalogo.map((producto) => {
        const cantidad = cantidades.get(String(producto.id));
        if (!producto.activo || !producto.Videojuego?.activo) {
          rechazarPedido(`El producto ${producto.id} no está disponible`);
        }
        if (!['principal', 'secundaria'].includes(producto.tipo_cuenta)) {
          rechazarPedido('Tipo de cuenta inválido');
        }
        const precioCentavos = centavos(producto.precio);
        const totalCentavos = precioCentavos * cantidad;
        subtotalCentavos += totalCentavos;
        if (!Number.isSafeInteger(subtotalCentavos) || subtotalCentavos > MAX_CENTAVOS) {
          rechazarPedido('El importe del pedido excede el máximo permitido');
        }

        return {
          producto_id: producto.id,
          titulo_snapshot: producto.Videojuego.titulo,
          tipo_cuenta_snapshot: producto.tipo_cuenta,
          precio_unitario: (precioCentavos / 100).toFixed(2),
          descuento_unitario: '0.00',
          cantidad,
          total_linea: (totalCentavos / 100).toFixed(2),
        };
      });

      const subtotal = (subtotalCentavos / 100).toFixed(2);
      const pedido = await Pedido.create({
        usuario_id: req.user.id,
        request_id: requestId,
        subtotal,
        descuento: '0.00',
        total: subtotal,
        estado: 'pendiente_pago',
      }, { transaction });
      await PedidoDetalle.bulkCreate(
        detalles.map((detalle) => ({ ...detalle, pedido_id: pedido.id })),
        { transaction, validate: true },
      );
      await Pago.create({
        pedido_id: pedido.id, metodo: metodoPago, estado: 'pendiente', monto: pedido.total,
      }, { transaction });
      return {
        id: pedido.id, usuario_id: pedido.usuario_id, subtotal: pedido.subtotal,
        descuento: pedido.descuento, total: pedido.total, estado: pedido.estado,
        metodo_pago: metodoPago,
      };
    });

    res.status(201).json(nuevoPedido);
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error al crear pedido:', error);
    res.status(500).json({ message: 'Error al crear pedido' });
  }
};

const misPedidos = async (req, res) => {
  try {
    const pedidos = await Pedido.findAll({
      where: { usuario_id: req.user.id },
      include: [PedidoDetalle]
    });
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener pedidos', error: error.message });
  }
};

module.exports = { crearPedido, misPedidos };
