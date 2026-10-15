const express = require('express');
const router = express.Router();
const {
  obtenerInventario,
  obtenerArticuloPorId,
  crearArticulo,
  actualizarArticulo,
  eliminarArticulo,
  registrarMovimiento,
  obtenerMovimientos
} = require('../controllers/inventarioController');

const { verificarAutenticacion } = require('../middlewares/authMiddleware');

/**
 * Middleware RBAC: Autoriza exclusivamente a Administradores (Rol ID: 1)
 * y Recepcionistas (Rol ID: 3) para operaciones de escritura en Inventario.
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
      error: 'Acceso denegado (RBAC): Solo los roles Administrador (Rol ID: 1) y Recepcionista (Rol ID: 3) tienen permisos para crear, editar o eliminar insumos del inventario.',
      rol_actual: req.user.rol || req.user.nombre_rol || 'Desconocido',
      rol_id: rolId
    });
  }

  next();
}

/**
 * Todas las rutas de inventario requieren autenticación activa
 */
router.use(verificarAutenticacion);

/**
 * --------------------------------------------------------------------------
 * Rutas de Lectura (GET) - Disponibles para usuarios autenticados autorizados
 * --------------------------------------------------------------------------
 */
router.get('/', obtenerInventario);
router.get('/movimientos', obtenerMovimientos);
router.get('/:id', obtenerArticuloPorId);

/**
 * --------------------------------------------------------------------------
 * Rutas de Escritura (POST, PUT, DELETE) - Restringidas estrictamente por RBAC:
 * Solo Administradores y Recepcionistas (Rol ID: 3)
 * --------------------------------------------------------------------------
 */
router.post('/', requerirAdminORecepcionista, crearArticulo);
router.post('/:id/movimientos', requerirAdminORecepcionista, registrarMovimiento);
router.put('/:id', requerirAdminORecepcionista, actualizarArticulo);
router.delete('/:id', requerirAdminORecepcionista, eliminarArticulo);

module.exports = router;
