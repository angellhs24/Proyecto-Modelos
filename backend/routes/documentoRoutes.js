const express = require('express');
const router = express.Router();
const {
  obtenerDocumentosPorConsulta,
  crearDocumento,
  eliminarDocumento
} = require('../controllers/documentoController');

router.get('/consulta/:consulta_id', obtenerDocumentosPorConsulta);
router.post('/', crearDocumento);
router.delete('/:id', eliminarDocumento);

module.exports = router;
