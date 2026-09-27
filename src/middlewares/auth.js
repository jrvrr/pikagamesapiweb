const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth.config');

module.exports = async (req, res, next) => {
  let decoded;
  if (!authConfig.secret) return res.status(503).json({ message: 'Autenticación no configurada' });
  const match = /^Bearer ([^\s]+)$/.exec(req.header('Authorization') || '');
  if (!match) return res.status(401).json({ message: 'Se requiere autenticación' });
  try {
    decoded = jwt.verify(match[1], authConfig.secret, { algorithms: ['HS256'] });
    if (!decoded.user || typeof decoded.user.id !== 'string' ||
        !/^[1-9]\d{0,18}$/.test(decoded.user.id) || BigInt(decoded.user.id) > 9223372036854775807n) {
      throw new Error('Identidad inválida');
    }
  } catch {
    return res.status(401).json({ message: 'El token no es válido' });
  }
  try {
    const { Usuario } = require('../models');
    const usuario = await Usuario.findByPk(decoded.user.id, { attributes: ['id', 'rol', 'activo'] });
    if (!usuario || usuario.activo !== true) {
      return res.status(401).json({ message: 'La sesión no está disponible' });
    }
    req.user = { id: usuario.id, role: usuario.rol };
  } catch {
    return res.status(503).json({ message: 'No se pudo verificar la sesión' });
  }
  return next();
};
