/** Utilidades de HTML seguras (evitan XSS al interpolar datos del backend). */

const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) => MAP[c]);
}

/** Convierte cualquier valor MySQL (0/1/'1'/true) a boolean. */
export function toBool(v) {
  return v === true || v === 1 || v === '1' || v === 'true';
}

/** Normaliza respuestas del backend: array directo, {data:[]}, {rows:[]} o vacío. */
export function toArray(payload, keys = ['data', 'rows', 'items', 'results']) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    for (const k of keys) if (Array.isArray(payload[k])) return payload[k];
  }
  return [];
}

export function debounce(fn, ms = 300) {
  let t;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}
