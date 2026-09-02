const { Pedido, PedidoDetalle } = require('../models');

const crearPedido = async (req, res) => {
  try {
    // Aquí iría la lógica compleja de carrito -> pedido, simulada por ahora:
    const nuevoPedido = await Pedido.create({
      usuario_id: req.user.id,
      subtotal: req.body.subtotal,
      total: req.body.total,
    });
    res.status(201).json(nuevoPedido);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear pedido', error: error.message });
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
