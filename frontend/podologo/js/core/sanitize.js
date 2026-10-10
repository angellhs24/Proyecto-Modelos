/**
 * Capa de Seguridad · Sanitización de entradas (prevención de XSS).
 *
 * Estrategia de defensa en profundidad:
 *  1. Entrada  -> `sanitizeText` / `sanitizeDeep` eliminan marcado ejecutable antes de enviar al backend.
 *  2. Ingesta  -> `neutralizeText` / `neutralizeDeep` neutralizan datos recibidos que el código heredado
 *                 interpola en plantillas e inline handlers (rompe cualquier escape de atributo/cadena JS).
 *  3. Salida   -> `esc()` (utils/html.js) escapa al interpolar en HTML en los módulos nuevos.
 *
 * Todas las funciones son puras y están cubiertas por pruebas unitarias (tests/unit/sanitize.test.js).
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const DANGEROUS_BLOCKS = /<\s*(script|style|iframe|object|embed|template|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi;
const HTML_TAGS = /<\/?[a-z!?][^>]*>?/gi;
const DANGEROUS_SCHEMES = /\b(?:javascript|vbscript|data)\s*:/gi;
const EVENT_HANDLERS = /\bon[a-z]{3,}\s*=/gi;

/** Claves cuyo valor jamás se modifica (secretos): contraseñas y tokens. */
const SECRET_KEY = /pass(word)?|contrase|token|secret|hash/i;

export const MAX_TEXT_LENGTH = 2000;

/**
 * Sanitiza un valor textual proveniente de un formulario.
 * @param {*} value
 * @param {{ multiline?: boolean, maxLength?: number }} [opts]
 * @returns {string}
 */
export function sanitizeText(value, { multiline = false, maxLength = MAX_TEXT_LENGTH } = {}) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  try {
    s = s.normalize('NFC');
  } catch {
    /* entorno sin normalize */
  }
  // Varias pasadas: neutraliza payloads anidados como <<script>script>.
  for (let i = 0; i < 4; i += 1) {
    const before = s;
    s = s
      .replace(CONTROL_CHARS, (c) => (multiline && (c === '\n' || c === '\r' || c === '\t') ? c : ''))
      .replace(DANGEROUS_BLOCKS, '')
      .replace(HTML_TAGS, '')
      .replace(DANGEROUS_SCHEMES, '')
      .replace(EVENT_HANDLERS, '');
    if (s === before) break;
  }
  s = s.replace(/[<>]/g, '');
  s = multiline ? s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ');
  s = s.trim();
  return s.length > maxLength ? s.slice(0, maxLength) : s;
}

/**
 * Neutraliza un dato recibido para que sea inocuo dentro de HTML, atributos y cadenas JS de handlers inline.
 * Reemplaza comillas por equivalentes tipográficos (no pierde legibilidad clínica).
 */
export function neutralizeText(value) {
  return sanitizeText(value, { multiline: false })
    .replace(/"/g, '\u201D')
    .replace(/'/g, '\u2019')
    .replace(/`/g, '\u00B4')
    .replace(/\\/g, '/');
}

function mapDeep(value, fn, depth = 0, seen = new WeakSet()) {
  if (depth > 8) return value;
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.slice(0, 5000).map((v) => mapDeep(v, fn, depth + 1, seen));
  if (value && typeof value === 'object') {
    if (typeof Blob !== 'undefined' && value instanceof Blob) return value;
    if (typeof FormData !== 'undefined' && value instanceof FormData) return sanitizeFormData(value);
    if (seen.has(value)) return value;
    seen.add(value);
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue; // prototype pollution
      out[sanitizeKey(k)] = SECRET_KEY.test(k) ? v : mapDeep(v, fn, depth + 1, seen);
    }
    return out;
  }
  return value;
}

const sanitizeKey = (k) => String(k).replace(/[^\w.\-]/g, '').slice(0, 64) || '_';

/** Sanitiza recursivamente un objeto/array (cuerpos JSON salientes). Respeta campos secretos. */
export function sanitizeDeep(value, opts) {
  return mapDeep(value, (s) => sanitizeText(s, { multiline: true, ...(opts || {}) }));
}

/** Neutraliza recursivamente respuestas del backend antes de que las use código con plantillas heredadas. */
export function neutralizeDeep(value) {
  return mapDeep(value, neutralizeText);
}

/** Copia un FormData sanitizando los campos de texto (los archivos no se alteran). */
export function sanitizeFormData(fd) {
  const out = new FormData();
  for (const [k, v] of fd.entries()) {
    if (typeof v === 'string') out.append(sanitizeKey(k), SECRET_KEY.test(k) ? v : sanitizeText(v, { multiline: true }));
    else out.append(sanitizeKey(k), v);
  }
  return out;
}

/** Sanea in situ las propiedades de texto de un objeto de formulario (estado heredado de app.js). */
export function neutralizeInPlace(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'string') {
      const clean = v.replace(/[<>"'`\\]/g, '');
      if (clean !== v) obj[k] = clean;
    } else if (Array.isArray(v)) {
      v.forEach((item) => neutralizeInPlace(item));
    } else if (v && typeof v === 'object') {
      neutralizeInPlace(v);
    }
  }
  return obj;
}

// ---------- Validadores de formato (listas blancas) ----------

const EMAIL_RE = /^[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`]{2,}$/;
const EXPEDIENTE_RE = /^[A-Za-z0-9_-]{1,32}$/;
const ID_RE = /^[A-Za-z0-9_.-]{1,64}$/;

export const isSafeEmail = (v) => EMAIL_RE.test(String(v || '').trim()) && String(v).length <= 254;
export const isSafeExpediente = (v) => EXPEDIENTE_RE.test(String(v ?? ''));
export const isSafeId = (v) => ID_RE.test(String(v ?? ''));

/** Teléfono: solo dígitos y símbolos habituales. */
export function sanitizePhone(v) {
  return String(v ?? '').replace(/[^\d+()\-\s]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
}

/** Número finito dentro de [min, max]; devuelve null si no es válido. */
export function sanitizeNumber(v, { min = -Infinity, max = Infinity, decimals = 2 } = {}) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max) return null;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Permite únicamente URLs http(s), blob: o rutas relativas; el resto se descarta. */
export function safeUrl(url) {
  const u = String(url ?? '').trim();
  if (!u) return '';
  if (/^(https?:\/\/|blob:|\/(?!\/))/i.test(u)) return u;
  return '';
}
