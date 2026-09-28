const { Favorito } = require('../models');

const getFavoritos = async (req, res) => {
  try {
    const favoritos = await Favorito.findAll({
      where: { usuario_id: req.user.id },
      order: [['created_at', 'DESC']],
    });
    res.json({ favoritos: favoritos.map((f) => ({
      id: f.rawg_game_id, name: f.game_name, background_image: f.game_image,
      rating: f.game_rating, released: f.game_released,
    })) });
  } catch (error) {
    console.error('Error al obtener favoritos:', error.message);
    res.status(503).json({ message: 'No se pudieron cargar los favoritos de la cuenta' });
  }
};

const addFavorito = async (req, res) => {
  const { rawg_game_id, game_name, game_image = null, game_rating = null, game_released = null } = req.body || {};
  if (!Number.isSafeInteger(rawg_game_id) || rawg_game_id < 1 || typeof game_name !== 'string' ||
      !game_name.trim() || game_name.trim().length > 300 ||
      (game_image !== null && typeof game_image !== 'string') ||
      (game_rating !== null && (typeof game_rating !== 'number' || !Number.isFinite(game_rating))) ||
      (game_released !== null && (typeof game_released !== 'string' || game_released.length > 50))) {
    return res.status(400).json({ message: 'Datos de favorito inválidos' });
  }
  try {
    const [favorito, created] = await Favorito.findOrCreate({
      where: { usuario_id: req.user.id, rawg_game_id },
      defaults: { usuario_id: req.user.id, rawg_game_id, game_name: game_name.trim(), game_image, game_rating, game_released },
    });
    return res.status(created ? 201 : 200).json({ message: created ? 'Juego agregado a favoritos' : 'El juego ya está en favoritos', favorito });
  } catch (error) {
    console.error('Error al agregar favorito:', error.message);
    return res.status(503).json({ message: 'No se pudo guardar el favorito de la cuenta' });
  }
};

const removeFavorito = async (req, res) => {
  const id = Number(req.params.rawgGameId);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'ID de juego inválido' });
  try {
    await Favorito.destroy({ where: { usuario_id: req.user.id, rawg_game_id: id } });
    return res.json({ message: 'Juego eliminado de favoritos' });
  } catch (error) {
    console.error('Error al eliminar favorito:', error.message);
    return res.status(503).json({ message: 'No se pudo eliminar el favorito de la cuenta' });
  }
};

module.exports = { getFavoritos, addFavorito, removeFavorito };
