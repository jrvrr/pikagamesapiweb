const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Favorito = sequelize.define('Favorito', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  usuario_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  rawg_game_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  game_name: {
    type: DataTypes.STRING(300),
    allowNull: false,
  },
  game_image: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  game_rating: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  game_released: {
    type: DataTypes.STRING(50),
    allowNull: true,
  }
}, {
  tableName: 'favoritos',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      unique: true,
      fields: ['usuario_id', 'rawg_game_id']
    }
  ]
});

module.exports = Favorito;
