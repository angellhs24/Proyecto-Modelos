/** Normalización de pacientes y consultas (esquema MySQL ⇄ formato legado de la app). */
import { parseDate, calcularEdad, calcularIMC } from '../utils/dates.js';
import { toBool } from '../utils/html.js';

const SEXO = { M: 'Masculino', F: 'Femenino' };

export function normalizePaciente(raw = {}) {
  const nombre =
    raw.nombre_completo ||
    [raw.Nombres, raw.ape_paterno, raw.ape_materno].filter(Boolean).join(' ').trim() ||
    'Paciente sin nombre';
  const fechaNac = String(raw.Fecha_nacimiento ?? raw.fecha_nacimiento ?? '').split('T')[0] || '';
  const sexoRaw = raw.Sexo ?? raw.sexo ?? '';
  return {
    expediente: String(raw.No_expediente ?? raw.expediente ?? raw.id_paciente ?? ''),
    nombre,
    nombres: raw.Nombres ?? '',
    telefono: raw.telefono ?? raw.Telefono ?? '',
    fechaNacimiento: fechaNac,
    edad: calcularEdad(fechaNac) ?? (raw.edad ? Number(raw.edad) : null),
    sexo: SEXO[sexoRaw] || sexoRaw || '',
    calzado: raw.Calzado ?? raw.calzado ?? '',
    direccion: raw.Calle_direccion ?? raw.calle_direccion ?? '',
    municipio: raw.Municipio ?? raw.municipio ?? '',
    ocupacion: raw.Ocupacion ?? raw.ocupacion ?? '',
    esDiabetico: toBool(raw.es_diabetico),
    esHipertenso: toBool(raw.es_hipertenso),
    antecedentes: raw.Antecedentes_patologicos ?? raw.antecedentes_patologicos ?? '',
    notas: raw.Notas ?? raw.notas_alergias ?? '',
    fechaRegistro: String(raw.Fecha_registro ?? '').split('T')[0] || '',
  };
}

export function normalizeConsulta(raw = {}) {
  const fecha = parseDate(raw.fecha_hora ?? raw.fecha_hora_inicio);
  return {
    id: String(raw.Consulta_id ?? raw.id_cita ?? raw.id ?? ''),
    fecha,
    estado: raw.estado || 'Programada',
    motivo: raw.motivo_o_notas ?? raw.motivo ?? '',
    peso: raw.Peso ?? null,
    altura: raw.Altura ?? null,
    imc: calcularIMC(raw.Peso, raw.Altura),
    tipoPisada: raw.tipo_pisada ?? '',
    alineacion: raw.alineacion ?? '',
    observaciones: raw.observaciones ?? '',
    clinica: raw.clinica_nombre ?? '',
    podologo: raw.podologo_nombre ?? raw.fk_cedula_podologo ?? '',
    raw,
  };
}

/** Más reciente primero; las que no tienen fecha al final. */
export function sortConsultas(list) {
  return [...list].sort((a, b) => (b.fecha?.getTime() ?? -Infinity) - (a.fecha?.getTime() ?? -Infinity));
}

/** Consulta sugerida para asociar nuevos registros: la más reciente no cancelada. */
export function defaultConsultaId(consultas) {
  const c = sortConsultas(consultas).find((x) => !['Cancelada', 'No asistió'].includes(x.estado));
  return c ? c.id : consultas[0]?.id || '';
}

/** Validaciones de formularios del expediente (puras). */
export function validateDiagnostico(d) {
  const errors = {};
  if (!d.fk_consulta_id) errors.consulta = 'Selecciona la consulta asociada';
  if (!String(d.padecimiento || '').trim()) errors.padecimiento = 'Indica el padecimiento';
  if (!d.pie_izquierdo && !d.pie_derecho) errors.lateralidad = 'Selecciona al menos un pie';
  return { valid: !Object.keys(errors).length, errors };
}

export function validateTratamiento(t) {
  const errors = {};
  if (!t.fk_consulta_id) errors.consulta = 'Selecciona la consulta asociada';
  if (!String(t.procedimiento_servicio || '').trim()) errors.procedimiento = 'Indica el procedimiento';
  if (!t.pie_izquierdo && !t.pie_derecho) errors.lateralidad = 'Selecciona al menos un pie';
  if (t.fecha_inicio && t.fecha_fin && t.fecha_fin < t.fecha_inicio) errors.fechas = 'La fecha fin no puede ser anterior al inicio';
  return { valid: !Object.keys(errors).length, errors };
}

export const DOC_MAX_BYTES = 10 * 1024 * 1024;
export const DOC_TIPOS_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export function validateDocumento({ consultaId, tipo, file }) {
  const errors = {};
  if (!consultaId) errors.consulta = 'Selecciona la consulta asociada';
  if (!tipo) errors.tipo = 'Selecciona el tipo de documento';
  if (!file) errors.archivo = 'Selecciona un archivo';
  else if (!DOC_TIPOS_MIME.includes(file.type)) errors.archivo = 'Formato no permitido (PDF, JPG, PNG o WEBP)';
  else if (file.size > DOC_MAX_BYTES) errors.archivo = 'El archivo supera 10 MB';
  return { valid: !Object.keys(errors).length, errors };
}
