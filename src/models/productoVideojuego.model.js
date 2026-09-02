const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProductoVideojuego = sequelize.define('ProductoVideojuego', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  videojuego_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  tipo_cuenta: {
    type: DataTypes.STRING(20),
    allowNull: false, // principal/secundaria
  },
  precio: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  stock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  }
}, {
  tableName: 'productos_videojuego',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      unique: true,
      fields: ['videojuego_id', 'tipo_cuenta']
    }
  ]
});

module.exports = ProductoVideojuego;
