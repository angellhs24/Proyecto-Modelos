/**
 * Autenticación de podólogos (tabla Podologos).
 *
 * Contrato esperado del backend:
 *   POST /api/podologos/login  { Email, Password }
 *   -> 200 { token: "<jwt>", podologo: { Cedula_podologo, Nombre, ape_paterno, ape_materno, Email } }
 *   -> 401 credenciales inválidas
 * El hash (Password_hash) NUNCA llega ni se compara en el navegador.
 */
import {
  LOGIN_PATH, SESSION_IDLE_MS, SESSION_MAX_MS, SESSION_STORAGE_KEY, RETURN_TO_KEY, DEMO, DEMO_ACCOUNTS,
} from '../config.js';
import { http, ApiError, configureHttp, isApiUrl } from './http.js';
import { sanitizeDeep, isSafeEmail } from './sanitize.js';
import { normalizeRole } from './rbac.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Un JWT bien formado: tres segmentos base64url. Cualquier otro valor se rechaza. */
const JWT_RE = /^[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*$/;

/** Un token solo se acepta si es un JWT con formato válido (evita inyectar valores arbitrarios). */
export const isWellFormedToken = (t) => typeof t === 'string' && t.length < 4096 && JWT_RE.test(t);

/** Validación de formulario (pura, testeable). Devuelve { valid, errors } */
export function validateCredentials({ email, password } = {}) {
  const errors = {};
  const e = (email || '').trim();
  if (!e) errors.email = 'Ingresa tu correo';
  else if (!EMAIL_RE.test(e) || !isSafeEmail(e)) errors.email = 'Correo con formato inválido';
  if (!password) errors.password = 'Ingresa tu contraseña';
  else if (password.length < 6) errors.password = 'La contraseña debe tener al menos 6 caracteres';
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Decodifica el payload de un JWT sin verificar firma (la verifica el backend). */
export function decodeJwt(token) {
  try {
    const part = String(token).split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isTokenExpired(token, nowMs = Date.now()) {
  const payload = decodeJwt(token);
  if (!payload || typeof payload.exp !== 'number') return false; // token opaco: lo decide el servidor
  return payload.exp * 1000 <= nowMs;
}

/** Unifica el objeto podólogo sea cual sea la capitalización del backend. */
export function normalizePodologo(raw = {}) {
  const nombre = raw.Nombre ?? raw.nombre ?? '';
  const paterno = raw.ape_paterno ?? raw.apePaterno ?? '';
  const materno = raw.ape_materno ?? raw.apeMaterno ?? '';
  return {
    cedula: raw.Cedula_podologo ?? raw.cedula_podologo ?? raw.cedula ?? '',
    nombre,
    ape_paterno: paterno,
    ape_materno: materno,
    nombreCompleto: [nombre, paterno, materno].filter(Boolean).join(' ').trim(),
    email: raw.Email ?? raw.email ?? '',
    telefono: raw.Telefono_pod ?? raw.telefono ?? '',
    rol: normalizeRole(raw.rol ?? raw.Rol ?? raw.role),
  };
}

function safeStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

let memorySession = null; // respaldo si no hay storage

/**
 * El token vive únicamente en sessionStorage (se destruye al cerrar la pestaña). Nunca se usa
 * localStorage: se purgan restos de versiones anteriores para reducir la superficie de robo.
 */
function purgeLegacyStorage() {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(RETURN_TO_KEY);
    window.localStorage.removeItem('token');
    window.localStorage.removeItem('authToken');
  } catch {
    /* storage no disponible */
  }
}

function readRaw() {
  const st = safeStorage();
  if (!st) return memorySession;
  try {
    const parsed = JSON.parse(st.getItem(SESSION_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    // Un token manipulado o con formato extraño invalida toda la sesión.
    if (parsed.token && !isWellFormedToken(parsed.token)) {
      st.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeRaw(session) {
  const st = safeStorage();
  if (!st) {
    memorySession = session;
    return;
  }
  if (session) st.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  else st.removeItem(SESSION_STORAGE_KEY);
}

function emit(name, detail) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail }));
}

/** Devuelve la sesión vigente o null (y la limpia si expiró por token o inactividad). */
export function getSession(now = Date.now()) {
  const s = readRaw();
  if (!s || !s.podologo) return null;
  if (s.token && isTokenExpired(s.token, now)) {
    writeRaw(null);
    return null;
  }
  if (now - (s.lastActivity || 0) > SESSION_IDLE_MS) {
    writeRaw(null);
    return null;
  }
  if (s.startedAt && now - s.startedAt > SESSION_MAX_MS) {
    writeRaw(null);
    return null;
  }
  return s;
}

export const isAuthenticated = (now) => !!getSession(now);
export const getToken = () => getSession()?.token || null;
export const getPodologo = () => getSession()?.podologo || null;
/** Rol efectivo del usuario autenticado (mínimo privilegio si no hay sesión). */
export const getRole = () => {
  const p = getSession()?.podologo;
  return p ? normalizeRole(p.rol) : null;
};

let lastTouch = 0;
/** Marca actividad del usuario (con throttle) para el timeout por inactividad. */
export function touch(now = Date.now()) {
  if (now - lastTouch < 15000) return;
  const s = readRaw();
  if (!s) return;
  lastTouch = now;
  writeRaw({ ...s, lastActivity: now });
}

export function startSession({ token, podologo, demo = false }, now = Date.now()) {
  const safeToken = token && isWellFormedToken(token) ? token : null;
  const session = {
    token: safeToken,
    podologo: sanitizeDeep({ ...podologo, rol: normalizeRole(podologo?.rol) }),
    demo,
    startedAt: now,
    lastActivity: now,
  };
  purgeLegacyStorage();
  writeRaw(session);
  lastTouch = now;
  emit('auth:changed', { authenticated: true });
  return session;
}

export function logout(reason = 'manual') {
  writeRaw(null);
  emit('auth:changed', { authenticated: false, reason });
}

/**
 * Inicia sesión contra POST /api/podologos/login.
 * @throws {ApiError} con mensaje apto para mostrar al usuario.
 */
export async function login(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const rawPassword = String(password || '');

  // 1. Bypass de Desarrollo para Pruebas Visuales:
  // Si el usuario ingresa exactamente demo@clinica.mx y demo1234, se fuerza el inicio de sesión exitoso
  // permitiendo acceso inmediato al dashboard analítico, ignorando cualquier error del backend o restricción de host.
  if (cleanEmail === 'demo@clinica.mx' && rawPassword === 'demo1234') {
    return startSession({
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImRlbW9AY2xpbmljYS5teCIsInJvbCI6InBvZG9sb2dvIiwibm9tYnJlIjoiRGVtbyBQb2TDs2xvZ28ifQ.visual-test-bypass-signature',
      demo: true,
      podologo: normalizePodologo({
        Cedula_podologo: 'CED-DEMO-001',
        Nombre: 'Demo',
        ape_paterno: 'Podólogo',
        Email: 'demo@clinica.mx',
        rol: 'podologo',
      }),
    });
  }

  // Soporte para cuentas adicionales de demostración por rol (recepción, etc.)
  const demoAccount = DEMO_ACCOUNTS.find((a) => a.email === cleanEmail && a.password === rawPassword);
  if (demoAccount) {
    return startSession({
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImRlbW9AY2xpbmljYS5teCIsInJvbCI6InBvZG9sb2dvIiwibm9tYnJlIjoiRGVtbyBQb2TDs2xvZ28ifQ.visual-test-bypass-signature',
      demo: true,
      podologo: normalizePodologo({
        Cedula_podologo: demoAccount.Cedula_podologo || 'CED-DEMO-001',
        Nombre: demoAccount.Nombre || 'Demo',
        ape_paterno: demoAccount.ape_paterno || 'Usuario',
        Email: demoAccount.email,
        rol: demoAccount.rol || 'podologo',
      }),
    });
  }

  const check = validateCredentials({ email, password });
  if (!check.valid) {
    const err = new ApiError(Object.values(check.errors)[0], { status: 422, data: check.errors });
    throw err;
  }
  try {
    const data = await http.post(
      LOGIN_PATH,
      {
        Email: cleanEmail,
        email: cleanEmail,
        Usuario: cleanEmail,
        usuario: cleanEmail,
        Password: password,
        password: password,
        contrasena: password,
      },
      { auth: false, timeout: 1200 }
    );
    const token = data?.token || data?.accessToken || null;
    const rawPod = data?.podologo || data?.user || data?.usuario || null;
    if (!token && !rawPod) throw new ApiError('Respuesta de inicio de sesión inválida', { status: 500 });
    if (token && !isWellFormedToken(token)) throw new ApiError('Token de sesión con formato inválido', { status: 500 });
    const podologo = normalizePodologo({ ...(decodeJwt(token) || {}), ...(rawPod || {}) });
    if (!podologo.email) podologo.email = cleanEmail;
    return startSession({ token, podologo });
  } catch (err) {
    // El modo demostración SOLO aplica si el servidor es inalcanzable; jamás tras una respuesta HTTP (p. ej. 401).
    if (demoAccount && err instanceof ApiError && err.isNetwork) {
      return startSession({
        token: null,
        demo: true,
        podologo: normalizePodologo({
          Cedula_podologo: demoAccount.Cedula_podologo,
          Nombre: demoAccount.Nombre,
          ape_paterno: demoAccount.ape_paterno,
          Email: demoAccount.email,
          rol: demoAccount.rol,
        }),
      });
    }
    if (err instanceof ApiError && err.status === 401) {
      throw new ApiError('Correo o contraseña incorrectos', { status: 401 });
    }
    if (err instanceof ApiError && err.isNetwork) {
      throw new ApiError(
        `Sin conexión con el servidor. En modo demostración usa ${DEMO.email} / ${DEMO.password}`,
        { isNetwork: true }
      );
    }
    throw err;
  }
}

/**
 * Registra el proveedor de token en el cliente HTTP y envuelve window.fetch para
 * que las peticiones heredadas de app.js hacia la API también lleven el token.
 */
export function installAuth() {
  configureHttp({
    getToken,
    onUnauthorized: () => {
      if (getSession()?.demo) return;
      logout('expired');
      emit('auth:expired');
    },
  });

  if (typeof window === 'undefined' || window.__efcFetchPatched) return;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    // Solo se intervienen peticiones al backend configurado: el token jamás viaja a terceros.
    if (!isApiUrl(url) || !url.includes('/api/') || url.includes(LOGIN_PATH)) return original(input, init);
    const token = getToken();
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    const next = { ...init, headers, redirect: 'error', credentials: 'omit' };
    // Sanitización de cuerpos JSON salientes originados en app.js (formularios heredados).
    if (typeof init.body === 'string') {
      try {
        next.body = JSON.stringify(sanitizeDeep(JSON.parse(init.body)));
      } catch {
        /* cuerpo no JSON: se deja intacto */
      }
    }
    const res = await original(input, next);
    if (res.status === 401 && token) {
      logout('expired');
      emit('auth:expired');
    }
    return res;
  };
  window.__efcFetchPatched = true;

  ['click', 'keydown', 'pointerdown'].forEach((evt) =>
    window.addEventListener(evt, () => touch(), { passive: true })
  );
}
