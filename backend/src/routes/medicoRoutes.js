const express = require('express');
const router = express.Router();
const podologoController = require('../controllers/podologoController');
const {
  verificarAutenticacion,
  requerirRol,
  bloquearPagosInventarioParaPodologo
} = require('../middlewares/authMiddleware');

/**
 * Cadena de middlewares obligatoria para todas las rutas médicas del Podólogo:
 * 1. Autenticación activa
 * 2. Validación estricta de Rol: Podólogo (Rol ID: 4) [o Admin 1]
 * 3. Restricción crítica de seguridad: Bloqueo de operaciones INSERT/UPDATE
 *    en las tablas Pagos e Inventario.
 */
router.use(verificarAutenticacion);
router.use(requerirRol([4, 1])); // Podólogo (4) y Admin (1)
router.use(bloquearPagosInventarioParaPodologo);

// -------------------------------------------------------------------------
// 1. AGENDA PERSONAL (Solo visualiza citas con su fk_cedula_podologo)
// -------------------------------------------------------------------------
router.get('/agenda', podologoController.obtenerAgendaPersonal);
router.put('/consultas/:id/estado', podologoController.actualizarEstadoConsulta);
router.put('/consultas/:id/exploracion', podologoController.registrarExploracionFisica);

// -------------------------------------------------------------------------
// 2. EXPEDIENTE CLÍNICO
// -------------------------------------------------------------------------
router.get('/expediente/:expediente', podologoController.obtenerExpedienteClinico);
router.put('/pacientes/:expediente/clinico', podologoController.actualizarHistorialClinico);

// Diagnósticos
router.get('/consultas/:id/diagnosticos', podologoController.obtenerDiagnosticosConsulta);
router.post('/consultas/:id/diagnosticos', podologoController.agregarDiagnostico);
router.delete('/diagnosticos/:diagId', podologoController.eliminarDiagnostico);

// Tratamientos
router.get('/consultas/:id/tratamientos', podologoController.obtenerTratamientosConsulta);
router.post('/consultas/:id/tratamientos', podologoController.agregarTratamiento);
router.delete('/tratamientos/:tratId', podologoController.eliminarTratamiento);

// Recetas
router.get('/consultas/:id/recetas', podologoController.obtenerRecetasConsulta);
router.post('/consultas/:id/recetas', podologoController.crearReceta);

// -------------------------------------------------------------------------
// 3. MAPA PODOLÓGICO INTERACTIVO (Detalles_Mapa_Podologico)
// -------------------------------------------------------------------------
router.get('/consultas/:id/mapa', podologoController.obtenerMapaConsulta);
router.post('/consultas/:id/mapa', podologoController.registrarDetalleMapa);
router.delete('/mapa/:mapaId', podologoController.eliminarDetalleMapa);

// -------------------------------------------------------------------------
// 4. ENDPOINTS DE PRUEBA DE SEGURIDAD (Simulación de violación RBAC)
// -------------------------------------------------------------------------
router.post('/prueba-bloqueo/pagos', (req, res) => {
  // Este endpoint nunca debería alcanzarse porque el middleware bloquearPagosInventarioParaPodologo
  // interceptará la petición POST y retornará 403 Forbidden
  res.json({ error: 'Falla de seguridad: No se aplicó el middleware de bloqueo de Pagos' });
});

router.post('/prueba-bloqueo/inventario', (req, res) => {
  res.json({ error: 'Falla de seguridad: No se aplicó el middleware de bloqueo de Inventario' });
});

module.exports = router;
