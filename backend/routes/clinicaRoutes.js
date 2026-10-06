const express = require('express');
const router = express.Router();
const {
  obtenerClinicas,
  obtenerClinicaPorId,
  crearClinica,
  actualizarClinica,
  eliminarClinica
} = require('../controllers/clinicaController');

router.get('/', obtenerClinicas);
router.get('/:id', obtenerClinicaPorId);
router.post('/', crearClinica);
router.put('/:id', actualizarClinica);
router.delete('/:id', eliminarClinica);

module.exports = router;