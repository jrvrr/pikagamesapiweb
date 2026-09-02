module.exports = {
  secret: process.env.JWT_SECRET || 'secret-key-default',
  expiresIn: '1h'
};
