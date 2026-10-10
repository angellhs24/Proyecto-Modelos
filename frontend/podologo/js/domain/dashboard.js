/**
 * Dominio · Indicadores del Panel Analítico (Dashboard).
 * Calcula métricas a partir de citas, pacientes e inventario (puro y testeable).
 */
import { normalizeCita, ESTADOS } from './scheduling.js';
import { toDateKey } from '../utils/dates.js';
import { resumenInventario } from './inventario.js';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Estados considerados como "atendidos" para productividad. */
const ATENDIDOS = ['Completada', 'Realizada'];

/**
 * @param {{appointments?:object[], patients?:object[], insumos?:object[], now?:Date}} input
 */
export function computeDashboard({ appointments = [], patients = [], insumos = [], now = new Date() } = {}) {
  const citas = appointments.map(normalizeCita);
  const hoyKey = toDateKey(now);

  const citasHoy = citas.filter((c) => c.start && toDateKey(c.start) === hoyKey);
  const porEstado = {};
  for (const c of citas) porEstado[c.estado] = (porEstado[c.estado] || 0) + 1;

  const estados = Object.keys(porEstado)
    .map((estado) => ({ estado, total: porEstado[estado], color: ESTADOS[estado]?.color || '#78716c' }))
    .sort((a, b) => b.total - a.total);

  // Serie de los últimos 7 días (incluye hoy).
  const serie = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = toDateKey(d);
    serie.push({
      key,
      label: DIAS[d.getDay()],
      total: citas.filter((c) => c.start && toDateKey(c.start) === key).length,
      esHoy: i === 0,
    });
  }

  const motivos = {};
  for (const c of citas) {
    const m = (c.motivo || 'Sin motivo').trim();
    motivos[m] = (motivos[m] || 0) + 1;
  }
  const topMotivos = Object.entries(motivos)
    .map(([motivo, total]) => ({ motivo, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const pacientesUnicos = new Set(patients.map((p) => String(p.expediente ?? p.No_expediente ?? p.id_paciente ?? p.nombre_completo)));
  const diabeticos = patients.filter((p) => p.es_diabetico === true || p.es_diabetico === 1).length;
  const hipertensos = patients.filter((p) => p.es_hipertenso === true || p.es_hipertenso === 1).length;

  const total = citas.length;
  const atendidas = citas.filter((c) => ATENDIDOS.includes(c.estado)).length;
  const canceladas = citas.filter((c) => ['Cancelada', 'No asistió'].includes(c.estado)).length;

  return {
    citasHoy: citasHoy.length,
    citasHoyLista: citasHoy.sort((a, b) => a.start - b.start),
    citasTotal: total,
    pacientesTotal: pacientesUnicos.size,
    diabeticos,
    hipertensos,
    estados,
    serie,
    maxSerie: Math.max(1, ...serie.map((s) => s.total)),
    topMotivos,
    tasaAtencion: total ? Math.round((atendidas / total) * 100) : 0,
    tasaCancelacion: total ? Math.round((canceladas / total) * 100) : 0,
    inventario: resumenInventario(insumos, now),
  };
}
