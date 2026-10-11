import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../config.js';
import { sanitizeDeep } from './sanitize.js';

/** Origen permitido para peticiones autenticadas (http://localhost:4000). */
export function apiOrigin() {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return '';
  }
}

/** true si la URL pertenece al backend configurado. */
export function isApiUrl(url) {
  try {
    return new URL(url, API_BASE_URL).origin === apiOrigin();
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, isNetwork = false, isTimeout = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.isNetwork = isNetwork;
    this.isTimeout = isTimeout;
  }
}

let authProvider = { getToken: () => null, onUnauthorized: () => {} };

/** El módulo de autenticación registra aquí cómo obtener el token y qué hacer ante un 401. */
export function configureHttp(provider) {
  authProvider = { ...authProvider, ...provider };
}

function buildUrl(path, query) {
  const raw = String(path);
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) {
    if (!isApiUrl(raw)) throw new ApiError('Destino de petición no permitido', { status: 0 });
  } else if (!raw.startsWith('/') || raw.includes('..') || /[\s\\]/.test(raw)) {
    throw new ApiError('Ruta de API inválida', { status: 0 });
  }
  const url = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `${API_BASE_URL}${raw}`;
  if (!query) return url;
  const qs = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.append(k, String(v));
  });
  const s = qs.toString();
  return s ? `${url}${url.includes('?') ? '&' : '?'}${s}` : url;
}

/**
 * Cliente HTTP único del frontend (fetch). Maneja JSON, FormData, timeout,
 * token Bearer y errores normalizados (ApiError).
 */
export async function request(path, opts = {}) {
  const { method = 'GET', body, query, auth = true, timeout = REQUEST_TIMEOUT_MS, headers = {} } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  const finalHeaders = { Accept: 'application/json', ...headers };
  if (body !== undefined && !isForm) finalHeaders['Content-Type'] = 'application/json';
  if (auth) {
    const token = authProvider.getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    // Sanitización estricta del cuerpo (XSS almacenado): se omiten campos secretos como Password.
    const payload = body === undefined ? undefined : isForm ? sanitizeDeep(body) : JSON.stringify(sanitizeDeep(body));
    res = await fetch(buildUrl(path, query), {
      method,
      headers: finalHeaders,
      body: payload,
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const isTimeout = err && err.name === 'AbortError';
    throw new ApiError(isTimeout ? 'El servidor tardó demasiado en responder' : 'No se pudo conectar con el servidor', {
      isNetwork: true,
      isTimeout,
    });
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  if (res.status !== 204) {
    const ct = res.headers.get('content-type') || '';
    try {
      data = ct.includes('application/json') ? await res.json() : await res.text();
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && auth) authProvider.onUnauthorized();
    const message =
      (data && typeof data === 'object' && (data.message || data.error || data.mensaje)) ||
      (typeof data === 'string' && data.trim().slice(0, 200)) ||
      `Error ${res.status}`;
    throw new ApiError(message, { status: res.status, data });
  }
  return data;
}

export const http = {
  get: (path, query, opts) => request(path, { ...opts, method: 'GET', query }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
};
