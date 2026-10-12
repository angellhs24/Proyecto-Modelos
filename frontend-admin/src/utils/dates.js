/** Utilidades de fecha. Se trabaja siempre en hora local (la clínica es mono-zona). */

const pad = (n) => String(n).padStart(2, '0');

/** Acepta 'YYYY-MM-DD HH:mm[:ss]', ISO ('T'), Date o timestamp. Devuelve Date válido o null. */
export function parseDate(value) {
  if (value instanceof Date) return isNaN(value) ? null : new Date(value.getTime());
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return new Date(value);
  const s = String(value).trim();
  // Fecha sola -> medianoche local
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/);
  if (!m) {
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  // Si trae zona (Z / offset) delegamos en Date para respetar el instante real.
  if (m[7]) {
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  return isNaN(d) ? null : d;
}

export const toDateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toTimeKey = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Formato MySQL DATETIME: 'YYYY-MM-DD HH:mm:ss' */
export const toMySQLDateTime = (d) => `${toDateKey(d)} ${toTimeKey(d)}:00`;
/** Formato para <input type="datetime-local">: 'YYYY-MM-DDTHH:mm' */
export const toInputDateTime = (d) => `${toDateKey(d)}T${toTimeKey(d)}`;

export function addMinutes(d, min) {
  return new Date(d.getTime() + min * 60000);
}

export function calcularEdad(fechaNac, hoy = new Date()) {
  const nac = parseDate(fechaNac);
  if (!nac) return null;
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad >= 0 ? edad : null;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** '12 mar 2026' */
export function formatFechaCorta(value) {
  const d = parseDate(value);
  return d ? `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}` : '—';
}

/** '12 mar 2026 · 10:30' */
export function formatFechaHora(value) {
  const d = parseDate(value);
  return d ? `${formatFechaCorta(d)} · ${toTimeKey(d)}` : '—';
}

export function calcularIMC(peso, altura) {
  const p = parseFloat(peso);
  let a = parseFloat(altura);
  if (!p || !a || p <= 0 || a <= 0) return null;
  if (a > 3) a = a / 100; // cm -> m
  const imc = p / (a * a);
  let clasificacion = 'Normal';
  if (imc < 18.5) clasificacion = 'Bajo peso';
  else if (imc >= 30) clasificacion = 'Obesidad';
  else if (imc >= 25) clasificacion = 'Sobrepeso';
  return { valor: Number(imc.toFixed(1)), clasificacion };
}
