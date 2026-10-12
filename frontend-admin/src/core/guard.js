/** Protección de rutas y utilidades de hash-routing (puras, testeables). */
import { canAccessPage } from './rbac.js';

export const PUBLIC_PAGES = Object.freeze(['login']);
export const PROTECTED_PAGES = Object.freeze([
  'inicio',
  'agenda',
  'pacientes',
  'consulta',
  'agendar',
  'reportes',
  'expediente',
  'recetas',
  'inventario',
  'mapa',
  'pagos',
  'auditoria',
]);
export const DEFAULT_PAGE = 'inicio';

/**
 * Decide qué página mostrar según la autenticación y el rol.
 * Si `role` no se indica, solo se valida la autenticación (compatibilidad retroactiva).
 * @returns {{ page: string, redirected: boolean, reason: string|null }}
 */
export function resolvePage(requested, authenticated, role) {
  const page = requested || DEFAULT_PAGE;
  if (!authenticated) {
    if (PUBLIC_PAGES.includes(page)) return { page, redirected: false, reason: null };
    return { page: 'login', redirected: true, reason: 'auth-required' };
  }
  if (PUBLIC_PAGES.includes(page)) return { page: DEFAULT_PAGE, redirected: true, reason: 'already-authenticated' };
  if (!PROTECTED_PAGES.includes(page)) return { page: DEFAULT_PAGE, redirected: true, reason: 'unknown-page' };
  if (role !== undefined && !canAccessPage(role, page)) {
    return { page: DEFAULT_PAGE, redirected: true, reason: 'forbidden-role' };
  }
  return { page, redirected: false, reason: null };
}

const PARAM_RE = /^[A-Za-z0-9_.\-]{1,64}$/;

/** '#/expediente/2026140001' -> { page:'expediente', params:['2026140001'] } (parámetros en lista blanca). */
export function parseHash(hash = '') {
  const clean = String(hash).replace(/^#\/?/, '').split('?')[0];
  if (!clean) return { page: null, params: [] };
  const decoded = clean
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return '';
      }
    });
  const [page, ...rest] = decoded;
  if (!page || !/^[a-z]{1,24}$/.test(page)) return { page: null, params: [] };
  return { page, params: rest.filter((p) => PARAM_RE.test(p)) };
}

export function buildHash(page, ...params) {
  return `#/${[page, ...params].filter((p) => p !== undefined && p !== null && p !== '').map(encodeURIComponent).join('/')}`;
}
