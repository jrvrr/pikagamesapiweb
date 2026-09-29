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

const obtenerPorRawgId = async (req, res) => {
  const { rawgId } = req.params;
  if (!/^[1-9]\d{0,18}$/.test(rawgId) || BigInt(rawgId) > 9223372036854775807n) {
    return res.status(400).json({ message: 'rawgId inválido' });
  }
  try {
    const productos = await ProductoVideojuego.findAll({
      include: [{ model: Videojuego, where: { rawg_id: rawgId }, required: true }],
    });
    if (!productos.length) return res.status(404).json({ message: 'Producto no disponible' });
    const videojuego = productos[0].Videojuego;
    res.json({
      rawg_id: String(videojuego.rawg_id),
      titulo: videojuego.titulo,
      descripcion: videojuego.descripcion,
      imagen_url: videojuego.imagen_url,
      activo: videojuego.activo,
      productos: productos.map((producto) => ({
        id: String(producto.id),
        tipo_cuenta: producto.tipo_cuenta,
        precio: String(producto.precio),
        stock: producto.stock,
        disponible: Boolean(videojuego.activo && producto.activo && producto.stock > 0),
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

module.exports = { obtenerTodos, obtenerPorId, obtenerPorRawgId };
