const { Videojuego, ProductoVideojuego } = require('../models');

const obtenerTodos = async (req, res) => {
  try {
    const videojuegos = await Videojuego.findAll({
      include: [ProductoVideojuego]
    });
    res.json(videojuegos);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

const crear = async (req, res) => {
  try {
    const nuevoVideojuego = await Videojuego.create(req.body);
    res.status(201).json(nuevoVideojuego);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear', error: error.message });
  }
};

module.exports = { obtenerTodos, crear };
