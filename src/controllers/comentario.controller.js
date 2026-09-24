const { Comentario } = require('../models');

// Crear un nuevo comentario
const crearComentario = async (req, res) => {
  try {
    const { user_id, nombre, calificacion, mensaje } = req.body;

    const rawUserId = req.user?.id || user_id;

    // Validación básica
    if (!nombre || !calificacion || !mensaje) {
      return res.status(400).json({
        mensaje: 'Los campos nombre, calificacion y mensaje son requeridos'
      });
    }

    let finalUserId = rawUserId || null;
    if (finalUserId) {
      const num = parseInt(finalUserId, 10);
      if (!isNaN(num) && String(num) === String(finalUserId).trim()) {
        finalUserId = num;
      }
    }

    let nuevoComentario;
    try {
      nuevoComentario = await Comentario.create({
        user_id: finalUserId,
        nombre: String(nombre).trim(),
        calificacion: Number(calificacion),
        mensaje: String(mensaje).trim(),
        estado: 'pendiente'
      });
    } catch (dbErr) {
      console.warn('Fallback al crear comentario sin user_id por incompatibilidad de tipo:', dbErr.message);
      nuevoComentario = await Comentario.create({
        user_id: null,
        nombre: String(nombre).trim(),
        calificacion: Number(calificacion),
        mensaje: String(mensaje).trim(),
        estado: 'pendiente'
      });
    }

    return res.status(201).json({
      mensaje: 'Comentario creado exitosamente, en espera de aprobación',
      comentario: nuevoComentario
    });
  } catch (error) {
    console.error('Error al crear comentario:', error);
    return res.status(500).json({ mensaje: 'Error al crear el comentario', error: error.message });
  }
};

// Obtener solo los comentarios aprobados (para el frontend)
const obtenerAprobados = async (req, res) => {
  try {
    const comentarios = await Comentario.findAll({
      where: { estado: 'aprobado' },
      order: [['fecha_creacion', 'DESC']]
    });
    return res.json(comentarios);
  } catch (error) {
    console.error('Error al obtener comentarios aprobados:', error);
    try {
      const comentarios = await Comentario.findAll({
        order: [['fecha_creacion', 'DESC']]
      });
      return res.json(comentarios);
    } catch (fallbackErr) {
      return res.status(500).json({ mensaje: 'Error al obtener comentarios', error: error.message });
    }
  }
};

// Obtener todos los comentarios (para el panel de administración)
const obtenerTodos = async (req, res) => {
  try {
    const comentarios = await Comentario.findAll({
      order: [['fecha_creacion', 'DESC']]
    });
    return res.json(comentarios);
  } catch (error) {
    console.error('Error al obtener todos los comentarios:', error);
    return res.status(500).json({ mensaje: 'Error al obtener comentarios', error: error.message });
  }
};

// Actualizar el estado de un comentario (aprobar/rechazar)
const actualizarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!['pendiente', 'aprobado', 'rechazado'].includes(estado)) {
      return res.status(400).json({ mensaje: 'Estado no válido' });
    }

    const comentario = await Comentario.findByPk(id);
    if (!comentario) {
      return res.status(404).json({ mensaje: 'Comentario no encontrado' });
    }

    comentario.estado = estado;
    await comentario.save();

    return res.json({
      mensaje: 'Estado del comentario actualizado',
      comentario
    });
  } catch (error) {
    console.error('Error al actualizar estado del comentario:', error);
    return res.status(500).json({ mensaje: 'Error al actualizar comentario', error: error.message });
  }
};

// Eliminar un comentario (para el panel de administración)
const eliminarComentario = async (req, res) => {
  try {
    const { id } = req.params;

    const comentario = await Comentario.findByPk(id);
    if (!comentario) {
      return res.status(404).json({ mensaje: 'Comentario no encontrado' });
    }

    await comentario.destroy();

    return res.json({ mensaje: 'Comentario eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar comentario:', error);
    return res.status(500).json({ mensaje: 'Error al eliminar comentario', error: error.message });
  }
};

module.exports = {
  crearComentario,
  obtenerAprobados,
  obtenerTodos,
  actualizarEstado,
  eliminarComentario
};
