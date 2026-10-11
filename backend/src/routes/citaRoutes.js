const express = require('express');
const router = express.Router();
const { crearCita, obtenerCitasPorClinica } = require('../controllers/citaController');

router.post('/', crearCita);
router.get('/clinica/:id_clinica', obtenerCitasPorClinica);

module.exports = router;