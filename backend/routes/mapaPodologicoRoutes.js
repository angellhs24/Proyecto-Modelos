const express = require('express');
const router = express.Router();
const {
  obtenerDetallesMapa,
  obtenerPorConsulta,
  crearDetalleMapa,
  actualizarDetalleMapa,
  eliminarDetalleMapa,
  limpiarMapaPorConsulta
} = require('../controllers/mapaPodologicoController');

router.get('/', obtenerDetallesMapa);
router.get('/consulta/:consulta_id', obtenerPorConsulta);
router.post('/', crearDetalleMapa);
router.put('/:id', actualizarDetalleMapa);
router.delete('/:id', eliminarDetalleMapa);
router.delete('/consulta/:consulta_id', limpiarMapaPorConsulta);

module.exports = router;
