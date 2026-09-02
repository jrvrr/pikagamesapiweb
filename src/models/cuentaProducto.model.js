const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CuentaProducto = sequelize.define('CuentaProducto', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  producto_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  identificador_interno: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  datos_cuenta_cifrados: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  estado: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'disponible',
  },
  pedido_id: {
    type: DataTypes.BIGINT,
  },
  entregado_at: {
    type: DataTypes.DATE,
  }
}, {
  tableName: 'cuentas_producto',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = CuentaProducto;
