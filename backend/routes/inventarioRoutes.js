const express = require('express');
const router = express.Router();
const {
  obtenerInventario,
  obtenerArticuloPorId,
  crearArticulo,
  actualizarArticulo,
  eliminarArticulo,
  registrarMovimiento,
  obtenerMovimientos
} = require('../controllers/inventarioController');

router.get('/', obtenerInventario);
router.get('/movimientos', obtenerMovimientos);
router.get('/:id', obtenerArticuloPorId);
router.post('/', crearArticulo);
router.post('/:id/movimientos', registrarMovimiento);
router.put('/:id', actualizarArticulo);
router.delete('/:id', eliminarArticulo);

module.exports = router;
