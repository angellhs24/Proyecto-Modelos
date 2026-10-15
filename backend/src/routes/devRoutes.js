const express = require('express');
const router = express.Router();
const { devLogin } = require('../controllers/devAuthController');

/**
 * Rutas temporales de desarrollo para simulación rápida de sesiones
 * POST /api/dev/login
 * GET  /api/dev/login (útil para pruebas directas desde navegador o enlaces rápidos)
 */
router.post('/login', devLogin);
router.get('/login', devLogin);

module.exports = router;
