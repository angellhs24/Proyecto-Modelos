const express = require('express');
const router = express.Router();
const {
  obtenerPodologos,
  obtenerPodologoPorCedula,
  loginPodologo,
  registrarPodologo
} = require('../controllers/podologoController');

router.get('/', obtenerPodologos);
router.get('/:cedula', obtenerPodologoPorCedula);
router.post('/login', loginPodologo);
router.post('/registro', registrarPodologo);

module.exports = router;
