const express = require('express');
const router = express.Router();
const {
  obtenerLogs,
  crearLog,
  obtenerEstadisticas
} = require('../controllers/auditoriaController');

router.get('/', obtenerLogs);
router.get('/estadisticas', obtenerEstadisticas);
router.post('/', crearLog);

module.exports = router;
