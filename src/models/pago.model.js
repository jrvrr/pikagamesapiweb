const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Pago = sequelize.define('Pago', {
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
  metodo: {
    type: DataTypes.STRING(30),
    allowNull: false, // paypal/transferencia
  },
  estado: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'pendiente',
  },
  referencia_externa: {
    type: DataTypes.STRING(200),
    unique: true,
  },
  paypal_request_id: {
    type: DataTypes.UUID,
    unique: true,
  },
  paypal_capture_id: {
    type: DataTypes.STRING(64),
    unique: true,
  },
  monto: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  fecha_pago: {
    type: DataTypes.DATE,
  }
}, {
  tableName: 'pagos',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Pago;
