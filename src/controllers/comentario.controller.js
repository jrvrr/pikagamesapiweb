const { Comentario } = require('../models');

// Crear un nuevo comentario
const crearComentario = async (req, res) => {
  try {
    const { user_id, nombre, calificacion, mensaje } = req.body;

    // Validación básica
    if (!user_id || !nombre || !calificacion || !mensaje) {
      return res.status(400).json({
        mensaje: 'Todos los campos son requeridos (user_id, nombre, calificacion, mensaje)'
      });
    }

    const nuevoComentario = await Comentario.create({
      user_id,
      nombre,
      calificacion,
      mensaje,
      estado: 'pendiente' // Por defecto
    });

    res.status(201).json({
      mensaje: 'Comentario creado exitosamente, en espera de aprobación',
      comentario: nuevoComentario
    });
  } catch (error) {
    console.error('Error al crear comentario:', error);
    res.status(500).json({ mensaje: 'Error al crear el comentario', error: error.message });
  }
};

// Obtener solo los comentarios aprobados (para el frontend)
const obtenerAprobados = async (req, res) => {
  try {
    const comentarios = await Comentario.findAll({
      where: { estado: 'aprobado' },
      order: [['fecha_creacion', 'DESC']]
    });
    res.json(comentarios);
  } catch (error) {
    console.error('Error al obtener comentarios aprobados:', error);
    res.status(500).json({ mensaje: 'Error al obtener comentarios', error: error.message });
  }
};

// Obtener todos los comentarios (para el panel de administración)
const obtenerTodos = async (req, res) => {
  try {
    const comentarios = await Comentario.findAll({
      order: [['fecha_creacion', 'DESC']]
    });
    res.json(comentarios);
  } catch (error) {
    console.error('Error al obtener todos los comentarios:', error);
    res.status(500).json({ mensaje: 'Error al obtener comentarios', error: error.message });
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

    res.json({
      mensaje: 'Estado del comentario actualizado',
      comentario
    });
  } catch (error) {
    console.error('Error al actualizar estado del comentario:', error);
    res.status(500).json({ mensaje: 'Error al actualizar comentario', error: error.message });
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

    res.json({ mensaje: 'Comentario eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar comentario:', error);
    res.status(500).json({ mensaje: 'Error al eliminar comentario', error: error.message });
  }
};

module.exports = {
  crearComentario,
  obtenerAprobados,
  obtenerTodos,
  actualizarEstado,
  eliminarComentario
};
