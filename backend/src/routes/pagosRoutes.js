const express = require('express');
const router = express.Router();
const {
  obtenerConsultasPendientesPago,
  procesarCobro,
  obtenerHistorialCobros,
  obtenerResumenCaja
} = require('../controllers/pagosController');
const { verificarAutenticacion } = require('../middlewares/authMiddleware');

/**
 * Middleware RBAC para Pagos y Caja:
 * Permite acceso exclusivamente a Administradores (Rol ID: 1) y Recepcionistas (Rol ID: 3).
 * Bloquea estrictamente a Podólogos (Rol ID: 4) y Clientes (Rol ID: 2) con código 403 Forbidden.
 */
function requerirAdminORecepcionista(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'No autorizado: Se requiere una sesión activa con token válido.',
      requiere_login: true
    });
  }

  const rolId = Number(req.user.fk_rol_id || req.user.rolId || req.user.rol_id);
  const rolNombre = String(req.user.rol || req.user.nombre_rol || '').toLowerCase();

  const esAdmin = rolId === 1 || rolNombre.includes('admin');
  const esRecepcionista = rolId === 3 || rolNombre.includes('recepc');

  if (!esAdmin && !esRecepcionista) {
    return res.status(403).json({
      error: 'Acceso denegado (RBAC): Solo los roles Administrador (Rol ID: 1) y Recepcionista (Rol ID: 3) tienen acceso al módulo de caja y cobros. Los médicos y podólogos no tienen autorización para procesar pagos.',
      rol_actual: req.user.rol || req.user.nombre_rol || 'Desconocido',
      rol_id: rolId
    });
  }

  next();
}

/**
 * Cadena de middlewares obligatoria:
 * 1. Autenticación con token activo
 * 2. Validación de Rol Admin (1) o Recepcionista (3)
 */
router.use(verificarAutenticacion);
router.use(requerirAdminORecepcionista);

/**
 * --------------------------------------------------------------------------
 * Endpoints del Módulo de Pagos y Caja
 * --------------------------------------------------------------------------
 */

// GET: Para listar consultas médicas atendidas con estado_pago 'Pendiente'
router.get('/', obtenerConsultasPendientesPago);
router.get('/pendientes', obtenerConsultasPendientesPago);

// Métricas de Caja del Día (KPIs) e Historial
router.get('/resumen-caja', obtenerResumenCaja);
router.get('/historial', obtenerHistorialCobros);

// POST o PUT: Para procesar un cobro (actualiza estado_pago a 'Pagado')
router.post('/', procesarCobro);
router.post('/cobrar', procesarCobro);
router.put('/:id', procesarCobro);
router.put('/:id/cobrar', procesarCobro);

module.exports = router;
