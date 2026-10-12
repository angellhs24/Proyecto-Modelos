/**
 * Lógica de agenda (pura, sin DOM): estados, normalización de citas,
 * detección de choques de horario, sugerencias y alertas.
 */
import { AGENDA } from '../config.js';
import { parseDate, addMinutes, toDateKey, toTimeKey, toMySQLDateTime } from '../utils/dates.js';

/** Catálogo de estados. `activo` = ocupa el horario del podólogo. */
export const ESTADOS = Object.freeze({
  Programada: { label: 'Programada', color: '#2563eb', bg: '#eff6ff', icon: 'fa-calendar-check', activo: true },
  Pendiente: { label: 'Pendiente', color: '#d97706', bg: '#fef3c7', icon: 'fa-hourglass-half', activo: true },
  Confirmada: { label: 'Confirmada', color: '#2e8b68', bg: '#eaf6f0', icon: 'fa-circle-check', activo: true },
  'En curso': { label: 'En curso', color: '#7c3aed', bg: '#f4f0f9', icon: 'fa-user-doctor', activo: true },
  Realizada: { label: 'Realizada', color: '#57534e', bg: '#f5f5f4', icon: 'fa-clipboard-check', activo: true },
  Completada: { label: 'Completada', color: '#57534e', bg: '#f5f5f4', icon: 'fa-clipboard-check', activo: true },
  Cancelada: { label: 'Cancelada', color: '#e11d48', bg: '#ffe4e6', icon: 'fa-ban', activo: false },
  'No asistió': { label: 'No asistió', color: '#a8a29e', bg: '#f5f5f4', icon: 'fa-user-slash', activo: false },
});

export const ESTADOS_EDITABLES = ['Programada', 'Confirmada', 'Pendiente', 'En curso', 'Realizada', 'Cancelada', 'No asistió'];

const FINALES = ['Realizada', 'Completada', 'Cancelada', 'No asistió'];

export function estadoMeta(estado) {
  return ESTADOS[estado] || { label: estado || 'Sin estado', color: '#78716c', bg: '#f5f5f4', icon: 'fa-circle-question', activo: true };
}

export const esEstadoActivo = (estado) => estadoMeta(estado).activo;
export const esEstadoFinal = (estado) => FINALES.includes(estado);

/** Una cita finalizada no puede reabrirse salvo a 'Programada' tras cancelación. */
export function canTransition(from, to) {
  if (from === to) return false;
  if (['Realizada', 'Completada'].includes(from)) return false;
  if (from === 'Cancelada' || from === 'No asistió') return to === 'Programada';
  return ESTADOS_EDITABLES.includes(to);
}

/**
 * Unifica citas del backend (o de la versión anterior de la app) en un formato único.
 * Soporta: Consulta_id/id_cita/id, fecha_hora/fecha_hora_inicio, paciente_nombre/Nombres...
 */
export function normalizeCita(raw = {}) {
  const start = parseDate(raw.fecha_hora ?? raw.fecha_hora_inicio ?? raw.start);
  const nombre =
    raw.paciente_nombre ||
    raw.nombre_completo ||
    [raw.Nombres, raw.ape_paterno, raw.ape_materno].filter(Boolean).join(' ') ||
    'Paciente sin nombre';
  const dur = Number(raw.duracion_min) > 0 ? Number(raw.duracion_min) : AGENDA.DURACION_MIN;
  return {
    id: String(raw.Consulta_id ?? raw.id_cita ?? raw.id ?? ''),
    start,
    end: start ? addMinutes(start, dur) : null,
    duracionMin: dur,
    paciente: nombre,
    expediente: String(raw.fk_no_expediente ?? raw.No_expediente ?? raw.expediente ?? raw.id_paciente ?? ''),
    telefono: raw.paciente_telefono ?? raw.telefono ?? '',
    estado: raw.estado || 'Programada',
    motivo: raw.motivo_o_notas ?? raw.motivo ?? '',
    clinicaId: Number(raw.fk_clinica_id ?? raw.id_clinica ?? raw.Clinica_id) || null,
    podologo: raw.fk_cedula_podologo ?? raw.Cedula_podologo ?? null,
    esDiabetico: !!(raw.es_diabetico === true || raw.es_diabetico === 1),
    esHipertenso: !!(raw.es_hipertenso === true || raw.es_hipertenso === 1),
  };
}

export const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

/**
 * Busca citas que choquen con un intervalo propuesto.
 * Choca si hay solape de tiempo y: es el mismo podólogo (o alguno no lo declara)
 * o es el mismo paciente (no puede estar en dos citas a la vez).
 * Las citas canceladas / no asistidas no ocupan horario.
 */
export function findConflicts(proposal, citas, { ignoreId = null } = {}) {
  const start = parseDate(proposal.start);
  if (!start) return [];
  const dur = Number(proposal.duracionMin) > 0 ? Number(proposal.duracionMin) : AGENDA.DURACION_MIN;
  const end = addMinutes(start, dur);

  return citas
    .map((c) => (c.start && c.end ? c : normalizeCita(c)))
    .filter((c) => c.start && c.id !== String(ignoreId ?? '__none__') && esEstadoActivo(c.estado))
    .filter((c) => overlaps(start, end, c.start, c.end))
    .map((c) => {
      const mismoPodologo = !proposal.podologo || !c.podologo || proposal.podologo === c.podologo;
      const mismoPaciente = !!proposal.expediente && String(proposal.expediente) === c.expediente;
      return { cita: c, mismoPodologo, mismoPaciente };
    })
    .filter((x) => x.mismoPodologo || x.mismoPaciente)
    .map((x) => ({
      ...x,
      tipo: x.mismoPaciente && !x.mismoPodologo ? 'paciente' : 'podologo',
      mensaje: x.mismoPaciente
        ? `${x.cita.paciente} ya tiene una cita a las ${toTimeKey(x.cita.start)}`
        : `Horario ocupado por ${x.cita.paciente} (${toTimeKey(x.cita.start)}–${toTimeKey(x.cita.end)})`,
    }));
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function isWithinBusinessHours(start, durationMin = AGENDA.DURACION_MIN) {
  const d = parseDate(start);
  if (!d) return false;
  if (d.getDay() === 0) return false; // domingo cerrado
  const s = d.getHours() * 60 + d.getMinutes();
  return s >= toMinutes(AGENDA.HORA_INICIO) && s + durationMin <= toMinutes(AGENDA.HORA_FIN);
}

/**
 * Sugiere los próximos huecos libres a partir de `from` (máx. `limit`),
 * recorriendo hasta `maxDays` días en pasos de AGENDA.PASO_MIN.
 */
export function suggestSlots(from, citas, { podologo = null, expediente = '', durationMin = AGENDA.DURACION_MIN, limit = 3, maxDays = 14 } = {}) {
  const base = parseDate(from);
  if (!base) return [];
  const res = [];
  const cursor = new Date(base);
  const rem = cursor.getMinutes() % AGENDA.PASO_MIN;
  if (rem) cursor.setMinutes(cursor.getMinutes() + (AGENDA.PASO_MIN - rem), 0, 0);
  const limitDate = new Date(base.getTime() + maxDays * 86400000);

  while (cursor <= limitDate && res.length < limit) {
    if (
      isWithinBusinessHours(cursor, durationMin) &&
      findConflicts({ start: cursor, duracionMin: durationMin, podologo, expediente }, citas).length === 0
    ) {
      res.push(new Date(cursor));
    }
    cursor.setMinutes(cursor.getMinutes() + AGENDA.PASO_MIN);
  }
  return res;
}

/** Pares de citas activas que se solapan (mismo podologo o podologo no declarado). */
export function findConflictPairs(citas) {
  const activas = citas
    .map((c) => (c.start && c.end ? c : normalizeCita(c)))
    .filter((c) => c.start && esEstadoActivo(c.estado))
    .sort((a, b) => a.start - b.start);
  const pairs = [];
  for (let i = 0; i < activas.length; i++) {
    for (let j = i + 1; j < activas.length; j++) {
      if (activas[j].start >= activas[i].end) break;
      const a = activas[i], b = activas[j];
      if (!a.podologo || !b.podologo || a.podologo === b.podologo) pairs.push([a, b]);
    }
  }
  return pairs;
}
/**
 * Alertas para el panel de notificaciones:
 *  - 'proxima'   : cita activa que inicia en los próximos N minutos
 *  - 'vencida'   : cita de hoy ya pasada y aún Programada/Pendiente/Confirmada
 *  - 'choque'    : dos citas activas que se solapan
 */
export function buildAlerts(citas, now = new Date(), { ventanaMin = AGENDA.ALERTA_PREVIA_MIN } = {}) {
  const list = citas.map((c) => (c.start && c.end ? c : normalizeCita(c))).filter((c) => c.start);
  const alerts = [];
  const sameDay = (d) => toDateKey(d) === toDateKey(now);

  for (const c of list) {
    if (!esEstadoActivo(c.estado) || esEstadoFinal(c.estado)) continue;
    const diffMin = (c.start - now) / 60000;
    if (diffMin >= 0 && diffMin <= ventanaMin) {
      alerts.push({
        id: `proxima-${c.id}`, tipo: 'proxima', severidad: 'info', citaId: c.id,
        titulo: `Próxima cita en ${Math.max(1, Math.round(diffMin))} min`,
        detalle: `${c.paciente} · ${toTimeKey(c.start)}`,
      });
    } else if (diffMin < 0 && sameDay(c.start)) {
      alerts.push({
        id: `vencida-${c.id}`, tipo: 'vencida', severidad: 'warning', citaId: c.id,
        titulo: 'Cita sin atender',
        detalle: `${c.paciente} · ${toTimeKey(c.start)} sigue "${c.estado}"`,
      });
    }
  }

  for (const [a, b] of findConflictPairs(list)) {
    alerts.push({
      id: `choque-${a.id}-${b.id}`, tipo: 'choque', severidad: 'danger', citaId: a.id,
      titulo: 'Choque de horarios',
      detalle: `${a.paciente} y ${b.paciente} se solapan (${toTimeKey(a.start)})`,
    });
  }

  const peso = { danger: 0, warning: 1, info: 2 };
  return alerts.sort((x, y) => peso[x.severidad] - peso[y.severidad]);
}

/**
 * Validación del formulario de nueva cita (pura).
 * @returns {{ valid:boolean, errors:Object, start:Date|null }}
 */
export function validateCitaForm({ paciente, fecha, hora }, now = new Date(), { toleranciaMin = 5 } = {}) {
  const errors = {};
  if (!paciente || !paciente.expediente) errors.paciente = 'Selecciona un paciente';
  let start = null;
  if (!fecha) errors.fecha = 'Selecciona la fecha';
  if (!hora) errors.hora = 'Selecciona la hora';
  if (fecha && hora) {
    start = parseDate(`${fecha} ${hora}`);
    if (!start) errors.fecha = 'Fecha u hora inválida';
    else if (start.getTime() < now.getTime() - toleranciaMin * 60000) errors.fecha = 'No se puede agendar en el pasado';
  }
  return { valid: Object.keys(errors).length === 0, errors, start: errors.fecha || errors.hora ? null : start };
}

/** Payload para POST /api/citas (compatible con el backend existente). */
export function buildCitaPayload({ paciente, start, duracionMin, motivo, estado, clinicaId, podologo }) {
  const fecha = toMySQLDateTime(parseDate(start));
  return {
    fk_no_expediente: paciente.expediente,
    id_paciente: paciente.expediente,
    fk_clinica_id: clinicaId,
    id_clinica: clinicaId,
    fk_cedula_podologo: podologo || undefined,
    fecha_hora: fecha,
    fecha_hora_inicio: fecha,
    duracion_min: duracionMin || AGENDA.DURACION_MIN,
    motivo_o_notas: motivo || 'Consulta podológica',
    estado: estado || 'Programada',
    nombre_completo: paciente.nombre,
    telefono: paciente.telefono || undefined,
  };
}
