const express = require('express');
const router = express.Router();
const {
  obtenerPacientes,
  obtenerPacientePorExpediente,
  crearPaciente,
  buscarOCrearPaciente,
  actualizarPaciente,
  eliminarPaciente
} = require('../controllers/pacienteController');

router.get('/', obtenerPacientes);
router.get('/:no_expediente', obtenerPacientePorExpediente);
router.post('/', crearPaciente);
router.post('/expres', crearPaciente);
router.post('/buscar-o-crear', buscarOCrearPaciente);
router.put('/:no_expediente', actualizarPaciente);
router.delete('/:no_expediente', eliminarPaciente);

module.exports = router;