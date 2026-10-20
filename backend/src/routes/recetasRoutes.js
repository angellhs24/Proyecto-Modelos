const express = require('express');
const router = express.Router();
const {
  crearReceta,
  obtenerRecetaPorConsultaId,
  obtenerRecetaPorId,
  obtenerRecetas,
  generarRecetaPDF,
  generarRecetaPDFPorConsulta,
  eliminarReceta
} = require('../controllers/recetasController');
const { verificarAutenticacion } = require('../middlewares/authMiddleware');

/**
 * Middleware RBAC de Emisión de Recetas:
 * Únicamente el Podólogo (Rol ID: 4) puede crear y emitir recetas médicas.
 * Administrador (Rol ID: 1) y Recepcionista (Rol ID: 3) deben recibir 403 Forbidden al intentar POST.
 */
function requerirPodologoParaEmitirReceta(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'No autorizado: Se requiere una sesión activa con token válido para emitir recetas.',
      requiere_login: true
    });
  }

  // Detectar rol de usuario exclusivamente desde el token validado en req.user
  const rolId = Number(
    req.user.fk_rol_id ||
    req.user.rolId ||
    req.user.rol_id
  );
  const rolNombre = String(req.user.rol || req.user.nombre_rol || '').toLowerCase();

  // Rol ID 4: Podólogo
  const esPodologo = rolId === 4 || rolNombre.includes('podolog') || rolNombre.includes('médico') || rolNombre.includes('medico');

  if (!esPodologo) {
    return res.status(403).json({
      error: 'Acceso denegado: Solo el Podólogo (Rol ID: 4) está autorizado para crear y emitir recetas médicas.',
      rol_denegado: rolId,
      rol_actual: req.user.rol || 'No autorizado',
      codigo: 'RBAC_SOLO_PODOLOGO'
    });
  }

  next();
}

/**
 * Middleware RBAC de Consulta y Lectura de Recetas:
 * Autoriza a Podólogo (Rol ID: 4), Recepcionista (Rol ID: 3) y Administrador (Rol ID: 1).
 * Bloquea a roles externos o pacientes sin permisos.
 */
function permitirLecturaRecetas(req, res, next) {
  // En rutas PDF abiertas en pestaña nueva, si no hay req.user permitir pasar si no hay sesión
  // o si viene token en query
  if (!req.user) {
    // Si es endpoint PDF, permitir visualización médica directa para impresión
    if (req.path.endsWith('/pdf')) {
      return next();
    }
    return res.status(401).json({
      error: 'No autorizado: Se requiere token de sesión activo.',
      requiere_login: true
    });
  }

  const rolId = Number(
    req.user.fk_rol_id ||
    req.user.rolId ||
    req.user.rol_id
  );

  const rolesPermitidos = [1, 3, 4]; // Admin, Recepcionista, Podólogo
  if (rolId && !rolesPermitidos.includes(rolId)) {
    return res.status(403).json({
      error: 'Acceso denegado: Tu rol no tiene permisos para consultar recetas médicas.',
      rol_denegado: rolId
    });
  }

  next();
}

/**
 * Middleware para endpoints PDF: Permite autenticación por token Bearer, query param ?token=...
 * o visualización directa desde la ventana de impresión del navegador.
 */
function autenticacionOpcionalParaPDF(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  const tieneIdentidad = token || req.headers['x-usuario-id'] || req.headers['x-user-id'];

  if (tieneIdentidad) {
    return verificarAutenticacion(req, res, (err) => {
      if (err) return next(err);
      permitirLecturaRecetas(req, res, next);
    });
  }

  // Si se abre directamente en nueva pestaña o iframe del navegador para imprimir
  next();
}

// ============================================================================
// RUTAS DE RECETAS MÉDICAS DIGITALES
// ============================================================================

// 1. POST /api/recetas: Guardar nueva receta (SOLO Podólogo Rol ID: 4)
router.post('/', verificarAutenticacion, requerirPodologoParaEmitirReceta, crearReceta);

// 2. GET /api/recetas/consulta/:id: Obtener la receta de una consulta específica
router.get('/consulta/:id', verificarAutenticacion, permitirLecturaRecetas, obtenerRecetaPorConsultaId);

// 3. GET /api/recetas/consulta/:id/pdf: Generar/Ver PDF membretado por ID de consulta
router.get('/consulta/:id/pdf', autenticacionOpcionalParaPDF, generarRecetaPDFPorConsulta);

// 4. GET /api/recetas/:id/pdf: Generar/Ver PDF membretado por Folio de receta
router.get('/:id/pdf', autenticacionOpcionalParaPDF, generarRecetaPDF);

// 5. GET /api/recetas/:id: Obtener receta por Folio (ID de receta)
router.get('/:id', verificarAutenticacion, permitirLecturaRecetas, obtenerRecetaPorId);

// 6. GET /api/recetas: Listar todas las recetas con filtros
router.get('/', verificarAutenticacion, permitirLecturaRecetas, obtenerRecetas);

// 7. DELETE /api/recetas/:id: Eliminar receta médica (SOLO Podólogo Rol ID: 4)
router.delete('/:id', verificarAutenticacion, requerirPodologoParaEmitirReceta, eliminarReceta);

module.exports = router;
