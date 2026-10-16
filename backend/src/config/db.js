const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

// Validación de seguridad: Asegurarnos de que las variables existan
if (!process.env.DB_USER || !process.env.DB_PASSWORD) {
  console.error('CRÍTICO: Faltan las credenciales de la base de datos en el archivo .env');
  process.exit(1); // Detiene la aplicación si no hay credenciales seguras
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
});

// Verificar conexión al iniciar
pool.getConnection()
  .then(connection => {
    console.log(`✅ Conectado exitosamente a MySQL como el usuario: ${process.env.DB_USER}`);
    connection.release();
  })
  .catch(err => {
    console.error('❌ Error al conectar con MySQL:', err.message);
  });

module.exports = {
  query: async (sql, params) => {
    const [rows, fields] = await pool.query(sql, params);
    return { rows, fields };
  },
  pool
};