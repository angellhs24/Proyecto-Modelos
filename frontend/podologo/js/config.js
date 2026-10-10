/**
 * Configuración central del frontend.
 * Todos los endpoints apuntan al backend Node.js/MySQL en http://localhost:4000.
 */
export const API_BASE_URL =
  (typeof window !== 'undefined' && window.__API_BASE_URL__) || 'http://localhost:4000/api';

/** Rutas base de la API REST (una por archivo de rutas del backend). */
export const ENDPOINTS = Object.freeze({
  citas: '/citas',
  clinicas: '/clinicas',
  consultas: '/consultas',
  diagnosticos: '/diagnosticos',
  documentos: '/documentos',
  pacientes: '/pacientes',
  podologos: '/podologos',
  tratamientos: '/tratamientos',
  inventario: '/inventario',
  recetas: '/recetas',
  pagos: '/pagos',
  mapaPodologico: '/mapa-podologico',
  auditoria: '/auditoria',
});

/** Login de podólogos (tabla Podologos: Email + Password_hash). */
export const LOGIN_PATH = `${ENDPOINTS.podologos}/login`;

export const REQUEST_TIMEOUT_MS = 2000;

/** Sesión: expira por inactividad (datos clínicos sensibles). */
export const SESSION_IDLE_MS = 30 * 60 * 1000;
/** Vida máxima absoluta de una sesión, aunque haya actividad (8 h). */
export const SESSION_MAX_MS = 8 * 60 * 60 * 1000;
export const SESSION_STORAGE_KEY = 'efc.session';
export const RETURN_TO_KEY = 'efc.returnTo';
/** Claves de respaldo del módulo de inventario/recetas cuando la API aún no existe. */
export const FALLBACK_STORAGE_PREFIX = 'efc.fallback.';

/** Roles del Control de Acceso Basado en Roles (RBAC). */
export const ROLES = Object.freeze({
  ADMINISTRADOR: 'administrador',
  PODOLOGO: 'podologo',
  RECEPCION: 'recepcion',
});

/** Agenda */
export const AGENDA = Object.freeze({
  DURACION_MIN: 30,
  HORA_INICIO: '09:00',
  HORA_FIN: '19:00',
  PASO_MIN: 30,
  ALERTA_PREVIA_MIN: 60,
});

/**
 * Modo demostración: SOLO se habilita en localhost y únicamente cuando el servidor
 * no responde (error de red). Nunca omite una respuesta 401 real del backend.
 */
export const DEMO = Object.freeze({
  enabled:
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    window.__DISABLE_DEMO__ !== true,
  email: 'demo@clinica.mx',
  password: 'demo1234',
});

/** Cuentas demostrativas por rol (solo para validar el RBAC sin backend). */
export const DEMO_ACCOUNTS = Object.freeze([
  Object.freeze({
    email: 'demo@clinica.mx',
    password: 'demo1234',
    rol: ROLES.PODOLOGO,
    Cedula_podologo: '0000001',
    Nombre: 'Demo',
    ape_paterno: 'Podólogo',
  }),
  Object.freeze({
    email: 'recepcion@clinica.mx',
    password: 'recep1234',
    rol: ROLES.RECEPCION,
    Cedula_podologo: '',
    Nombre: 'Demo',
    ape_paterno: 'Recepción',
  }),
]);
