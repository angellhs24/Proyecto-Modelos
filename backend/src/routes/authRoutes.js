const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verificarAutenticacion } = require('../middlewares/authMiddleware');

// Login de usuario
router.post('/login', authController.login);

// Logout de usuario (invalida cookie HttpOnly)
router.post('/logout', authController.logout);

// Recuperar contraseña
router.post('/recuperar-password', authController.recuperarPassword);

// Información del usuario autenticado
router.get('/me', verificarAutenticacion, authController.obtenerPerfilActual);

// Listar usuarios demo para pruebas y cambio rápido de rol
router.get('/demo-usuarios', authController.listarUsuariosDemostracion);

module.exports = router;

