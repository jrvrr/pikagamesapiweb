const { ProductoVideojuego, Videojuego } = require('../models');

const obtenerTodos = async (req, res) => {
  try {
    const productos = await ProductoVideojuego.findAll({ include: [Videojuego] });
    res.json(productos);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

const obtenerPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await ProductoVideojuego.findByPk(id, { include: [Videojuego] });
    if (!producto) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    res.json(producto);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

module.exports = { obtenerTodos, obtenerPorId };

