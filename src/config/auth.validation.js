const { Validator } = require('sequelize');

const emailInput = (value) => {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 50 && Validator.isEmail(email) ? email : null;
};

// Registro y cambio comparten política. No se recortan ni normalizan contraseñas.
const passwordInput = (value, isNew = false) => {
  if (typeof value !== 'string' || !value.length) return 'La contraseña es obligatoria';
  if (isNew && (Array.from(value).length < 8 || Buffer.byteLength(value, 'utf8') > 72)) {
    return 'La contraseña debe tener al menos 8 caracteres y como máximo 72 bytes UTF-8';
  }
  // Las credenciales históricas se verifican con bcrypt sin aplicarles una política retroactiva.
  return null;
};

const profileInput = (body, partial = false) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Datos inválidos' };
  const value = {};
  for (const key of ['nombre', 'apellidos', 'email']) {
    if (partial && !Object.hasOwn(body, key)) continue;
    if (key === 'email') {
      value.email = emailInput(body.email);
      if (!value.email) return { error: 'El correo debe ser válido y tener como máximo 50 caracteres' };
    } else {
      if (typeof body[key] !== 'string' || !body[key].trim() || body[key].trim().length > 30) {
        return { error: `${key} es obligatorio y debe tener como máximo 30 caracteres` };
      }
      value[key] = body[key].trim();
    }
  }
  if (!Object.keys(value).length) return { error: 'No hay campos para actualizar' };
  return { value };
};

module.exports = { emailInput, passwordInput, profileInput };
