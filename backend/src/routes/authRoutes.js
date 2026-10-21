const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verificarAutenticacion } = require('../middlewares/authMiddleware');

// Login de usuario
router.post('/login', authController.login);

// Logout de usuario (invalida cookie HttpOnly)
router.post('/logout', authController.logout);

// Recuperación de contraseña en 3 pasos con token y código de 6 dígitos
router.post('/recuperar-password', authController.recuperarPassword);
router.post('/verificar-codigo', authController.verificarCodigoRecuperacion);
router.post('/restablecer-password', authController.restablecerPassword);

// Información del usuario autenticado
router.get('/me', verificarAutenticacion, authController.obtenerPerfilActual);

// Listar usuarios demo para pruebas y cambio rápido de rol
router.get('/demo-usuarios', authController.listarUsuariosDemostracion);

module.exports = router;

