/**
 * Middleware para autorización RBAC según rol del usuario
 */
function checkRole(rolesPermitidos = []) {
  const permitidos = Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        error: 'AUTENTICACION_REQUERIDA',
        mensaje: 'Debe iniciar sesión para acceder a este recurso.'
      });
    }

    const rolUsuario = (req.user.nombre_rol || req.user.rol || '').toLowerCase();

    // El Administrador siempre tiene acceso total
    if (rolUsuario === 'administrador' || rolUsuario === 'admin') {
      return next();
    }

    const tienePermiso = permitidos.some(r => r.toLowerCase() === rolUsuario);

    if (!tienePermiso) {
      return res.status(403).json({
        ok: false,
        error: 'ACCESO_DENEGADO',
        mensaje: `Acceso restringido. Su rol (${rolUsuario}) no tiene permisos para esta acción.`
      });
    }

    next();
  };
}

module.exports = {
  checkRole,
  requerirRol: checkRole,
  requerirAdmin: checkRole(['administrador', 'admin']),
  requerirRecepcionista: checkRole(['recepcionista', 'recepcion']),
  requerirPodologo: checkRole(['podologo', 'medico'])
};
