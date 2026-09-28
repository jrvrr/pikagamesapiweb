const { sequelize, Pedido, PedidoDetalle, ProductoVideojuego, Videojuego } = require('../models');

const MAX_CENTAVOS = 9999999999; // DECIMAL(10, 2)

const rechazarPedido = (message) => {
  throw Object.assign(new Error(message), { status: 400 });
};

const crearPedido = async (req, res) => {
  try {
    const nuevoPedido = await sequelize.transaction(async (transaction) => {
      let productos = req.body?.productos;
      if (req.body?.juego !== undefined) {
        const juego = req.body.juego;
        if (productos !== undefined || !juego ||
            !Number.isSafeInteger(juego.rawg_id) || juego.rawg_id < 1 ||
            typeof juego.titulo !== 'string' || !juego.titulo.trim() || juego.titulo.length > 200 ||
            !['principal', 'secundaria'].includes(juego.tipo_cuenta)) {
          rechazarPedido('Juego o tipo de cuenta inválido');
        }
        const [videojuego] = await Videojuego.findOrCreate({
          where: { rawg_id: juego.rawg_id },
          defaults: { titulo: juego.titulo.trim() }, transaction,
        });
        const [producto] = await ProductoVideojuego.findOrCreate({
          where: { videojuego_id: videojuego.id, tipo_cuenta: juego.tipo_cuenta },
          defaults: { precio: juego.tipo_cuenta === 'principal' ? '650.00' : '260.00' }, transaction,
        });
        productos = [{ producto_id: String(producto.id), cantidad: 1 }];
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
        // Todos los títulos tienen tarifa fija y disponibilidad ilimitada.
        const precioCentavos = producto.tipo_cuenta === 'principal' ? 65000 : 26000;
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
        subtotal,
        descuento: '0.00',
        total: subtotal,
        estado: 'pendiente_pago',
      }, { transaction });
      await PedidoDetalle.bulkCreate(
        detalles.map((detalle) => ({ ...detalle, pedido_id: pedido.id })),
        { transaction, validate: true },
      );
      return pedido;
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
