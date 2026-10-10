/**
 * Almacén de respaldo (modo sin conexión) para los módulos Inventario y Recetas.
 *
 * Se usa SOLO cuando el endpoint REST aún no existe (404) o el servidor es inalcanzable.
 * Seguridad: usa sessionStorage (se destruye al cerrar la pestaña), nunca localStorage,
 * y se purga completamente al cerrar sesión.
 */
import { FALLBACK_STORAGE_PREFIX } from '../config.js';

function storage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

const memory = new Map();

export function readFallback(name, seed = []) {
  const key = FALLBACK_STORAGE_PREFIX + name;
  const st = storage();
  try {
    const raw = st ? st.getItem(key) : memory.get(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* datos corruptos: se re-siembran */
  }
  const initial = JSON.parse(JSON.stringify(seed));
  writeFallback(name, initial);
  return initial;
}

export function writeFallback(name, list) {
  const key = FALLBACK_STORAGE_PREFIX + name;
  const value = JSON.stringify(list);
  const st = storage();
  if (st) st.setItem(key, value);
  else memory.set(key, value);
}

/** Elimina todos los datos de respaldo (se invoca al cerrar sesión). */
export function clearFallbacks() {
  memory.clear();
  const st = storage();
  if (!st) return;
  Object.keys(st)
    .filter((k) => k.startsWith(FALLBACK_STORAGE_PREFIX))
    .forEach((k) => st.removeItem(k));
}

/** ¿El error indica que el recurso no existe o el servidor está caído? (activa el modo respaldo) */
export const isFallbackError = (err) => !!err && (err.isNetwork === true || err.status === 404 || err.status === 501);
