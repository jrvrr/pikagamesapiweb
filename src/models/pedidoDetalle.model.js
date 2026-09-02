const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PedidoDetalle = sequelize.define('PedidoDetalle', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  pedido_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  producto_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  titulo_snapshot: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  tipo_cuenta_snapshot: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  precio_unitario: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  descuento_unitario: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  total_linea: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  }
}, {
  tableName: 'pedido_detalle',
  timestamps: false,
});

module.exports = PedidoDetalle;
