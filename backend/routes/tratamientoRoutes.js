const express = require('express');
const router = express.Router();
const {
  obtenerTratamientosPorConsulta,
  crearTratamiento,
  eliminarTratamiento
} = require('../controllers/tratamientoController');

router.get('/consulta/:consulta_id', obtenerTratamientosPorConsulta);
router.post('/', crearTratamiento);
router.delete('/:id', eliminarTratamiento);

module.exports = router;
