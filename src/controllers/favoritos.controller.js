const { Favorito } = require('../models');

const getFavoritos = async (req, res) => {
  try {
    const favoritos = await Favorito.findAll({
      where: { usuario_id: req.user.id },
      order: [['created_at', 'DESC']]
    });

    // Map to the Game format expected by the frontend
    const games = favoritos.map(f => ({
      id: f.rawg_game_id,
      name: f.game_name,
      background_image: f.game_image,
      rating: f.game_rating,
      released: f.game_released,
    }));

    res.json({ favoritos: games });
  } catch (error) {
    console.error('Error al obtener favoritos:', error);
    res.status(500).json({ message: 'Error al obtener favoritos', error: error.message });
  }
};

const addFavorito = async (req, res) => {
  try {
    const { rawg_game_id, game_name, game_image, game_rating, game_released } = req.body;

    if (!rawg_game_id || !game_name) {
      return res.status(400).json({ message: 'rawg_game_id y game_name son requeridos' });
    }

    const [favorito, created] = await Favorito.findOrCreate({
      where: {
        usuario_id: req.user.id,
        rawg_game_id: rawg_game_id,
      },
      defaults: {
        usuario_id: req.user.id,
        rawg_game_id,
        game_name,
        game_image: game_image || null,
        game_rating: game_rating || null,
        game_released: game_released || null,
      }
    });

    if (!created) {
      return res.status(200).json({ message: 'El juego ya está en favoritos', favorito });
    }

    res.status(201).json({ message: 'Juego agregado a favoritos', favorito });
  } catch (error) {
    console.error('Error al agregar favorito:', error);
    res.status(500).json({ message: 'Error al agregar favorito', error: error.message });
  }
};

const removeFavorito = async (req, res) => {
  try {
    const { rawgGameId } = req.params;

    const deleted = await Favorito.destroy({
      where: {
        usuario_id: req.user.id,
        rawg_game_id: parseInt(rawgGameId),
      }
    });

    if (deleted === 0) {
      return res.status(404).json({ message: 'Favorito no encontrado' });
    }

    res.json({ message: 'Juego eliminado de favoritos' });
  } catch (error) {
    console.error('Error al eliminar favorito:', error);
    res.status(500).json({ message: 'Error al eliminar favorito', error: error.message });
  }
};

module.exports = { getFavoritos, addFavorito, removeFavorito };
