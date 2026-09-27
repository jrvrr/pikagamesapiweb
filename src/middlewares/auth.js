const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth.config');

module.exports = (req, res, next) => {
  if (!authConfig.secret) return res.status(503).json({ message: 'Autenticación no configurada' });
  const match = /^Bearer ([^\s]+)$/.exec(req.header('Authorization') || '');
  if (!match) return res.status(401).json({ message: 'Se requiere autenticación' });
  try {
    const decoded = jwt.verify(match[1], authConfig.secret, { algorithms: ['HS256'] });
    if (!decoded.user || typeof decoded.user.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded.user.id)) {
      throw new Error('Identidad inválida');
    }
    req.user = decoded.user;
    next();
  } catch {
    res.status(401).json({ message: 'El token no es válido' });
  }
};
