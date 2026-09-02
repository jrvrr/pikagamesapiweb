const express = require('express');
const router = express.Router();
const comentarioController = require('../controllers/comentario.controller');
const auth = require('../middlewares/auth');
const admin = require('../middlewares/admin');

// Rutas públicas
router.post('/', auth, comentarioController.crearComentario); // Asumimos que debes estar logueado para comentar
router.get('/', comentarioController.obtenerAprobados); // Cualquiera puede ver los comentarios aprobados

// Rutas de administración
router.get('/admin', auth, admin, comentarioController.obtenerTodos);
router.put('/admin/:id/estado', auth, admin, comentarioController.actualizarEstado);
router.delete('/admin/:id', auth, admin, comentarioController.eliminarComentario);

module.exports = router;
