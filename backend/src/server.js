const app = require('./app');
const db = require('./config/db');
require('dotenv').config();

const PORT = process.env.PORT || 4000;

app.listen(PORT, async () => {
  console.log(`🚀 Servidor de Podología corriendo en el puerto ${PORT}`);
  try {
    const res = await db.query('SELECT NOW() AS hora_actual');
    console.log(' Conexión exitosa a MySQL (Clinica_Podologia):', res.rows[0].hora_actual);
  } catch (error) {
    console.error(' Error al conectar con MySQL:', error.message);
  }
});