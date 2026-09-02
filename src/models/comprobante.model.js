const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Comprobante = sequelize.define('Comprobante', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  pago_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: true,
  },
  archivo_url: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  nombre_archivo: {
    type: DataTypes.STRING(255),
  },
  mime_type: {
    type: DataTypes.STRING(100),
  },
  estado: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'pendiente_revision',
  },
  observaciones: {
    type: DataTypes.TEXT,
  }
}, {
  tableName: 'comprobantes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Comprobante;
