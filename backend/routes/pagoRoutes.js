const express = require('express');
const router = express.Router();
const {
  obtenerPagos,
  obtenerResumenFinanciero,
  obtenerPagoPorId,
  crearPago,
  actualizarPago,
  eliminarPago
} = require('../controllers/pagoController');

router.get('/', obtenerPagos);
router.get('/resumen', obtenerResumenFinanciero);
router.get('/:id', obtenerPagoPorId);
router.post('/', crearPago);
router.put('/:id', actualizarPago);
router.delete('/:id', eliminarPago);

module.exports = router;
