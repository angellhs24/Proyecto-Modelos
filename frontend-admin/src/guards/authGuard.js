/**
 * Guard de Autenticación y Rutas para Frontend-Admin
 * Valida la existencia y vigencia de la sesión en sessionStorage o token JWT.
 */
import { getSession, isTokenExpired } from '../core/auth.js';
import { resolvePage, parseHash, buildHash, DEFAULT_PAGE } from '../core/guard.js';

export function checkAuth(hash = window.location.hash) {
  const session = getSession();
  const token = session?.token;

  if (!token || isTokenExpired(token)) {
    return {
      authenticated: false,
      redirect: '#/login',
      reason: 'TOKEN_EXPIRED_OR_MISSING'
    };
  }

  const role = session.podologo?.rol || 'podologo';
  const resolved = resolvePage(hash, role);

  return {
    authenticated: true,
    user: session.podologo,
    role,
    page: resolved.page,
    subpage: resolved.subpage
  };
}

export { resolvePage, parseHash, buildHash, DEFAULT_PAGE };
