const express = require('express');
const router = express.Router();
const {
  obtenerConsultas,
  obtenerConsultasPorClinica,
  obtenerDetalleConsulta,
  crearConsulta,
  actualizarConsulta,
  eliminarConsulta
} = require('../controllers/consultaController');

router.get('/', obtenerConsultas);
router.get('/clinica/:id_clinica', obtenerConsultasPorClinica);
router.get('/:id/detalle', obtenerDetalleConsulta);
router.get('/:id', obtenerDetalleConsulta);
router.post('/', crearConsulta);
router.put('/:id', actualizarConsulta);
router.delete('/:id', eliminarConsulta);

module.exports = router;
