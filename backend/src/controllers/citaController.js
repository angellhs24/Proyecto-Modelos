const {
  crearConsulta,
  obtenerConsultasPorClinica,
  obtenerConsultas
} = require('./consultaController');

module.exports = {
  crearCita: crearConsulta,
  obtenerCitasPorClinica: obtenerConsultasPorClinica,
  obtenerCitas: obtenerConsultas
};