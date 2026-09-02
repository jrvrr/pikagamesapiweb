const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CarritoDetalle = sequelize.define('CarritoDetalle', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  carrito_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  producto_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  precio_unitario: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  }
}, {
  tableName: 'carrito_detalle',
  timestamps: false,
});

module.exports = CarritoDetalle;
