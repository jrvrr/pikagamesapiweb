const { Usuario } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth.config');

const registrar = async (req, res) => {
  try {
    const { nombre, apellidos, email, password } = req.body;
    let usuario = await Usuario.findOne({ where: { email } });
    
    if (usuario) {
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
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const usuario = await Usuario.findOne({ where: { email } });

    if (!usuario) {
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
    res.status(500).json({ message: 'Error en el servidor' });
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
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { nombre, apellidos, email } = req.body;
    const usuario = await Usuario.findByPk(req.user.id);

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Comprobar si el email ya existe y es de otro usuario
    if (email && email !== usuario.email) {
      const emailExists = await Usuario.findOne({ where: { email } });
      if (emailExists) {
        return res.status(400).json({ message: 'El correo ya está en uso por otra cuenta' });
      }
    }

    usuario.nombre = nombre || usuario.nombre;
    usuario.apellidos = apellidos || usuario.apellidos;
    usuario.email = email || usuario.email;

    await usuario.save();

    // Devolver el usuario sin la contraseña
    const usuarioActualizado = usuario.toJSON();
    delete usuarioActualizado.password_hash;

    res.json({ message: 'Perfil actualizado con éxito', usuario: usuarioActualizado });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar el perfil', error: error.message });
  }
};

const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
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
    res.status(500).json({ message: 'Error al actualizar la contraseña', error: error.message });
  }
};

module.exports = { registrar, login, getMe, updateProfile, updatePassword };
