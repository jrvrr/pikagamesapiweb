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

// Rutas base
app.get('/', (req, res) => {
  res.send('API de apikaweb funcionando correctamente (PostgreSQL)');
});

app.use('/api/auth', authRoutes);
app.use('/api/videojuegos', videojuegoRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/comentarios', comentarioRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
