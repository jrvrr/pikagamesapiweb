const { Comentario } = require('../models');

// Crear un nuevo comentario
const crearComentario = async (req, res) => {
  try {
    const { nombre, calificacion, mensaje } = req.body || {};
    if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 255 ||
        typeof mensaje !== 'string' || !mensaje.trim() || mensaje.trim().length > 5000 ||
        !Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5) {
      return res.status(400).json({ mensaje: 'Nombre, mensaje y calificación (entero de 1 a 5) válidos son requeridos' });
    }
    const nuevoComentario = await Comentario.create({
      user_id: req.user.id,
      nombre: nombre.trim(), calificacion, mensaje: mensaje.trim(), estado: 'pendiente',
    });

    return res.status(201).json({
      mensaje: 'Comentario creado exitosamente, en espera de aprobación',
      comentario: nuevoComentario
    });
  } catch (error) {
    console.error('Error al crear comentario:', error);
    return res.status(500).json({ mensaje: 'Error al crear el comentario' });
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
    return res.status(503).json({ mensaje: 'No se pudieron obtener los comentarios aprobados' });
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
    return res.status(500).json({ mensaje: 'Error al obtener comentarios' });
  }
};

// Actualizar el estado de un comentario (aprobar/rechazar)
const actualizarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ mensaje: 'Identificador inválido' });
    }
    const { estado } = req.body || {};

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
    return res.status(500).json({ mensaje: 'Error al actualizar comentario' });
  }
};

// Eliminar un comentario (para el panel de administración)
const eliminarComentario = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ mensaje: 'Identificador inválido' });
    }

    const comentario = await Comentario.findByPk(id);
    if (!comentario) {
      return res.status(404).json({ mensaje: 'Comentario no encontrado' });
    }

    await comentario.destroy();

    return res.json({ mensaje: 'Comentario eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar comentario:', error);
    return res.status(500).json({ mensaje: 'Error al eliminar comentario' });
  }
};

module.exports = {
  crearComentario,
  obtenerAprobados,
  obtenerTodos,
  actualizarEstado,
  eliminarComentario
};
