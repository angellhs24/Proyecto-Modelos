/**
 * Dominio · Prescripciones médicas (recetas) y Expediente Clínico Electrónico (ECE) imprimible.
 * Todo texto interpolado en los documentos se escapa con `esc()` (anti-XSS).
 */
import { esc } from '../utils/html.js';
import { sanitizeText } from '../core/sanitize.js';
import { formatFechaCorta, formatFechaHora, toDateKey } from '../utils/dates.js';

export const VIAS_ADMINISTRACION = Object.freeze(['Tópica', 'Oral', 'Intramuscular', 'Subcutánea', 'Ótica']);

export const MEDICAMENTO_VACIO = Object.freeze({ medicamento: '', dosis: '', via: 'Tópica', frecuencia: '', duracion: '' });

export function buildFolio(now = new Date(), secuencia = 1) {
  const ymd = toDateKey(now).replace(/-/g, '');
  return `RX-${ymd}-${String(secuencia).padStart(4, '0')}`;
}

export function validateReceta(r = {}) {
  const errors = {};
  if (!sanitizeText(r.expediente)) errors.expediente = 'Selecciona al paciente (No. de expediente)';
  if (!sanitizeText(r.diagnostico)) errors.diagnostico = 'Indica el diagnóstico';
  const meds = Array.isArray(r.medicamentos) ? r.medicamentos : [];
  const completos = meds.filter((m) => sanitizeText(m.medicamento));
  if (!completos.length) errors.medicamentos = 'Agrega al menos un medicamento';
  else if (completos.some((m) => !sanitizeText(m.dosis) || !sanitizeText(m.frecuencia))) {
    errors.medicamentos = 'Cada medicamento requiere dosis y frecuencia';
  }
  if (!sanitizeText(r.podologo?.cedula)) errors.podologo = 'La receta requiere la cédula profesional del podólogo';
  return { valid: !Object.keys(errors).length, errors };
}

/** Limpia y normaliza la receta antes de guardarla/imprimirla. */
export function normalizeReceta(r = {}) {
  return {
    folio: sanitizeText(r.folio, { maxLength: 30 }),
    fecha: String(r.fecha || '').slice(0, 19),
    expediente: sanitizeText(r.expediente, { maxLength: 32 }),
    paciente: sanitizeText(r.paciente, { maxLength: 140 }),
    edad: r.edad === null || r.edad === undefined ? '' : sanitizeText(r.edad, { maxLength: 4 }),
    alergias: sanitizeText(r.alergias, { maxLength: 300 }),
    diagnostico: sanitizeText(r.diagnostico, { maxLength: 300 }),
    medicamentos: (r.medicamentos || [])
      .filter((m) => sanitizeText(m.medicamento))
      .map((m) => ({
        medicamento: sanitizeText(m.medicamento, { maxLength: 120 }),
        dosis: sanitizeText(m.dosis, { maxLength: 80 }),
        via: VIAS_ADMINISTRACION.includes(m.via) ? m.via : 'Tópica',
        frecuencia: sanitizeText(m.frecuencia, { maxLength: 80 }),
        duracion: sanitizeText(m.duracion, { maxLength: 60 }),
      })),
    indicaciones: sanitizeText(r.indicaciones, { multiline: true, maxLength: 800 }),
    podologo: {
      nombre: sanitizeText(r.podologo?.nombre, { maxLength: 140 }),
      cedula: sanitizeText(r.podologo?.cedula, { maxLength: 20 }),
    },
    clinica: sanitizeText(r.clinica, { maxLength: 140 }),
  };
}

const PRINT_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#10243a;padding:32px 40px;font-size:12.5px;line-height:1.5}
  header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0e7c86;padding-bottom:14px;margin-bottom:18px}
  h1{font-size:20px;color:#0b2545} h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#0e7c86;margin:18px 0 8px}
  .meta{text-align:right;font-size:11.5px;color:#4a5b6d}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th,td{border:1px solid #d5dee7;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#eef5f7;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px}
  .lbl{color:#4a5b6d;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
  .box{border:1px solid #d5dee7;border-radius:8px;padding:10px 12px;background:#fafcfd;white-space:pre-wrap}
  .firma{margin-top:56px;text-align:center}
  .firma div{width:260px;margin:0 auto;border-top:1px solid #10243a;padding-top:6px}
  footer{margin-top:28px;font-size:10.5px;color:#6b7a89;border-top:1px solid #d5dee7;padding-top:8px}
  .alert{background:#fff4e5;border:1px solid #f3c98b;border-radius:8px;padding:8px 12px;margin:10px 0;color:#7a4a00}
  @page{margin:14mm}
`;

const doc = (title, body) =>
  `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body>${body}</body></html>`;

const field = (label, value) => `<div><span class="lbl">${esc(label)}</span><br>${esc(value || '—')}</div>`;

/** Documento imprimible/PDF de una receta médica. */
export function buildRecetaDocument(receta) {
  const r = normalizeReceta(receta);
  const rows = r.medicamentos
    .map(
      (m, i) =>
        `<tr><td>${i + 1}</td><td><strong>${esc(m.medicamento)}</strong></td><td>${esc(m.dosis)}</td><td>${esc(m.via)}</td><td>${esc(m.frecuencia)}</td><td>${esc(m.duracion || '—')}</td></tr>`
    )
    .join('');
  const body = `
    <header>
      <div><h1>${esc(r.clinica || 'Elite Foot Care')}</h1><div>Receta médica podológica</div></div>
      <div class="meta"><strong>Folio ${esc(r.folio)}</strong><br>${esc(formatFechaHora(r.fecha))}</div>
    </header>
    <h2>Datos del paciente</h2>
    <div class="grid">${field('Paciente', r.paciente)}${field('Expediente', r.expediente)}${field('Edad', r.edad ? `${r.edad} años` : '')}${field('Alergias / notas', r.alergias)}</div>
    <h2>Diagnóstico</h2><div class="box">${esc(r.diagnostico)}</div>
    <h2>Prescripción</h2>
    <table><thead><tr><th>#</th><th>Medicamento</th><th>Dosis</th><th>Vía</th><th>Frecuencia</th><th>Duración</th></tr></thead><tbody>${rows}</tbody></table>
    ${r.indicaciones ? `<h2>Indicaciones</h2><div class="box">${esc(r.indicaciones)}</div>` : ''}
    <div class="firma"><div>${esc(r.podologo.nombre)}<br>Cédula profesional ${esc(r.podologo.cedula)}</div></div>
    <footer>Documento generado por el Sistema de Gestión Podológica. La información clínica es confidencial (NOM-004-SSA3-2012).</footer>`;
  return doc(`Receta ${r.folio}`, body);
}

/**
 * Documento imprimible del Expediente Clínico Electrónico (ECE).
 * @param {{paciente:object, consultas:object[], diagnosticos:object[], tratamientos:object[], clinica?:string, podologo?:object, generado?:Date}} d
 */
export function buildEceDocument(d) {
  const p = d.paciente || {};
  const sinMapa = (x) => !String(x.padecimiento || '').startsWith('[');
  const consultas = (d.consultas || [])
    .map(
      (c) =>
        `<tr><td>${esc(formatFechaHora(c.fecha))}</td><td>${esc(c.estado)}</td><td>${esc(c.motivo || '—')}</td><td>${esc([c.peso ? `${c.peso} kg` : '', c.altura ? `${c.altura} m` : '', c.tipoPisada].filter(Boolean).join(' · ') || '—')}</td><td>${esc(c.observaciones || '—')}</td></tr>`
    )
    .join('');
  const dx = (d.diagnosticos || [])
    .filter(sinMapa)
    .map(
      (x) =>
        `<tr><td>${esc(x.padecimiento)}</td><td>${esc([x.pie_derecho ? 'Derecho' : '', x.pie_izquierdo ? 'Izquierdo' : ''].filter(Boolean).join(' / ') || '—')}</td><td>${esc(x.tipo_diagnostico || '—')}</td><td>${esc(x.detalles_adicionales || '—')}</td></tr>`
    )
    .join('');
  const tx = (d.tratamientos || [])
    .map(
      (x) =>
        `<tr><td>${esc(x.procedimiento_servicio)}</td><td>${esc([x.pie_derecho ? 'Derecho' : '', x.pie_izquierdo ? 'Izquierdo' : ''].filter(Boolean).join(' / ') || '—')}</td><td>${esc(x.tratamiento_aplicado || '—')}</td><td>${esc(x.frecuencia || '—')}</td></tr>`
    )
    .join('');
  const empty = (cols) => `<tr><td colspan="${cols}" style="text-align:center;color:#6b7a89">Sin registros</td></tr>`;
  const body = `
    <header>
      <div><h1>Expediente Clínico Electrónico</h1><div>${esc(d.clinica || 'Elite Foot Care')}</div></div>
      <div class="meta"><strong>Expediente #${esc(p.expediente)}</strong><br>Generado: ${esc(formatFechaHora(d.generado || new Date()))}</div>
    </header>
    <h2>Ficha de identificación</h2>
    <div class="grid">
      ${field('Paciente', p.nombre)}${field('Expediente', p.expediente)}
      ${field('Edad / Sexo', [p.edad !== null && p.edad !== undefined ? `${p.edad} años` : '', p.sexo].filter(Boolean).join(' · '))}${field('Teléfono', p.telefono)}
      ${field('Domicilio', [p.direccion, p.municipio].filter(Boolean).join(', '))}${field('Ocupación', p.ocupacion)}
      ${field('Calzado habitual', p.calzado)}${field('Fecha de registro', p.fechaRegistro ? formatFechaCorta(p.fechaRegistro) : '')}
    </div>
    ${p.esDiabetico || p.esHipertenso ? `<div class="alert"><strong>Alertas clínicas:</strong> ${esc([p.esDiabetico ? 'Paciente diabético (pie de riesgo)' : '', p.esHipertenso ? 'Hipertensión arterial' : ''].filter(Boolean).join(' · '))}</div>` : ''}
    <h2>Antecedentes y notas</h2><div class="box">${esc([p.antecedentes, p.notas].filter(Boolean).join('\n') || 'Sin antecedentes registrados')}</div>
    <h2>Historial de consultas</h2>
    <table><thead><tr><th>Fecha</th><th>Estado</th><th>Motivo</th><th>Biometría</th><th>Observaciones</th></tr></thead><tbody>${consultas || empty(5)}</tbody></table>
    <h2>Diagnósticos</h2>
    <table><thead><tr><th>Padecimiento</th><th>Pie</th><th>Tipo</th><th>Detalles</th></tr></thead><tbody>${dx || empty(4)}</tbody></table>
    <h2>Tratamientos y procedimientos</h2>
    <table><thead><tr><th>Procedimiento</th><th>Pie</th><th>Tratamiento aplicado</th><th>Frecuencia</th></tr></thead><tbody>${tx || empty(4)}</tbody></table>
    <div class="firma"><div>${esc(d.podologo?.nombre || 'Podólogo tratante')}<br>${d.podologo?.cedula ? `Cédula profesional ${esc(d.podologo.cedula)}` : ''}</div></div>
    <footer>Documento confidencial. Datos personales protegidos conforme a la LFPDPPP y la NOM-004-SSA3-2012 del Expediente Clínico.</footer>`;
  return doc(`ECE ${p.expediente || ''}`, body);
}
