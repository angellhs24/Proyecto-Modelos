/**
 * Odontograma podológico: catálogo de zonas del pie, afecciones y
 * (de)serialización contra la tabla Diagnosticos (sin cambiar el esquema).
 *
 * Cada diagnóstico guardado lleva en `detalles_adicionales` una etiqueta
 * máquina-legible:  [mapa:D.dedo1,D.unia1,I.talon]
 * donde D = pie derecho, I = pie izquierdo.
 */

export const LADOS = Object.freeze({ D: 'Pie derecho', I: 'Pie izquierdo' });

export const ZONAS = Object.freeze({
  dedo1: 'Hallux (dedo 1)',
  dedo2: 'Dedo 2',
  dedo3: 'Dedo 3',
  dedo4: 'Dedo 4',
  dedo5: 'Dedo 5',
  unia1: 'Uña del hallux',
  unia2: 'Uña dedo 2',
  unia3: 'Uña dedo 3',
  unia4: 'Uña dedo 4',
  unia5: 'Uña dedo 5',
  antepie_interno: 'Antepié interno (1ª-2ª cabeza MT)',
  antepie_central: 'Antepié central (3ª cabeza MT)',
  antepie_externo: 'Antepié externo (4ª-5ª cabeza MT)',
  arco: 'Arco longitudinal',
  borde_lateral: 'Borde lateral',
  talon: 'Talón',
});

/** Catálogo de afecciones; `tipo` alimenta Diagnosticos.tipo_diagnostico */
export const AFECCIONES = Object.freeze([
  { key: 'hiperqueratosis', nombre: 'Hiperqueratosis', color: '#d97706', tipo: 'Lesión dermo-estructural' },
  { key: 'heloma', nombre: 'Heloma (clavo)', color: '#c85a32', tipo: 'Lesión dermo-estructural' },
  { key: 'fisura', nombre: 'Fisura / grieta', color: '#be185d', tipo: 'Lesión dermo-estructural' },
  { key: 'onicocriptosis', nombre: 'Onicocriptosis', color: '#7c3aed', tipo: 'Patología ungueal' },
  { key: 'onicomicosis', nombre: 'Onicomicosis', color: '#0d9488', tipo: 'Patología ungueal' },
  { key: 'onicogrifosis', nombre: 'Onicogrifosis', color: '#4f46e5', tipo: 'Patología ungueal' },
  { key: 'verruga', nombre: 'Verruga plantar', color: '#65a30d', tipo: 'Lesión dermatológica' },
  { key: 'tinea', nombre: 'Tiña pedis', color: '#0891b2', tipo: 'Lesión dermatológica' },
  { key: 'ulcera', nombre: 'Úlcera / pie diabético', color: '#e11d48', tipo: 'Lesión de riesgo' },
  { key: 'deformidad', nombre: 'Deformidad ortopédica', color: '#475569', tipo: 'Alteración ortopédica' },
]);

const byKey = new Map(AFECCIONES.map((a) => [a.key, a]));
const byName = new Map(AFECCIONES.map((a) => [a.nombre.toLowerCase(), a]));

export const getAfeccion = (key) => byKey.get(key) || null;
export const afeccionPorNombre = (nombre) => byName.get(String(nombre || '').toLowerCase()) || null;
export const COLOR_OTRA = '#78716c';

/** id de marca: 'D.dedo1' */
export const markId = (lado, zona) => `${lado}.${zona}`;

export function describeMark(id) {
  const [lado, zona] = id.split('.');
  return `${LADOS[lado] || lado} — ${ZONAS[zona] || zona}`;
}

const TAG_RE = /\[mapa:([A-Za-z0-9_.,]*)\]/;

/** Extrae los ids de zona de un texto de detalles_adicionales. */
export function parseMapTag(texto) {
  const m = TAG_RE.exec(texto || '');
  if (!m || !m[1]) return [];
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter((id) => {
      const [lado, zona] = id.split('.');
      return LADOS[lado] && ZONAS[zona];
    });
}

/** Nota libre del diagnóstico, sin la etiqueta del mapa ni el resumen automático. */
export function stripMapMeta(texto) {
  return String(texto || '')
    .replace(TAG_RE, '')
    .replace(/^Zonas:.*$/m, '')
    .trim();
}

/**
 * Agrupa marcas pendientes por afección y genera los payloads
 * para POST /api/diagnosticos (uno por afección).
 * @param {Array<{id:string, afeccion:string}>} marks
 */
export function marksToDiagnosticos(marks, consultaId, nota = '') {
  const grupos = new Map();
  for (const m of marks) {
    if (!grupos.has(m.afeccion)) grupos.set(m.afeccion, []);
    grupos.get(m.afeccion).push(m.id);
  }
  const out = [];
  for (const [key, ids] of grupos) {
    const af = getAfeccion(key);
    if (!af) continue;
    const derecho = ids.some((id) => id.startsWith('D.'));
    const izquierdo = ids.some((id) => id.startsWith('I.'));
    const resumen = `Zonas: ${ids.map(describeMark).join('; ')}`;
    out.push({
      fk_consulta_id: consultaId,
      padecimiento: af.nombre,
      pie_derecho: derecho,
      pie_izquierdo: izquierdo,
      tipo_diagnostico: af.tipo,
      detalles_adicionales: [nota.trim(), resumen, `[mapa:${ids.join(',')}]`].filter(Boolean).join('\n'),
    });
  }
  return out;
}

/**
 * Reconstruye las marcas guardadas a partir de diagnósticos del historial.
 * @returns {Array<{id:string, afeccion:string, color:string, diagnosticoId:string, consultaId:string}>}
 */
export function diagnosticosToMarks(diagnosticos) {
  const marks = [];
  for (const d of diagnosticos) {
    const af = afeccionPorNombre(d.padecimiento);
    for (const id of parseMapTag(d.detalles_adicionales)) {
      marks.push({
        id,
        afeccion: af ? af.key : 'otra',
        nombre: d.padecimiento,
        color: af ? af.color : COLOR_OTRA,
        diagnosticoId: d.Diagnostico_id ?? d.id ?? '',
        consultaId: d.fk_consulta_id ?? '',
      });
    }
  }
  return marks;
}

/** Alterna una marca pendiente (misma zona+afección = quitar; otra afección = reemplazar). */
export function toggleMark(marks, id, afeccion) {
  const idx = marks.findIndex((m) => m.id === id);
  if (idx === -1) return [...marks, { id, afeccion }];
  if (marks[idx].afeccion === afeccion) return marks.filter((m) => m.id !== id);
  const next = marks.slice();
  next[idx] = { id, afeccion };
  return next;
}
