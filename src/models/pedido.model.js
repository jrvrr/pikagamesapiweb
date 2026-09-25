const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Pedido = sequelize.define('Pedido', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  usuario_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  descuento: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  estado: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'pendiente_pago',
  }
}, {
  tableName: 'pedidos',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Pedido;
