const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PromocionProducto = sequelize.define('PromocionProducto', {
  promocion_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    allowNull: false,
  },
  producto_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    allowNull: false,
  }
}, {
  tableName: 'promocion_productos',
  timestamps: false,
});

module.exports = PromocionProducto;
