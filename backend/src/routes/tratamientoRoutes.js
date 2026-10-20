const express = require('express');
const router = express.Router();
const {
  obtenerTratamientosPorConsulta,
  crearTratamiento,
  eliminarTratamiento
} = require('../controllers/tratamientoController');
const { verificarAutenticacion } = require('../middlewares/authMiddleware');

router.use(verificarAutenticacion);

router.get('/consulta/:consulta_id', obtenerTratamientosPorConsulta);
router.post('/', crearTratamiento);
router.delete('/:id', eliminarTratamiento);

module.exports = router;
