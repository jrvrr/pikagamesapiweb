const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth.config');

const auth = (req, res, next) => {
  const token = req.header('Authorization');
  
  if (!token) {
    return res.status(401).json({ message: 'No hay token, autorización denegada' });
  }

  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), authConfig.secret);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'El token no es válido' });
  }
};

module.exports = auth;
