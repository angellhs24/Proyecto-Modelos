/**
 * Capa de Presentación · Gestión de Recetas Médicas (prescripciones podológicas).
 * Emite recetas asociadas al expediente del paciente y las exporta a PDF/impresión.
 * Solo roles con la capacidad `receta.emitir` (Podólogo / Administrador).
 */
import { esc } from '../utils/html.js';
import { recetasApi } from '../api/index.js';
import { normalizePaciente } from '../domain/paciente.js';
import {
  MEDICAMENTO_VACIO, VIAS_ADMINISTRACION, validateReceta, normalizeReceta, buildRecetaDocument, buildFolio,
} from '../domain/receta.js';
import { can } from '../core/rbac.js';
import { formatFechaHora, toMySQLDateTime } from '../utils/dates.js';
import { printHtml } from '../utils/print.js';
import { notify, skeleton, emptyState } from './ui.js';
import { pageHeader } from './shellView.js';

export function renderRecetasShell() {
  return '<section class="module" id="recetas-root" aria-live="polite"></section>';
}

/**
 * @param {HTMLElement} root
 * @param {{getRole:Function, getPatients:Function, getPodologo:Function, clinicName:Function, initialExpediente?:string}} ctx
 */
export function mountRecetas(root, ctx) {
  const S = {
    status: 'loading', source: 'api', historial: [], errors: {},
    expediente: ctx.initialExpediente || '', diagnostico: '', indicaciones: '',
    meds: [{ ...MEDICAMENTO_VACIO }],
  };

  const pacientes = () => (ctx.getPatients() || []).map(normalizePaciente).filter((p) => p.expediente);
  const puedeEmitir = () => can(ctx.getRole(), 'receta.emitir');

  async function load() {
    try {
      const r = await recetasApi.list();
      S.historial = r.data;
      S.source = r.source;
    } catch {
      S.historial = [];
    }
    S.status = 'ready';
    paint();
  }

  function readForm() {
    S.expediente = root.querySelector('#rx-paciente')?.value || '';
    S.diagnostico = root.querySelector('#rx-diagnostico')?.value || '';
    S.indicaciones = root.querySelector('#rx-indicaciones')?.value || '';
    S.meds = [...root.querySelectorAll('[data-med-row]')].map((row) => ({
      medicamento: row.querySelector('[name=medicamento]').value,
      dosis: row.querySelector('[name=dosis]').value,
      via: row.querySelector('[name=via]').value,
      frecuencia: row.querySelector('[name=frecuencia]').value,
      duracion: row.querySelector('[name=duracion]').value,
    }));
  }

  const err = (k) => (S.errors[k] ? `<small class="field-err" role="alert">${esc(S.errors[k])}</small>` : '');

  function medRows() {
    return S.meds
      .map(
        (m, i) => `
      <div class="med-row" data-med-row="${i}">
        <label class="field field--med">Medicamento<input name="medicamento" maxlength="120" value="${esc(m.medicamento)}" placeholder="Ej. Crema de urea 20%" autocomplete="off"></label>
        <label class="field field--dosis">Dosis<input name="dosis" maxlength="80" value="${esc(m.dosis)}" placeholder="Ej. Capa fina"></label>
        <label class="field field--via">Vía<select name="via">${VIAS_ADMINISTRACION.map((v) => `<option ${m.via === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
        <label class="field field--frec">Frecuencia<input name="frecuencia" maxlength="80" value="${esc(m.frecuencia)}" placeholder="Ej. Cada 12 h"></label>
        <label class="field field--dur">Duración<input name="duracion" maxlength="60" value="${esc(m.duracion)}" placeholder="Ej. 7 días"></label>
        <button type="button" class="efc-btn efc-btn--ghost efc-btn--icon" data-del-med="${i}" aria-label="Quitar medicamento" ${S.meds.length === 1 ? 'disabled' : ''}><i class="fa-solid fa-trash"></i></button>
      </div>`
      )
      .join('');
  }

  function historialHtml() {
    if (!S.historial.length) return emptyState('fa-prescription', 'Sin recetas emitidas', 'Las recetas que generes aparecerán aquí.');
    return `<ul class="rx-list">${S.historial
      .slice(0, 12)
      .map(
        (r, i) => `
      <li>
        <div><strong>${esc(r.folio)}</strong><small>${esc(r.paciente || r.expediente)} · ${esc(formatFechaHora(r.fecha))}</small><small>${esc((r.medicamentos || []).map((m) => m.medicamento).join(', '))}</small></div>
        <button type="button" class="efc-btn efc-btn--ghost efc-btn--sm" data-print-rx="${i}"><i class="fa-solid fa-print" aria-hidden="true"></i> Imprimir / PDF</button>
      </li>`
      )
      .join('')}</ul>`;
  }

  function paint() {
    if (S.status === 'loading') {
      root.innerHTML = pageHeader({ title: 'Recetas médicas', icon: 'fa-prescription' }) + skeleton(5);
      return;
    }
    const lista = pacientes();
    root.innerHTML = `
      ${pageHeader({ title: 'Recetas médicas', icon: 'fa-prescription', subtitle: 'Prescripciones podológicas vinculadas al expediente del paciente' })}
      ${S.source === 'local' ? '<div class="ece-alert ece-alert--warn" role="status"><i class="fa-solid fa-circle-info"></i><div>Modo local: el endpoint <code>/api/recetas</code> no está disponible; el historial se conserva solo en esta sesión.</div></div>' : ''}
      <div class="split">
        <form id="form-receta" class="panel glass form-grid" novalidate>
          <header class="panel-head span2"><h3>Nueva receta</h3><span class="panel-tag">${esc(ctx.clinicName())}</span></header>
          <label class="field span2">Paciente
            <select id="rx-paciente" name="expediente" required>
              <option value="">Selecciona un paciente…</option>
              ${lista.map((p) => `<option value="${esc(p.expediente)}" ${S.expediente === p.expediente ? 'selected' : ''}>${esc(p.nombre)} · Exp. ${esc(p.expediente)}</option>`).join('')}
            </select>${err('expediente')}
          </label>
          <label class="field span2">Diagnóstico<input id="rx-diagnostico" name="diagnostico" maxlength="300" value="${esc(S.diagnostico)}" placeholder="Ej. Onicomicosis en hallux derecho" autocomplete="off">${err('diagnostico')}</label>
          <div class="span2"><span class="lbl">Prescripción</span>${err('medicamentos')}<div id="meds">${medRows()}</div>
            <button type="button" class="efc-btn efc-btn--ghost efc-btn--sm" id="btn-add-med"><i class="fa-solid fa-plus"></i> Agregar medicamento</button></div>
          <label class="field span2">Indicaciones generales<textarea id="rx-indicaciones" name="indicaciones" rows="3" maxlength="800" placeholder="Cuidados, higiene, calzado, próxima revisión…">${esc(S.indicaciones)}</textarea></label>
          ${err('podologo')}
          <div class="efc-actions span2">
            <button type="submit" class="efc-btn efc-btn--primary" id="btn-emitir-receta"><i class="fa-solid fa-file-signature"></i> Emitir y generar PDF</button>
          </div>
        </form>

        <aside class="panel glass">
          <header class="panel-head"><h3>Recetas emitidas</h3><span class="panel-tag">Historial</span></header>
          ${historialHtml()}
        </aside>
      </div>`;
  }

  async function submit() {
    readForm();
    const pac = pacientes().find((p) => p.expediente === S.expediente);
    const pod = ctx.getPodologo() || {};
    const draft = {
      expediente: S.expediente,
      paciente: pac?.nombre || '',
      edad: pac?.edad ?? '',
      alergias: pac?.notas || '',
      diagnostico: S.diagnostico,
      medicamentos: S.meds,
      indicaciones: S.indicaciones,
      podologo: { nombre: pod.nombreCompleto || '', cedula: pod.cedula || '' },
      clinica: ctx.clinicName(),
      fecha: toMySQLDateTime(new Date()),
    };
    const { valid, errors } = validateReceta(draft);
    S.errors = errors;
    if (!valid) {
      paint();
      root.querySelector('.field-err')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    try {
      const folio = buildFolio(new Date(), S.historial.length + 1);
      const res = await recetasApi.create({ ...draft, folio });
      const guardada = normalizeReceta({ ...draft, folio, ...(res.data || {}) });
      notify(`Receta ${guardada.folio} emitida`);
      S.errors = {};
      S.diagnostico = '';
      S.indicaciones = '';
      S.meds = [{ ...MEDICAMENTO_VACIO }];
      await load();
      await printHtml(buildRecetaDocument(guardada));
    } catch (e) {
      notify(e.message || 'No se pudo emitir la receta');
    }
  }

  root.addEventListener('submit', (e) => {
    e.preventDefault();
    if (e.target.id === 'form-receta') submit();
  });

  root.addEventListener('click', (e) => {
    if (e.target.closest('#btn-add-med')) {
      readForm();
      if (S.meds.length < 10) S.meds.push({ ...MEDICAMENTO_VACIO });
      paint();
      return;
    }
    const del = e.target.closest('[data-del-med]');
    if (del) {
      readForm();
      S.meds.splice(Number(del.dataset.delMed), 1);
      if (!S.meds.length) S.meds.push({ ...MEDICAMENTO_VACIO });
      paint();
      return;
    }
    const pr = e.target.closest('[data-print-rx]');
    if (pr) printHtml(buildRecetaDocument(S.historial[Number(pr.dataset.printRx)]));
  });

  if (!puedeEmitir()) {
    root.innerHTML = pageHeader({ title: 'Recetas médicas', icon: 'fa-prescription' }) +
      emptyState('fa-lock', 'Acceso restringido', 'Tu rol no tiene permiso para emitir recetas.');
    return { destroy() {} };
  }

  paint();
  load();
  return { reload: load, state: S, destroy() {} };
}
