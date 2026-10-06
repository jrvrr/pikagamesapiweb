const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PasswordResetToken = sequelize.define('PasswordResetToken', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  usuario_id: { type: DataTypes.BIGINT, allowNull: false },
  token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  used_at: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'password_reset_tokens', timestamps: true, createdAt: 'created_at', updatedAt: false });

module.exports = PasswordResetToken;
