const { sequelize, ProductoVideojuego, Videojuego } = require('../models');

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
        disponible: Boolean(videojuego.activo && producto.activo),
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

const ensure = async (req, res) => {
  const rawgId = req.body?.rawg_id;
  const titulo = typeof req.body?.titulo === 'string' ? req.body.titulo.trim() : '';
  const imagen = req.body?.imagen_url;
  if (typeof rawgId !== 'string' || !/^[1-9]\d{0,18}$/.test(rawgId) || BigInt(rawgId) > 9223372036854775807n ||
      !titulo || titulo.length > 200 ||
      (imagen !== null && imagen !== undefined && (typeof imagen !== 'string' || imagen.length > 2048 || !/^https:\/\//i.test(imagen)))) {
    return res.status(400).json({ message: 'Datos del videojuego inválidos' });
  }
  try {
    const productos = await sequelize.transaction(async (transaction) => {
      const [videojuego] = await Videojuego.findOrCreate({
        where: { rawg_id: rawgId },
        defaults: { rawg_id: rawgId, titulo, imagen_url: imagen || null, activo: true },
        transaction,
      });
      for (const [tipo_cuenta, precio] of [['principal', '650.00'], ['secundaria', '260.00']]) {
        await ProductoVideojuego.findOrCreate({
          where: { videojuego_id: videojuego.id, tipo_cuenta },
          defaults: { videojuego_id: videojuego.id, tipo_cuenta, precio, activo: true },
          transaction,
        });
      }
      return ProductoVideojuego.findAll({
        where: { videojuego_id: videojuego.id },
        include: [{ model: Videojuego, required: true }],
        transaction,
      });
    });
    res.json({ productos });
  } catch (error) {
    console.error('Error al asegurar productos del videojuego:', error);
    res.status(500).json({ message: 'No se pudieron preparar los productos del videojuego' });
  }
};

module.exports = { obtenerTodos, obtenerPorId, obtenerPorRawgId, ensure };
