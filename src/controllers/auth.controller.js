const { Usuario, PasswordResetToken } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const authConfig = require('../config/auth.config');
const { where, fn, col } = require('sequelize');
const { profileInput, emailInput, passwordInput } = require('../config/auth.validation');

const environment = typeof process === 'undefined' ? {} : process.env;
const publicAppUrl = (environment.FRONTEND_URL || environment.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const issueToken = (usuario) => jwt.sign({ user: { id: usuario.id, role: usuario.rol } }, authConfig.secret, { expiresIn: authConfig.expiresIn });
const sendResetEmail = async (email, resetUrl) => {
  const subject = 'Recupera tu contraseña de PikaGames';
  const html = `<div style="margin:0;background:#111311;padding:32px;font-family:Arial,sans-serif;color:#f4f4f5"><div style="max-width:560px;margin:auto;background:#18181b;border:1px solid #3f3f46;border-radius:20px;padding:32px"><div style="display:inline-block;background:#ffd90f;color:#18181b;padding:8px 12px;border-radius:10px;font-weight:900;letter-spacing:1px">PIKAGAMES</div><h1 style="margin:28px 0 12px;color:#fff">Recupera tu contraseña</h1><p style="color:#a1a1aa;line-height:1.6">Recibimos una solicitud para crear una nueva contraseña para tu cuenta.</p><p style="margin:28px 0"><a href="${resetUrl}" style="display:inline-block;background:#ffd90f;color:#18181b;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:700">Crear nueva contraseña</a></p><p style="color:#71717a;font-size:13px;line-height:1.6">Este enlace caduca en una hora y solo puede utilizarse una vez. Si no solicitaste este cambio, ignora este correo.</p></div></div>`;
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[PikaGames] Modo simulación: enlace de recuperación para ${email}: ${resetUrl}`);
    return;
  }
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
  await transporter.sendMail({ from: `PikaGames <${process.env.EMAIL_USER}>`, to: email, subject, html });
};

// Coincide con el índice versionado; también reconoce correos históricos sin reescribirlos.
const findEmail = (email) => Usuario.findAll({
  where: where(fn('lower', fn('btrim', col('email'))), email), limit: 2,
});
const buscarUsuarioPorToken = (token) => Usuario.findOne({ where: { reset_token: token } });
const limpiarTokenRecuperacion = (usuario) => {
  usuario.reset_token = null;
  usuario.reset_token_expires = null;
};
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

    const token = issueToken(usuario);

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

    const token = issueToken(usuario);

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

const requestPasswordReset = async (req, res) => {
  const email = emailInput(req.body?.email);
  if (!email) return res.status(400).json({ message: 'El correo debe ser válido' });
  try {
    const matches = await findEmail(email);
    const usuario = matches.length === 1 && matches[0].activo === true ? matches[0] : null;
    if (usuario) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      usuario.reset_token = rawToken;
      usuario.reset_token_expires = new Date(Date.now() + 60 * 60 * 1000);
      await usuario.save();
      await sendResetEmail(email, `${publicAppUrl}/reset-password?token=${encodeURIComponent(rawToken)}`);
    }
    return res.json({ message: 'Si existe una cuenta con ese correo, recibirás un enlace para recuperar tu contraseña.' });
  } catch (error) {
    console.error('Password reset request failed:', error.message);
    return res.status(503).json({ message: 'No se pudo enviar el correo de recuperación. Intenta más tarde.' });
  }
};

const resetPassword = async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const newPassword = req.body?.newPassword;
  const error = !token ? 'El enlace de recuperación no es válido' : passwordInput(newPassword, true);
  if (error) return res.status(400).json({ message: error });
  try {
    const usuario = await buscarUsuarioPorToken(token);
    if (!usuario || !usuario.reset_token_expires || new Date(usuario.reset_token_expires).getTime() <= Date.now()) return res.status(400).json({ message: 'El enlace de recuperación es inválido o ya expiró.' });
    if (usuario.activo !== true) return res.status(400).json({ message: 'El enlace de recuperación no es válido.' });
    usuario.password_hash = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
    limpiarTokenRecuperacion(usuario);
    await usuario.save();
    return res.json({ message: 'Contraseña restablecida correctamente.' });
  } catch (error) {
    return authError(res, error);
  }
};

const googleLogin = async (req, res) => {
  const idToken = typeof req.body?.credential === 'string' ? req.body.credential : '';
  if (!idToken || !process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ message: 'Inicio con Google no configurado' });
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!response.ok) return res.status(401).json({ message: 'La credencial de Google no es válida' });
    const profile = await response.json();
    if (profile.aud !== process.env.GOOGLE_CLIENT_ID || profile.email_verified !== 'true') return res.status(401).json({ message: 'La cuenta de Google no pudo verificarse' });
    const email = emailInput(profile.email);
    if (!email) return res.status(401).json({ message: 'Google no devolvió un correo válido' });
    const matches = await findEmail(email);
    let usuario = matches.length === 1 ? matches[0] : null;
    if (!usuario) {
      usuario = await Usuario.create({ nombre: String(profile.given_name || profile.name || 'Jugador').slice(0, 30), apellidos: String(profile.family_name || '').slice(0, 30) || 'PikaGames', email, password_hash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10), rol: 'cliente' });
    }
    if (usuario.activo !== true) return res.status(401).json({ message: 'La cuenta está desactivada' });
    return res.json({ token: issueToken(usuario) });
  } catch (error) {
    return authError(res, error);
  }
};

module.exports = { registrar, login, getMe, updateProfile, updatePassword, requestPasswordReset, resetPassword, googleLogin };
