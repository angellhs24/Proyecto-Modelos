/**
 * Punto de entrada principal del servidor backend (Express + MySQL)
 * Podología Profesional & Elite Foot Care
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const app = require('./app');
const PORT = process.env.PORT || 4000;

// Si se ejecuta directamente (ej. 'node server.js' o 'node backend/src/server.js')
if (require.main === module) {
  if (typeof app.startServer === 'function') {
    app.startServer(PORT);
  } else {
    app.listen(PORT, () => {
      console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}/`);
      console.log(`🏥 Página de la Clínica: http://localhost:${PORT}/`);
      console.log(`🔐 Acceso al Personal (Login): http://localhost:${PORT}/login\n`);
    });
  }
}

module.exports = app;