const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false, // Cambiar a console.log para ver las queries SQL
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL Conectado exitosamente');
  } catch (error) {
    console.error('Error al conectar a PostgreSQL:', error.message);
  }
};

module.exports = { sequelize, connectDB };
