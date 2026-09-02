const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Promocion = sequelize.define('Promocion', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  descripcion: {
    type: DataTypes.TEXT,
  },
  tipo: {
    type: DataTypes.STRING(20),
    allowNull: false, // porcentaje/monto
  },
  valor: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  fecha_inicio: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  fecha_fin: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  }
}, {
  tableName: 'promociones',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Promocion;
