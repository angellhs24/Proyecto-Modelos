const express = require('express');
const router = express.Router();
const recepcionistaController = require('../controllers/recepcionistaController');
const {
  verificarAutenticacion,
  requerirRol,
  bloquearTablasClinicasParaRecepcionista
} = require('../middlewares/authMiddleware');

/**
 * Cadena de middlewares obligatoria para todas las rutas de Recepción:
 * 1. Autenticación activa
 * 2. Validación estricta de Rol: Recepcionista (Rol ID: 3) [o Admin 1]
 * 3. Restricción crítica de seguridad: Bloqueo de acceso a tablas Diagnosticos,
 *    Tratamientos, Recetas y Detalles_Mapa_Podologico.
 */
router.use(verificarAutenticacion);
router.use(requerirRol([3, 1])); // Recepcionista (3) y Admin (1)
router.use(bloquearTablasClinicasParaRecepcionista);

// -------------------------------------------------------------------------
// 1. REGISTRO DE PACIENTES (Exclusivamente datos de contacto y filiación)
// -------------------------------------------------------------------------
router.post('/pacientes', recepcionistaController.registrarPacienteContacto);
router.get('/pacientes', recepcionistaController.obtenerPacientesContacto);
router.get('/pacientes/:expediente', recepcionistaController.obtenerPacienteContactoPorExpediente);

// -------------------------------------------------------------------------
// 2. AGENDA GLOBAL (CRUD de Consultas de todos los médicos)
// -------------------------------------------------------------------------
router.get('/consultas', recepcionistaController.obtenerConsultasGlobal);
router.post('/consultas', recepcionistaController.crearConsulta);
router.put('/consultas/:id', recepcionistaController.actualizarConsulta);
router.delete('/consultas/:id', recepcionistaController.eliminarConsulta);
router.get('/catalogos', recepcionistaController.obtenerCatalogosAgenda);

// -------------------------------------------------------------------------
// 3. MÓDULO DE COBROS (Procesamiento en Pagos con fk_recepcionista_id)
// -------------------------------------------------------------------------
router.get('/cobros/pendientes', recepcionistaController.obtenerConsultasPendientesCobro);
router.get('/cobros', recepcionistaController.obtenerHistorialCobros);
router.post('/cobros', recepcionistaController.procesarCobro);
router.get('/cobros/:id/recibo', recepcionistaController.obtenerDetalleRecibo);

// -------------------------------------------------------------------------
// 4. ENDPOINT DE PRUEBA DE SEGURIDAD (Simulación de violación RBAC)
// -------------------------------------------------------------------------
router.get('/prueba-bloqueo/diagnosticos', (req, res) => {
  // Este endpoint nunca debería alcanzarse porque el middleware bloquearTablasClinicasParaRecepcionista
  // interceptará la URL y retornará 403 Forbidden
  res.json({ error: 'Falla de seguridad: No se aplicó el middleware de bloqueo' });
});

module.exports = router;
