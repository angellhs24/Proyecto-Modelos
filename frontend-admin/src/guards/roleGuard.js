/**
 * Guard de Roles (RBAC) para Frontend-Admin
 * Valida los permisos de las vistas según el rol del usuario (admin, recepcionista, podologo).
 */
import { hasRole, canAccessRoute, getAccessibleViews } from '../../js/core/rbac.js';

export function checkRole(userRole, requiredRoles = []) {
  if (!userRole) return false;
  if (userRole === 'admin') return true;
  return requiredRoles.includes(userRole);
}

export { hasRole, canAccessRoute, getAccessibleViews };
