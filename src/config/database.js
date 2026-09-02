const { Sequelize } = require('sequelize');
const dns = require('dns');

// Forzar la resolución IPv4 primero (útil para Supabase y Node 18+)
dns.setDefaultResultOrder('ipv4first');

// Requerir explícitamente pg para que Vercel empaquete el módulo
require('pg');
require('pg-hstore');

const dbUrl = process.env.DATABASE_URL;
console.log("DB connection target:", dbUrl ? dbUrl.replace(/:[^:@]+@/, ":***@") : "⚠️ DATABASE_URL NOT SET");

if (!dbUrl) {
  console.error("❌ FATAL: DATABASE_URL is not defined. Check .env file or Vercel environment variables.");
}

const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: false, // Cambiar a console.log para ver las queries SQL
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    }
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 10000,
    idle: 20000
  }
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
