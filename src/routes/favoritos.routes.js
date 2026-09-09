const express = require('express');
const router = express.Router();
const { getFavoritos, addFavorito, removeFavorito } = require('../controllers/favoritos.controller');
const auth = require('../middlewares/auth');

// All routes require authentication
router.get('/', auth, getFavoritos);
router.post('/', auth, addFavorito);
router.delete('/:rawgGameId', auth, removeFavorito);

module.exports = router;
