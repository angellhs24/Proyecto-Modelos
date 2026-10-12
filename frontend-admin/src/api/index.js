/**
 * Capa de acceso a la API REST (http://localhost:4000/api/*).
 * Un cliente por archivo de rutas del backend.
 */
import { API_BASE_URL, ENDPOINTS as E } from '../config.js';
import { http } from '../core/http.js';
import { toArray } from '../utils/html.js';
import { readFallback, writeFallback, isFallbackError } from './fallbackStore.js';
import { SEED_INSUMOS, normalizeInsumo, aplicarMovimiento, nextInsumoId } from '../domain/inventario.js';
import { normalizeReceta, buildFolio } from '../domain/receta.js';

const enc = encodeURIComponent;

/** Filtra en cliente por si el backend ignora el parámetro de consulta. */
function onlyWhere(list, field, value) {
  return list.filter((item) => item[field] === undefined || String(item[field]) === String(value));
}

export const pacientesApi = {
  /** GET /api/pacientes/:No_expediente (incluye `consultas` si el backend las anida) */
  get: (expediente) => http.get(`${E.pacientes}/${enc(expediente)}`),
  /** GET /api/pacientes?q= */
  search: async (q) => toArray(await http.get(E.pacientes, { q })),
  /** GET /api/pacientes */
  list: async () => toArray(await http.get(E.pacientes)),
  /** POST /api/pacientes/expres */
  createExpress: (payload) => http.post(`${E.pacientes}/expres`, payload),
};

export const clinicasApi = {
  list: async () => toArray(await http.get(E.clinicas)),
};

export const podologosApi = {
  list: async () => toArray(await http.get(E.podologos)),
};

export const citasApi = {
  /** GET /api/citas/clinica/:Clinica_id */
  byClinica: async (clinicaId) => toArray(await http.get(`${E.citas}/clinica/${enc(clinicaId)}`)),
  /** POST /api/citas */
  create: (payload) => http.post(E.citas, payload),
};

export const consultasApi = {
  /** GET /api/consultas?fk_no_expediente= */
  byPaciente: async (expediente) =>
    onlyWhere(toArray(await http.get(E.consultas, { fk_no_expediente: expediente })), 'fk_no_expediente', expediente),
  /** GET /api/consultas/:Consulta_id */
  get: (id) => http.get(`${E.consultas}/${enc(id)}`),
  /** POST /api/consultas */
  create: (payload) => http.post(E.consultas, payload),
  /** PUT /api/consultas/:Consulta_id  (estado, fecha_hora, ...) */
  update: (id, payload) => http.put(`${E.consultas}/${enc(id)}`, payload),
  updateEstado: (id, estado) => http.put(`${E.consultas}/${enc(id)}`, { estado }),
  reschedule: (id, fechaHoraMySQL) =>
    http.put(`${E.consultas}/${enc(id)}`, { fecha_hora: fechaHoraMySQL, fecha_hora_inicio: fechaHoraMySQL }),
};

function childApi(base) {
  return {
    /** GET /api/<recurso>?fk_consulta_id= */
    byConsulta: async (consultaId) =>
      onlyWhere(toArray(await http.get(base, { fk_consulta_id: consultaId })), 'fk_consulta_id', consultaId),
    create: (payload) => http.post(base, payload),
    update: (id, payload) => http.put(`${base}/${enc(id)}`, payload),
    remove: (id) => http.del(`${base}/${enc(id)}`),
  };
}

export const diagnosticosApi = childApi(E.diagnosticos);
export const tratamientosApi = childApi(E.tratamientos);

export const documentosApi = {
  ...childApi(E.documentos),
  /**
   * POST /api/documentos (multipart/form-data)
   * campos: fk_consulta_id, tipo_documento, fecha_subida, archivo
   */
  upload: ({ consultaId, tipo, fecha, file }) => {
    const fd = new FormData();
    fd.append('fk_consulta_id', consultaId);
    fd.append('tipo_documento', tipo);
    fd.append('fecha_subida', fecha);
    fd.append('archivo', file);
    return http.post(E.documentos, fd);
  },
};

/** URL absoluta de un archivo guardado en `url_archivo`. */
export function fileUrl(url) {
  if (!url) return '#';
  if (/^(https?:|blob:)/i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) return '#'; // data:, javascript:, etc.
  const origin = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Ejecuta la llamada REST y, si el recurso aún no existe en el backend (404) o el servidor
 * no responde, delega en el almacén de respaldo. Devuelve { data, source: 'api' | 'local' }.
 */
async function withFallback(remote, local) {
  try {
    return { data: await remote(), source: 'api' };
  } catch (err) {
    if (!isFallbackError(err)) throw err;
    return { data: await local(), source: 'local' };
  }
}

/** Módulo de Inventario: Conexión directa a http://localhost:4000/api/inventario */
export const inventarioApi = {
  list: async () => {
    const res = await http.get(E.inventario);
    return { data: toArray(res).map(normalizeInsumo), source: 'api' };
  },
  create: async (payload) => {
    const res = await http.post(E.inventario, payload);
    return { data: normalizeInsumo(res?.insumo || res), source: 'api' };
  },
  /** Registra una entrada o descuento de stock directo en MySQL. */
  registrarMovimiento: async (insumo, mov) => {
    const res = await http.post(`${E.inventario}/${enc(insumo.id)}/movimientos`, mov);
    return {
      insumo: normalizeInsumo(res?.insumo || { ...insumo }),
      movimiento: res?.movimiento || null,
      source: 'api'
    };
  },
  movimientos: async () => {
    const res = await http.get(`${E.inventario}/movimientos`);
    return { data: toArray(res), source: 'api' };
  },
};

/** Módulo de Recetas: Conexión directa a http://localhost:4000/api/recetas */
export const recetasApi = {
  list: async (params = {}) => {
    const res = await http.get(E.recetas, params);
    return { data: toArray(res).map(normalizeReceta), source: 'api' };
  },
  create: async (payload) => {
    const res = await http.post(E.recetas, normalizeReceta(payload));
    return { data: res, source: 'api' };
  },
  get: async (id) => {
    const res = await http.get(`${E.recetas}/${enc(id)}`);
    return normalizeReceta(res);
  },
  remove: (id) => http.del(`${E.recetas}/${enc(id)}`),
};

/** Módulo Financiero (Caja / Pagos): Conexión directa a /api/pagos */
export const pagosApi = {
  list: async (params = {}) => {
    const res = await http.get(E.pagos, params);
    return toArray(res);
  },
  resumen: () => http.get(`${E.pagos}/resumen`),
  get: (id) => http.get(`${E.pagos}/${enc(id)}`),
  create: (payload) => http.post(E.pagos, payload),
  update: (id, payload) => http.put(`${E.pagos}/${enc(id)}`, payload),
  remove: (id) => http.del(`${E.pagos}/${enc(id)}`),
};

/** Módulo de Odontograma / Mapa Podológico: Conexión directa a /api/mapa-podologico */
export const mapaPodologicoApi = {
  list: async (params = {}) => {
    const res = await http.get(E.mapaPodologico, params);
    return toArray(res);
  },
  byConsulta: async (consultaId) => {
    const res = await http.get(`${E.mapaPodologico}/consulta/${enc(consultaId)}`);
    return toArray(res);
  },
  create: (payload) => http.post(E.mapaPodologico, payload),
  saveBatch: (payload) => http.post(E.mapaPodologico, payload),
  update: (id, payload) => http.put(`${E.mapaPodologico}/${enc(id)}`, payload),
  remove: (id) => http.del(`${E.mapaPodologico}/${enc(id)}`),
  clearConsulta: (consultaId) => http.del(`${E.mapaPodologico}/consulta/${enc(consultaId)}`),
};

/** Módulo de Monitor de Auditoría: Conexión directa a /api/auditoria */
export const auditoriaApi = {
  list: (params = {}) => http.get(E.auditoria, params),
  estadisticas: () => http.get(`${E.auditoria}/estadisticas`),
  create: (payload) => http.post(E.auditoria, payload),
};

