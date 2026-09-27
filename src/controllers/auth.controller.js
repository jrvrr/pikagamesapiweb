const { Usuario } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth.config');
const { where, fn, col } = require('sequelize');
const { profileInput, emailInput, passwordInput } = require('../config/auth.validation');

// Coincide con el índice versionado; también reconoce correos históricos sin reescribirlos.
const findEmail = (email) => Usuario.findAll({
  where: where(fn('lower', fn('btrim', col('correo'))), email), limit: 2,
});
const authError = (res, error) => {
  if (error.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({ message: 'El correo ya está en uso' });
  }
  return res.status(500).json({ message: 'Error en el servidor' });
};

const registrar = async (req, res) => {
  try {
    if (!authConfig.secret) return res.status(503).json({ message: 'Autenticación no configurada' });
    const input = profileInput(req.body);
    const password = req.body?.password;
    const error = input.error || passwordInput(password, true);
    if (error) return res.status(400).json({ message: error });
    const { nombre, apellidos, email } = input.value;
    const matches = await findEmail(email);
    let usuario;
    
    if (matches.length) {
      return res.status(400).json({ message: 'El usuario ya existe' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    usuario = await Usuario.create({
      nombre,
      apellidos,
      email,
      password_hash,
      rol: 'cliente'
    });

    const payload = { user: { id: usuario.id, role: usuario.rol } };
    const token = jwt.sign(payload, authConfig.secret, { expiresIn: authConfig.expiresIn });

    res.status(201).json({ token });
  } catch (error) {
    authError(res, error);
  }
};

const login = async (req, res) => {
  try {
    if (!authConfig.secret) return res.status(503).json({ message: 'Autenticación no configurada' });
    const email = emailInput(req.body?.email);
    const password = req.body?.password;
    if (!email || passwordInput(password)) return res.status(400).json({ message: 'Credenciales inválidas' });
    const matches = await findEmail(email);
    const usuario = matches.length === 1 ? matches[0] : null;

    if (!usuario || usuario.activo !== true) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    const isMatch = await bcrypt.compare(password, usuario.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    const payload = { user: { id: usuario.id, role: usuario.rol } };
    const token = jwt.sign(payload, authConfig.secret, { expiresIn: authConfig.expiresIn });

    res.json({ token });
  } catch (error) {
    authError(res, error);
  }
};

const getMe = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash'] }
    });

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(usuario);
  } catch (error) {
    authError(res, error);
  }
};

const updateProfile = async (req, res) => {
  try {
    const input = profileInput(req.body, true);
    if (input.error) return res.status(400).json({ message: input.error });
    const { email } = input.value;
    const usuario = await Usuario.findByPk(req.user.id);

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Comprobar si el email ya existe y es de otro usuario
    if (email) {
      const matches = await findEmail(email);
      if (matches.some((match) => match.id !== usuario.id)) {
        return res.status(400).json({ message: 'El correo ya está en uso por otra cuenta' });
      }
    }

    Object.assign(usuario, input.value);

    await usuario.save();

    // Devolver el usuario sin la contraseña
    const usuarioActualizado = usuario.toJSON();
    delete usuarioActualizado.password_hash;

    res.json({ message: 'Perfil actualizado con éxito', usuario: usuarioActualizado });
  } catch (error) {
    authError(res, error);
  }
};

const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const error = passwordInput(currentPassword) || passwordInput(newPassword, true);
    if (error) return res.status(400).json({ message: error });
    const usuario = await Usuario.findByPk(req.user.id);

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const isMatch = await bcrypt.compare(currentPassword, usuario.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'La contraseña actual es incorrecta' });
    }

    const salt = await bcrypt.genSalt(10);
    usuario.password_hash = await bcrypt.hash(newPassword, salt);

    await usuario.save();

    res.json({ message: 'Contraseña actualizada con éxito' });
  } catch (error) {
    authError(res, error);
  }
};

module.exports = { registrar, login, getMe, updateProfile, updatePassword };
