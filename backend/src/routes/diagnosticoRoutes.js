const express = require('express');
const router = express.Router();
const {
  obtenerDiagnosticosPorConsulta,
  crearDiagnostico,
  eliminarDiagnostico
} = require('../controllers/diagnosticoController');
const { verificarAutenticacion } = require('../middlewares/authMiddleware');

router.use(verificarAutenticacion);

router.get('/consulta/:consulta_id', obtenerDiagnosticosPorConsulta);
router.post('/', crearDiagnostico);
router.delete('/:id', eliminarDiagnostico);

module.exports = router;
