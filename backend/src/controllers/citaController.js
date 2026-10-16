const {
  crearConsulta,
  obtenerConsultasPorClinica,
  obtenerConsultas,
  obtenerDisponibilidadHorarios
} = require('./consultaController');

module.exports = {
  crearCita: crearConsulta,
  obtenerCitasPorClinica: obtenerConsultasPorClinica,
  obtenerCitas: obtenerConsultas,
  obtenerDisponibilidadHorarios
};