const express = require('express');
const router = express.Router();
const {
  crearCita,
  obtenerCitasPorClinica,
  obtenerCitas,
  obtenerDisponibilidadHorarios
} = require('../controllers/citaController');

router.get('/disponibilidad', obtenerDisponibilidadHorarios);
router.get('/clinica/:id_clinica', obtenerCitasPorClinica);
router.get('/', obtenerCitas);
router.post('/', crearCita);

module.exports = router;