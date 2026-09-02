const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Entrega = sequelize.define('Entrega', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  pedido_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: true,
  },
  estado: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'pendiente',
  },
  entregado_at: {
    type: DataTypes.DATE,
  },
  notas: {
    type: DataTypes.TEXT,
  }
}, {
  tableName: 'entregas',
  timestamps: false,
});

module.exports = Entrega;
