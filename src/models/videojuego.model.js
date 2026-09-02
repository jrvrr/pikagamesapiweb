const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Videojuego = sequelize.define('Videojuego', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  titulo: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  descripcion: {
    type: DataTypes.TEXT,
  },
  imagen_url: {
    type: DataTypes.TEXT,
  },
  consola: {
    type: DataTypes.STRING(100),
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  }
}, {
  tableName: 'videojuegos',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Videojuego;
