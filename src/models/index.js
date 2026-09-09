const { sequelize } = require('../config/database');

// Importar modelos
const Usuario = require('./auth.model');
const Videojuego = require('./videojuego.model');
const ProductoVideojuego = require('./productoVideojuego.model');
const Promocion = require('./promocion.model');
const PromocionProducto = require('./promocionProducto.model');
const Carrito = require('./carrito.model');
const CarritoDetalle = require('./carritoDetalle.model');
const Pedido = require('./pedido.model');
const PedidoDetalle = require('./pedidoDetalle.model');
const Pago = require('./pago.model');
const Comprobante = require('./comprobante.model');
const Entrega = require('./entrega.model');
const CuentaProducto = require('./cuentaProducto.model');
const Comentario = require('./comentario.model');
const Favorito = require('./favorito.model');

// Relaciones Videojuego <-> ProductoVideojuego
Videojuego.hasMany(ProductoVideojuego, { foreignKey: 'videojuego_id' });
ProductoVideojuego.belongsTo(Videojuego, { foreignKey: 'videojuego_id' });

// Relaciones Promociones <-> Productos (Muchos a Muchos)
Promocion.belongsToMany(ProductoVideojuego, { through: PromocionProducto, foreignKey: 'promocion_id' });
ProductoVideojuego.belongsToMany(Promocion, { through: PromocionProducto, foreignKey: 'producto_id' });

// Relaciones Carrito
Usuario.hasOne(Carrito, { foreignKey: 'usuario_id' });
Carrito.belongsTo(Usuario, { foreignKey: 'usuario_id' });

Carrito.hasMany(CarritoDetalle, { foreignKey: 'carrito_id', onDelete: 'CASCADE' });
CarritoDetalle.belongsTo(Carrito, { foreignKey: 'carrito_id' });
CarritoDetalle.belongsTo(ProductoVideojuego, { foreignKey: 'producto_id' });

// Relaciones Pedido
Usuario.hasMany(Pedido, { foreignKey: 'usuario_id' });
Pedido.belongsTo(Usuario, { foreignKey: 'usuario_id' });

Pedido.hasMany(PedidoDetalle, { foreignKey: 'pedido_id', onDelete: 'CASCADE' });
PedidoDetalle.belongsTo(Pedido, { foreignKey: 'pedido_id' });
PedidoDetalle.belongsTo(ProductoVideojuego, { foreignKey: 'producto_id' });

// Relaciones Pago y Comprobante
Pedido.hasOne(Pago, { foreignKey: 'pedido_id', onDelete: 'CASCADE' });
Pago.belongsTo(Pedido, { foreignKey: 'pedido_id' });

Pago.hasOne(Comprobante, { foreignKey: 'pago_id', onDelete: 'CASCADE' });
Comprobante.belongsTo(Pago, { foreignKey: 'pago_id' });

// Relaciones Entrega y CuentaProducto
Pedido.hasOne(Entrega, { foreignKey: 'pedido_id', onDelete: 'CASCADE' });
Entrega.belongsTo(Pedido, { foreignKey: 'pedido_id' });

ProductoVideojuego.hasMany(CuentaProducto, { foreignKey: 'producto_id' });
CuentaProducto.belongsTo(ProductoVideojuego, { foreignKey: 'producto_id' });
Pedido.hasMany(CuentaProducto, { foreignKey: 'pedido_id' });
CuentaProducto.belongsTo(Pedido, { foreignKey: 'pedido_id' });

// Relaciones Favoritos
Usuario.hasMany(Favorito, { foreignKey: 'usuario_id', onDelete: 'CASCADE' });
Favorito.belongsTo(Usuario, { foreignKey: 'usuario_id' });

module.exports = {
  sequelize,
  Usuario,
  Videojuego,
  ProductoVideojuego,
  Promocion,
  PromocionProducto,
  Carrito,
  CarritoDetalle,
  Pedido,
  PedidoDetalle,
  Pago,
  Comprobante,
  Entrega,
  CuentaProducto,
  Comentario,
  Favorito
};
