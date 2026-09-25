const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const videojuegoRoutes = require('./routes/videojuego.routes');
const pedidoRoutes = require('./routes/pedido.routes');
const comentarioRoutes = require('./routes/comentario.routes');
const favoritosRoutes = require('./routes/favoritos.routes');
const paypalRoutes = require('./routes/paypal.routes');

// Rutas base
app.get('/', (req, res) => {
  res.send('API de apikaweb funcionando correctamente (PostgreSQL)');
});

app.use('/api/auth', authRoutes);
app.use('/api/videojuegos', videojuegoRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/comentarios', comentarioRoutes);
app.use('/api/favoritos', favoritosRoutes);
app.use('/api/paypal', paypalRoutes);

// Sync database (creates new tables like favoritos if they don't exist)
const { sequelize } = require('./models');
sequelize.sync({ alter: true }).then(() => {
  console.log('Base de datos sincronizada');
}).catch(err => {
  console.error('Error al sincronizar la base de datos:', err.message);
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
  });
}

module.exports = app;
