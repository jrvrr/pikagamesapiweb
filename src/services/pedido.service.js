const crearPedido = async (datosPedido) => {
  return { mensaje: 'Pedido creado exitosamente', data: datosPedido };
};

const obtenerPedidos = async () => {
  return [];
};

module.exports = {
  crearPedido,
  obtenerPedidos,
};
