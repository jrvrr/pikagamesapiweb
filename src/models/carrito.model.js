const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Carrito = sequelize.define('Carrito', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  usuario_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  estado: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'activo',
  }
}, {
  tableName: 'carritos',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Carrito;
