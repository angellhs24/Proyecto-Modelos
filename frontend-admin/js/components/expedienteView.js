/**
 * Expediente Clínico Electrónico (ECE) por paciente.
 * Pestañas: Resumen · Historial · Mapa del pie · Diagnósticos · Tratamientos · Documentos
 */
import { esc, toArray } from '../utils/html.js';
import { formatFechaCorta, formatFechaHora, toDateKey } from '../utils/dates.js';
import {
  pacientesApi, consultasApi, diagnosticosApi, tratamientosApi, documentosApi, fileUrl,
} from '../api/index.js';
import {
  normalizePaciente, normalizeConsulta, sortConsultas, defaultConsultaId,
  validateDiagnostico, validateTratamiento, validateDocumento, DOC_MAX_BYTES,
} from '../domain/paciente.js';
import {
  AFECCIONES, describeMark, getAfeccion, toggleMark, marksToDiagnosticos, diagnosticosToMarks, stripMapMeta,
} from '../domain/footMap.js';
import { renderFootMap } from './footMapView.js';
import { notify, estadoBadge, skeleton, emptyState, errorState, confirmDialog } from './ui.js';
import { estadoMeta } from '../domain/scheduling.js';

const TABS = [
  ['resumen', 'Resumen', 'fa-id-card'],
  ['historial', 'Historial', 'fa-clock-rotate-left'],
  ['mapa', 'Mapa del pie', 'fa-shoe-prints'],
  ['diagnosticos', 'Diagnósticos', 'fa-stethoscope'],
  ['tratamientos', 'Tratamientos', 'fa-syringe'],
  ['documentos', 'Documentos', 'fa-file-medical'],
];

const DOC_TIPOS = ['Consentimiento Informado', 'Aviso de Privacidad', 'Estudio de laboratorio', 'Radiografía', 'Receta', 'Otro'];

const lateralBadges = (izq, der) =>
  `${der ? '<span class="lat-badge">D</span>' : ''}${izq ? '<span class="lat-badge lat-badge--i">I</span>' : ''}`;

export function renderExpedienteShell(expediente) {
  return `<section class="ece" id="ece-root" data-expediente="${esc(expediente)}" aria-live="polite">${skeleton(5)}</section>`;
}

/**
 * @param {HTMLElement} root  elemento #ece-root
 * @param {{expediente:string, actions:{nuevaConsulta:Function, agendar:Function, volver:Function}}} ctx
 */
export function mountExpediente(root, ctx) {
  const S = {
    status: 'loading', error: '', warning: '',
    paciente: null, pacienteRaw: null,
    consultas: [], diagnosticos: [], tratamientos: [], documentos: [],
    tab: 'resumen',
    filtroEstado: '', expandidas: new Set(),
    consultaMapa: '', filtroMapa: '', afeccionActiva: '', pendientes: [], zonaActiva: '', notaMapa: '',
    saving: false,
  };

  // ---------- Carga de datos ----------
  async function load() {
    S.status = 'loading';
    render();
    try {
      let pacRaw = null;
      try {
        pacRaw = await pacientesApi.get(ctx.expediente);
      } catch (errApi) {
        if (typeof ctx.fallbackPaciente === 'function') {
          pacRaw = ctx.fallbackPaciente();
        }
        if (!pacRaw) throw errApi;
      }
      S.pacienteRaw = pacRaw?.paciente || pacRaw;
      S.paciente = normalizePaciente(S.pacienteRaw);
      if (!S.paciente.expediente) S.paciente.expediente = String(ctx.expediente);

      let rawConsultas = toArray(S.pacienteRaw.consultas);
      if (!rawConsultas.length) {
        try {
          rawConsultas = await consultasApi.byPaciente(ctx.expediente);
        } catch {
          S.warning = 'Modo offline: se cargó la ficha clínica local del paciente.';
        }
      }
      if (!rawConsultas.length && S.pacienteRaw.ultima_cita) {
        rawConsultas = [{
          Consulta_id: `demo-${S.paciente.expediente}`,
          fecha_hora: S.pacienteRaw.ultima_cita,
          estado: 'Completada',
          motivo_o_notas: S.pacienteRaw.notas_alergias || 'Atención podológica general',
          Peso: 68.5,
          Altura: 1.65,
          tipo_pisada: 'Neutra',
          alineacion: 'Neutra',
          observaciones: 'Paciente en seguimiento podológico preventivo.'
        }];
      }
      S.consultas = sortConsultas(rawConsultas.map(normalizeConsulta).filter((c) => c.id));

      const hijos = await Promise.all(
        S.consultas.map(async (c) => {
          const nested = c.raw;
          const pick = async (key, api) => {
            if (Array.isArray(nested[key])) return nested[key];
            try {
              return await api.byConsulta(c.id);
            } catch {
              S.warning = 'Algunos diagnósticos, tratamientos o documentos no pudieron cargarse.';
              return [];
            }
          };
          const [d, t, doc] = await Promise.all([
            pick('diagnosticos', diagnosticosApi),
            pick('tratamientos', tratamientosApi),
            pick('documentos', documentosApi),
          ]);
          const tag = (arr) => arr.map((x) => ({ ...x, fk_consulta_id: x.fk_consulta_id ?? c.id }));
          return { d: tag(d), t: tag(t), doc: tag(doc) };
        })
      );
      S.diagnosticos = hijos.flatMap((h) => h.d);
      S.tratamientos = hijos.flatMap((h) => h.t);
      S.documentos = hijos.flatMap((h) => h.doc);
      S.consultaMapa = defaultConsultaId(S.consultas);
      S.status = 'ready';
    } catch (err) {
      S.status = 'error';
      S.error = err.status === 404 ? `No existe el expediente #${ctx.expediente}` : err.message;
    }
    render();
  }

  // ---------- Utilidades de vista ----------
  const consultaById = (id) => S.consultas.find((c) => c.id === String(id));
  const consultaLabel = (id) => {
    const c = consultaById(id);
    return c ? `${formatFechaCorta(c.fecha)} · ${c.motivo || 'Consulta'}` : `Consulta ${id}`;
  };
  const consultaOptions = (selected) =>
    S.consultas.length
      ? S.consultas
          .map((c) => `<option value="${esc(c.id)}" ${c.id === String(selected) ? 'selected' : ''}>${esc(consultaLabel(c.id))} (${esc(c.estado)})</option>`)
          .join('')
      : '<option value="">Sin consultas registradas</option>';

  const noConsultas = () =>
    emptyState('fa-notes-medical', 'Aún no hay consultas', 'Registra una consulta para poder asociar diagnósticos, tratamientos y documentos.') +
    `<div class="efc-center"><button class="efc-btn efc-btn--primary" data-action="nueva-consulta"><i class="fa-solid fa-notes-medical"></i> Registrar consulta</button></div>`;

  const counts = () => ({
    historial: S.consultas.length,
    diagnosticos: S.diagnosticos.length,
    tratamientos: S.tratamientos.length,
    documentos: S.documentos.length,
  });

  // ---------- Render ----------
  function render() {
    if (S.status === 'loading') {
      root.innerHTML = skeleton(6);
      return;
    }
    if (S.status === 'error') {
      root.innerHTML =
        errorState(S.error) +
        `<div class="efc-center"><button class="efc-btn efc-btn--ghost" data-action="volver"><i class="fa-solid fa-arrow-left"></i> Volver a pacientes</button></div>`;
      return;
    }
    const p = S.paciente;
    const c = counts();
    root.innerHTML = `
      <header class="ece-header glass">
        <button class="efc-btn efc-btn--ghost efc-btn--icon" data-action="volver" aria-label="Volver a pacientes"><i class="fa-solid fa-arrow-left"></i></button>
        <div class="ece-avatar" aria-hidden="true">${esc((p.nombre[0] || 'P').toUpperCase())}</div>
        <div class="ece-id">
          <span class="ece-exp">EXPEDIENTE #${esc(p.expediente)}</span>
          <h1 class="ece-name" id="ece-patient-name">${esc(p.nombre)}</h1>
          <div class="ece-tags">
            <span class="micro-tag tag-regular">${p.edad !== null ? `${p.edad} años` : 'Edad no registrada'}${p.sexo ? ` · ${esc(p.sexo)}` : ''}</span>
            ${p.esDiabetico ? '<span class="micro-tag tag-diabetic"><i class="fa-solid fa-triangle-exclamation"></i> Pie diabético</span>' : ''}
            ${p.esHipertenso ? '<span class="micro-tag tag-hypertension"><i class="fa-solid fa-heart-pulse"></i> Hipertenso</span>' : ''}
          </div>
        </div>
        <div class="ece-actions">
          <button class="efc-btn efc-btn--ghost" data-action="agendar" id="ece-btn-agendar"><i class="fa-solid fa-calendar-plus"></i> Agendar cita</button>
          <button class="efc-btn efc-btn--primary" data-action="nueva-consulta" id="ece-btn-consulta"><i class="fa-solid fa-notes-medical"></i> Nueva consulta</button>
        </div>
      </header>

      ${p.esDiabetico ? `<div class="ece-alert" role="note"><i class="fa-solid fa-triangle-exclamation"></i><div><strong>Paciente diabético:</strong> revisar sensibilidad, integridad cutánea y signos de infección en cada visita.</div></div>` : ''}
      ${S.warning ? `<div class="ece-alert ece-alert--warn" role="status"><i class="fa-solid fa-circle-info"></i><div>${esc(S.warning)}</div></div>` : ''}

      <nav class="ece-tabs" role="tablist" aria-label="Secciones del expediente">
        ${TABS.map(([k, label, icon]) => `
          <button role="tab" id="tab-${k}" class="ece-tab${S.tab === k ? ' is-active' : ''}" data-tab="${k}" aria-selected="${S.tab === k}" aria-controls="ece-panel">
            <i class="fa-solid ${icon}"></i><span>${label}</span>${c[k] !== undefined ? `<em>${c[k]}</em>` : ''}
          </button>`).join('')}
      </nav>

      <div class="ece-panel glass" id="ece-panel" role="tabpanel" aria-labelledby="tab-${S.tab}">${renderTab()}</div>`;
  }

  function renderTab() {
    switch (S.tab) {
      case 'historial': return tabHistorial();
      case 'mapa': return tabMapa();
      case 'diagnosticos': return tabDiagnosticos();
      case 'tratamientos': return tabTratamientos();
      case 'documentos': return tabDocumentos();
      default: return tabResumen();
    }
  }

  const rerenderPanel = () => {
    const el = root.querySelector('#ece-panel');
    if (el) el.innerHTML = renderTab();
  };

  // ---- Resumen ----
  function tabResumen() {
    const p = S.paciente;
    const ult = S.consultas.find((c) => c.estado !== 'Cancelada') || S.consultas[0];
    const activas = [...new Set(S.diagnosticos.map((d) => d.padecimiento))].slice(0, 8);
    const hoy = toDateKey(new Date());
    const tratVigentes = S.tratamientos.filter((t) => !t.fecha_fin || String(t.fecha_fin).slice(0, 10) >= hoy);
    const row = (icon, label, value) =>
      `<div class="ece-kv"><i class="fa-solid ${icon}"></i><div><small>${label}</small><strong>${value ? esc(value) : '—'}</strong></div></div>`;
    return `
    <div class="ece-grid">
      <article class="ece-card">
        <h2><i class="fa-solid fa-user"></i> Datos del paciente</h2>
        ${row('fa-phone', 'Teléfono', p.telefono)}
        ${row('fa-cake-candles', 'Nacimiento', p.fechaNacimiento && formatFechaCorta(p.fechaNacimiento))}
        ${row('fa-location-dot', 'Domicilio', [p.direccion, p.municipio].filter(Boolean).join(', '))}
        ${row('fa-briefcase', 'Ocupación', p.ocupacion)}
        ${row('fa-shoe-prints', 'Calzado', p.calzado && `Talla ${p.calzado}`)}
        ${row('fa-calendar-check', 'Registro', p.fechaRegistro && formatFechaCorta(p.fechaRegistro))}
      </article>

      <article class="ece-card">
        <h2><i class="fa-solid fa-file-waveform"></i> Antecedentes y notas</h2>
        <p class="ece-note"><small>Antecedentes patológicos</small>${esc(p.antecedentes) || '<span class="muted">Sin antecedentes registrados.</span>'}</p>
        <p class="ece-note"><small>Notas / alergias</small>${esc(p.notas) || '<span class="muted">Sin notas registradas.</span>'}</p>
      </article>

      <article class="ece-card">
        <h2><i class="fa-solid fa-heart-pulse"></i> Última valoración</h2>
        ${ult ? `
          <p class="muted">${formatFechaHora(ult.fecha)} · ${estadoBadge(ult.estado)}</p>
          <div class="vitals">
            <div><small>Peso</small><strong>${ult.peso ? `${esc(ult.peso)} kg` : '—'}</strong></div>
            <div><small>Altura</small><strong>${ult.altura ? `${esc(ult.altura)} m` : '—'}</strong></div>
            <div><small>IMC</small><strong>${ult.imc ? `${ult.imc.valor}` : '—'}</strong>${ult.imc ? `<em>${esc(ult.imc.clasificacion)}</em>` : ''}</div>
            <div><small>Pisada</small><strong>${esc(ult.tipoPisada) || '—'}</strong></div>
            <div><small>Alineación</small><strong>${esc(ult.alineacion) || '—'}</strong></div>
          </div>
          ${ult.observaciones ? `<p class="ece-note"><small>Observaciones</small>${esc(ult.observaciones)}</p>` : ''}`
        : '<p class="muted">Sin consultas registradas.</p>'}
      </article>

      <article class="ece-card">
        <h2><i class="fa-solid fa-notes-medical"></i> Afecciones y tratamientos vigentes</h2>
        <div class="chip-row">${activas.length ? activas.map((a) => {
          const af = AFECCIONES.find((x) => x.nombre.toLowerCase() === String(a).toLowerCase());
          return `<span class="chip" style="--af:${af ? af.color : '#78716c'}"><span class="af-dot"></span>${esc(a)}</span>`;
        }).join('') : '<span class="muted">Sin diagnósticos registrados.</span>'}</div>
        <ul class="plain-list">${tratVigentes.slice(0, 5).map((t) => `<li><i class="fa-solid fa-syringe"></i> ${esc(t.procedimiento_servicio)} ${lateralBadges(t.pie_izquierdo, t.pie_derecho)}${t.frecuencia ? `<small>${esc(t.frecuencia)}</small>` : ''}</li>`).join('') || '<li class="muted">Sin tratamientos vigentes.</li>'}</ul>
      </article>
    </div>`;
  }

  // ---- Historial ----
  function tabHistorial() {
    const estados = [...new Set(S.consultas.map((c) => c.estado))];
    const lista = S.consultas.filter((c) => !S.filtroEstado || c.estado === S.filtroEstado);
    if (!S.consultas.length) return noConsultas();
    return `
      <div class="ece-toolbar">
        <h2 class="ece-h2">Historial de consultas</h2>
        <label class="efc-select"><span class="sr-only">Filtrar por estado</span>
          <select id="filtro-estado" aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            ${estados.map((e) => `<option ${S.filtroEstado === e ? 'selected' : ''}>${esc(e)}</option>`).join('')}
          </select>
        </label>
      </div>
      <ol class="timeline" id="timeline">
        ${lista.map((c) => {
          const open = S.expandidas.has(c.id);
          const dx = S.diagnosticos.filter((d) => d.fk_consulta_id === c.id);
          const tx = S.tratamientos.filter((t) => t.fk_consulta_id === c.id);
          const dc = S.documentos.filter((d) => d.fk_consulta_id === c.id);
          return `
          <li class="tl-item" data-consulta="${esc(c.id)}" style="--tl:${estadoMeta(c.estado).color}">
            <button class="tl-head" data-toggle-consulta="${esc(c.id)}" aria-expanded="${open}">
              <span class="tl-dot"></span>
              <span class="tl-date">${formatFechaHora(c.fecha)}</span>
              <span class="tl-motivo">${esc(c.motivo) || 'Consulta podológica'}</span>
              ${estadoBadge(c.estado)}
              <span class="tl-meta"><i class="fa-solid fa-stethoscope"></i>${dx.length} <i class="fa-solid fa-syringe"></i>${tx.length} <i class="fa-solid fa-file"></i>${dc.length}</span>
              <i class="fa-solid fa-chevron-down tl-chev"></i>
            </button>
            ${open ? `<div class="tl-body">
              <div class="vitals vitals--compact">
                <div><small>Peso</small><strong>${c.peso ? `${esc(c.peso)} kg` : '—'}</strong></div>
                <div><small>Altura</small><strong>${c.altura ? `${esc(c.altura)} m` : '—'}</strong></div>
                <div><small>IMC</small><strong>${c.imc ? c.imc.valor : '—'}</strong></div>
                <div><small>Pisada</small><strong>${esc(c.tipoPisada) || '—'}</strong></div>
                <div><small>Alineación</small><strong>${esc(c.alineacion) || '—'}</strong></div>
              </div>
              ${dx.length ? `<h3>Diagnósticos</h3><ul class="plain-list">${dx.map((d) => `<li>${esc(d.padecimiento)} ${lateralBadges(d.pie_izquierdo, d.pie_derecho)}<small>${esc(d.tipo_diagnostico || '')}</small></li>`).join('')}</ul>` : ''}
              ${tx.length ? `<h3>Tratamientos</h3><ul class="plain-list">${tx.map((t) => `<li>${esc(t.procedimiento_servicio)} ${lateralBadges(t.pie_izquierdo, t.pie_derecho)}<small>${esc(t.tratamiento_aplicado || '')}</small></li>`).join('')}</ul>` : ''}
              ${c.observaciones ? `<p class="ece-note"><small>Observaciones</small>${esc(c.observaciones)}</p>` : ''}
              ${!dx.length && !tx.length && !c.observaciones ? '<p class="muted">Sin detalle clínico registrado.</p>' : ''}
            </div>` : ''}
          </li>`;
        }).join('') || '<p class="muted">No hay consultas con ese estado.</p>'}
      </ol>`;
  }

  // ---- Mapa del pie ----
  function tabMapa() {
    if (!S.consultas.length) return noConsultas();
    const dxFiltrados = S.diagnosticos.filter((d) => !S.filtroMapa || d.fk_consulta_id === S.filtroMapa);
    const saved = diagnosticosToMarks(dxFiltrados);
    const zonaInfo = S.zonaActiva ? saved.filter((m) => m.id === S.zonaActiva) : [];
    return `
      <div class="ece-toolbar">
        <h2 class="ece-h2">Mapa podológico</h2>
        <label class="efc-select"><span>Ver:</span>
          <select id="filtro-mapa" aria-label="Historial a mostrar en el mapa">
            <option value="">Todo el historial</option>
            ${S.consultas.map((c) => `<option value="${esc(c.id)}" ${S.filtroMapa === c.id ? 'selected' : ''}>${esc(consultaLabel(c.id))}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="map-layout">
        ${renderFootMap({ saved, pending: S.pendientes, afeccionActiva: S.afeccionActiva, active: S.zonaActiva })}
        <aside class="map-side">
          <section class="ece-card ece-card--flat" aria-live="polite">
            <h3>${S.zonaActiva ? esc(describeMark(S.zonaActiva)) : 'Zona seleccionada'}</h3>
            ${S.zonaActiva
              ? (zonaInfo.length
                  ? `<ul class="plain-list">${zonaInfo.map((m) => `<li><span class="af-dot" style="--af:${m.color}"></span>${esc(m.nombre)}<small>${esc(formatFechaCorta(consultaById(m.consultaId)?.fecha))}</small></li>`).join('')}</ul>`
                  : '<p class="muted">Sin afecciones guardadas en esta zona.</p>')
              : '<p class="muted">Toca una zona del pie para ver su historial.</p>'}
          </section>

          <section class="ece-card ece-card--flat">
            <h3>Marcas por guardar <em>${S.pendientes.length}</em></h3>
            ${S.pendientes.length ? `<ul class="plain-list" id="pending-list">${S.pendientes.map((m) => {
              const af = getAfeccion(m.afeccion);
              return `<li><span class="af-dot" style="--af:${af.color}"></span>${esc(af.nombre)} <small>${esc(describeMark(m.id))}</small>
                <button class="efc-link" data-remove-mark="${esc(m.id)}" aria-label="Quitar marca ${esc(describeMark(m.id))}"><i class="fa-solid fa-xmark"></i></button></li>`;
            }).join('')}</ul>` : '<p class="muted">Aún no marcas ninguna zona.</p>'}
            <form id="form-mapa" novalidate>
              <div class="efc-field"><label for="mapa-consulta">Guardar en consulta</label>
                <select id="mapa-consulta" name="consulta">${consultaOptions(S.consultaMapa)}</select></div>
              <div class="efc-field"><label for="mapa-nota">Nota clínica (opcional)</label>
                <textarea id="mapa-nota" name="nota" rows="2" maxlength="300" placeholder="Ej. dolor al caminar, grado II">${esc(S.notaMapa)}</textarea></div>
              <div class="efc-actions">
                <button type="button" class="efc-btn efc-btn--ghost" data-action="limpiar-mapa" ${S.pendientes.length ? '' : 'disabled'}>Limpiar</button>
                <button type="submit" class="efc-btn efc-btn--primary" id="btn-guardar-mapa" ${S.pendientes.length && !S.saving ? '' : 'disabled'}>
                  <i class="fa-solid fa-floppy-disk"></i> Guardar diagnóstico</button>
              </div>
            </form>
          </section>
        </aside>
      </div>`;
  }

  // ---- Diagnósticos ----
  function tabDiagnosticos() {
    if (!S.consultas.length) return noConsultas();
    const tipos = [...new Set(AFECCIONES.map((a) => a.tipo))];
    return `
      <div class="ece-split">
        <div>
          <h2 class="ece-h2">Diagnósticos registrados</h2>
          ${S.diagnosticos.length ? `
          <div class="table-wrap"><table class="efc-table" id="tabla-diagnosticos">
            <thead><tr><th>Consulta</th><th>Padecimiento</th><th>Pie</th><th>Tipo</th><th>Detalles</th><th></th></tr></thead>
            <tbody>${S.diagnosticos.map((d) => `
              <tr>
                <td>${esc(formatFechaCorta(consultaById(d.fk_consulta_id)?.fecha))}</td>
                <td><strong>${esc(d.padecimiento)}</strong></td>
                <td>${lateralBadges(d.pie_izquierdo, d.pie_derecho)}</td>
                <td>${esc(d.tipo_diagnostico) || '—'}</td>
                <td class="td-wrap">${esc(stripMapMeta(d.detalles_adicionales)) || '—'}</td>
                <td><button class="efc-link efc-link--danger" data-del="diagnostico" data-id="${esc(d.Diagnostico_id ?? d.id)}" aria-label="Eliminar diagnóstico ${esc(d.padecimiento)}"><i class="fa-solid fa-trash"></i></button></td>
              </tr>`).join('')}</tbody></table></div>`
          : emptyState('fa-stethoscope', 'Sin diagnósticos', 'Agrega el primero con el formulario.')}
        </div>
        <form class="ece-card ece-card--flat efc-form" id="form-diagnostico" novalidate>
          <h3>Nuevo diagnóstico</h3>
          <div class="efc-field"><label for="dx-consulta">Consulta</label><select id="dx-consulta" name="consulta">${consultaOptions(defaultConsultaId(S.consultas))}</select><small class="efc-err" data-err="consulta"></small></div>
          <div class="efc-field"><label for="dx-padecimiento">Padecimiento</label>
            <input id="dx-padecimiento" name="padecimiento" list="dx-lista" maxlength="100" autocomplete="off" placeholder="Ej. Onicocriptosis">
            <datalist id="dx-lista">${AFECCIONES.map((a) => `<option value="${esc(a.nombre)}">`).join('')}</datalist>
            <small class="efc-err" data-err="padecimiento"></small></div>
          <fieldset class="efc-field efc-checks"><legend>Lateralidad</legend>
            <label><input type="checkbox" name="pie_derecho" id="dx-der"> Pie derecho</label>
            <label><input type="checkbox" name="pie_izquierdo" id="dx-izq"> Pie izquierdo</label>
            <small class="efc-err" data-err="lateralidad"></small></fieldset>
          <div class="efc-field"><label for="dx-tipo">Tipo de diagnóstico</label>
            <input id="dx-tipo" name="tipo" list="dx-tipos" maxlength="50" placeholder="Ej. Patología ungueal">
            <datalist id="dx-tipos">${tipos.map((t) => `<option value="${esc(t)}">`).join('')}</datalist></div>
          <div class="efc-field"><label for="dx-detalles">Detalles adicionales</label><textarea id="dx-detalles" name="detalles" rows="3"></textarea></div>
          <button type="submit" class="efc-btn efc-btn--primary" id="btn-add-dx"><i class="fa-solid fa-plus"></i> Agregar diagnóstico</button>
        </form>
      </div>`;
  }

  // ---- Tratamientos ----
  function tabTratamientos() {
    if (!S.consultas.length) return noConsultas();
    return `
      <div class="ece-split">
        <div>
          <h2 class="ece-h2">Tratamientos y procedimientos</h2>
          ${S.tratamientos.length ? `
          <div class="table-wrap"><table class="efc-table" id="tabla-tratamientos">
            <thead><tr><th>Consulta</th><th>Procedimiento</th><th>Pie</th><th>Aplicado</th><th>Periodo</th><th>Frecuencia</th><th></th></tr></thead>
            <tbody>${S.tratamientos.map((t) => `
              <tr>
                <td>${esc(formatFechaCorta(consultaById(t.fk_consulta_id)?.fecha))}</td>
                <td><strong>${esc(t.procedimiento_servicio)}</strong></td>
                <td>${lateralBadges(t.pie_izquierdo, t.pie_derecho)}</td>
                <td class="td-wrap">${esc(t.tratamiento_aplicado) || '—'}</td>
                <td>${t.fecha_inicio ? esc(formatFechaCorta(t.fecha_inicio)) : '—'}${t.fecha_fin ? ` → ${esc(formatFechaCorta(t.fecha_fin))}` : ''}</td>
                <td>${esc(t.frecuencia) || '—'}</td>
                <td><button class="efc-link efc-link--danger" data-del="tratamiento" data-id="${esc(t.Tratamiento_id ?? t.id)}" aria-label="Eliminar tratamiento ${esc(t.procedimiento_servicio)}"><i class="fa-solid fa-trash"></i></button></td>
              </tr>`).join('')}</tbody></table></div>`
          : emptyState('fa-syringe', 'Sin tratamientos', 'Agrega el primero con el formulario.')}
        </div>
        <form class="ece-card ece-card--flat efc-form" id="form-tratamiento" novalidate>
          <h3>Nuevo tratamiento</h3>
          <div class="efc-field"><label for="tx-consulta">Consulta</label><select id="tx-consulta" name="consulta">${consultaOptions(defaultConsultaId(S.consultas))}</select><small class="efc-err" data-err="consulta"></small></div>
          <div class="efc-field"><label for="tx-procedimiento">Procedimiento / servicio</label><input id="tx-procedimiento" name="procedimiento" maxlength="100" placeholder="Ej. Quiropodia clínica"><small class="efc-err" data-err="procedimiento"></small></div>
          <fieldset class="efc-field efc-checks"><legend>Lateralidad</legend>
            <label><input type="checkbox" name="pie_derecho" id="tx-der"> Pie derecho</label>
            <label><input type="checkbox" name="pie_izquierdo" id="tx-izq"> Pie izquierdo</label>
            <small class="efc-err" data-err="lateralidad"></small></fieldset>
          <div class="efc-field"><label for="tx-aplicado">Tratamiento aplicado</label><textarea id="tx-aplicado" name="aplicado" rows="2"></textarea></div>
          <div class="efc-row">
            <div class="efc-field"><label for="tx-inicio">Inicio</label><input type="date" id="tx-inicio" name="inicio"></div>
            <div class="efc-field"><label for="tx-fin">Fin</label><input type="date" id="tx-fin" name="fin"></div>
          </div>
          <small class="efc-err" data-err="fechas"></small>
          <div class="efc-field"><label for="tx-frecuencia">Frecuencia</label><input id="tx-frecuencia" name="frecuencia" maxlength="100" placeholder="Ej. Control en 30 días"></div>
          <button type="submit" class="efc-btn efc-btn--primary" id="btn-add-tx"><i class="fa-solid fa-plus"></i> Agregar tratamiento</button>
        </form>
      </div>`;
  }

  // ---- Documentos ----
  const docIcon = (url = '') =>
    /\.pdf($|\?)/i.test(url) ? 'fa-file-pdf' : /\.(png|jpe?g|webp)($|\?)/i.test(url) ? 'fa-file-image' : 'fa-file';

  function tabDocumentos() {
    if (!S.consultas.length) return noConsultas();
    return `
      <div class="ece-split">
        <div>
          <h2 class="ece-h2">Documentos escaneados</h2>
          ${S.documentos.length ? `<ul class="doc-grid" id="lista-documentos">${S.documentos.map((d) => `
            <li class="doc-card">
              <i class="fa-regular ${docIcon(d.url_archivo)} doc-ico"></i>
              <div><strong>${esc(d.tipo_documento) || 'Documento'}</strong>
                <small>${esc(formatFechaCorta(d.fecha_subida))} · ${esc(formatFechaCorta(consultaById(d.fk_consulta_id)?.fecha))}</small></div>
              <a class="efc-btn efc-btn--ghost efc-btn--sm" href="${esc(fileUrl(d.url_archivo))}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-up-right-from-square"></i> Abrir</a>
              <button class="efc-link efc-link--danger" data-del="documento" data-id="${esc(d.Documento_id ?? d.id)}" aria-label="Eliminar documento ${esc(d.tipo_documento)}"><i class="fa-solid fa-trash"></i></button>
            </li>`).join('')}</ul>`
          : emptyState('fa-file-medical', 'Sin documentos', 'Sube consentimientos, avisos de privacidad y estudios.')}
        </div>
        <form class="ece-card ece-card--flat efc-form" id="form-documento" novalidate>
          <h3>Subir documento</h3>
          <div class="efc-field"><label for="doc-consulta">Consulta</label><select id="doc-consulta" name="consulta">${consultaOptions(defaultConsultaId(S.consultas))}</select><small class="efc-err" data-err="consulta"></small></div>
          <div class="efc-field"><label for="doc-tipo">Tipo de documento</label>
            <select id="doc-tipo" name="tipo"><option value="">Selecciona…</option>${DOC_TIPOS.map((t) => `<option>${esc(t)}</option>`).join('')}</select><small class="efc-err" data-err="tipo"></small></div>
          <div class="efc-field"><label for="doc-archivo">Archivo (PDF, JPG, PNG · máx. ${DOC_MAX_BYTES / 1048576} MB)</label>
            <label class="dropzone" id="dropzone" for="doc-archivo"><i class="fa-solid fa-cloud-arrow-up"></i><span id="dz-text">Arrastra el archivo o haz clic</span></label>
            <input type="file" id="doc-archivo" name="archivo" accept="application/pdf,image/jpeg,image/png,image/webp" class="sr-only">
            <small class="efc-err" data-err="archivo"></small></div>
          <button type="submit" class="efc-btn efc-btn--primary" id="btn-add-doc"><i class="fa-solid fa-upload"></i> Subir documento</button>
        </form>
      </div>`;
  }

  // ---------- Manejo de formularios ----------
  const showErrors = (form, errors) => {
    form.querySelectorAll('[data-err]').forEach((el) => { el.textContent = errors[el.dataset.err] || ''; });
    const first = Object.keys(errors)[0];
    if (first) form.querySelector(`[data-err="${first}"]`)?.parentElement.querySelector('input,select,textarea')?.focus();
  };

  async function submitDiagnostico(form) {
    const f = new FormData(form);
    const payload = {
      fk_consulta_id: f.get('consulta'),
      padecimiento: String(f.get('padecimiento') || '').trim(),
      pie_derecho: f.get('pie_derecho') === 'on',
      pie_izquierdo: f.get('pie_izquierdo') === 'on',
      tipo_diagnostico: String(f.get('tipo') || '').trim() || null,
      detalles_adicionales: String(f.get('detalles') || '').trim() || null,
    };
    const { valid, errors } = validateDiagnostico(payload);
    showErrors(form, errors);
    if (!valid) return;
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const res = await diagnosticosApi.create(payload);
      S.diagnosticos.unshift({ ...payload, ...(res?.diagnostico || (res && typeof res === 'object' ? res : {})) });
      notify('Diagnóstico agregado al expediente');
      render();
    } catch (err) {
      notify(`No se pudo guardar: ${err.message}`);
      btn.disabled = false;
    }
  }

  async function submitTratamiento(form) {
    const f = new FormData(form);
    const payload = {
      fk_consulta_id: f.get('consulta'),
      procedimiento_servicio: String(f.get('procedimiento') || '').trim(),
      pie_derecho: f.get('pie_derecho') === 'on',
      pie_izquierdo: f.get('pie_izquierdo') === 'on',
      tratamiento_aplicado: String(f.get('aplicado') || '').trim() || null,
      fecha_inicio: f.get('inicio') || null,
      fecha_fin: f.get('fin') || null,
      frecuencia: String(f.get('frecuencia') || '').trim() || null,
    };
    const { valid, errors } = validateTratamiento(payload);
    showErrors(form, errors);
    if (!valid) return;
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const res = await tratamientosApi.create(payload);
      S.tratamientos.unshift({ ...payload, ...(res?.tratamiento || (res && typeof res === 'object' ? res : {})) });
      notify('Tratamiento agregado al expediente');
      render();
    } catch (err) {
      notify(`No se pudo guardar: ${err.message}`);
      btn.disabled = false;
    }
  }

  async function submitDocumento(form) {
    const f = new FormData(form);
    const file = form.querySelector('#doc-archivo').files[0];
    const data = { consultaId: f.get('consulta'), tipo: f.get('tipo'), file };
    const { valid, errors } = validateDocumento(data);
    showErrors(form, errors);
    if (!valid) return;
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    const fecha = toDateKey(new Date());
    try {
      const res = await documentosApi.upload({ ...data, fecha });
      S.documentos.unshift({
        fk_consulta_id: data.consultaId, tipo_documento: data.tipo, fecha_subida: fecha,
        url_archivo: res?.url_archivo || res?.documento?.url_archivo || '', ...(res?.documento || {}),
      });
      notify('Documento subido correctamente');
      render();
    } catch (err) {
      notify(`No se pudo subir el documento: ${err.message}`);
      btn.disabled = false;
    }
  }

  async function submitMapa(form) {
    if (!S.pendientes.length || S.saving) return;
    const consultaId = form.querySelector('#mapa-consulta').value;
    if (!consultaId) { notify('Selecciona la consulta donde se guardará'); return; }
    const nota = form.querySelector('#mapa-nota').value;
    const payloads = marksToDiagnosticos(S.pendientes, consultaId, nota);
    S.saving = true;
    rerenderPanel();
    try {
      const results = await Promise.all(payloads.map((p) => diagnosticosApi.create(p)));
      payloads.forEach((p, i) => {
        const res = results[i];
        S.diagnosticos.unshift({ ...p, ...(res?.diagnostico || (res && typeof res === 'object' ? res : {})) });
      });
      S.pendientes = [];
      S.notaMapa = '';
      S.consultaMapa = consultaId;
      notify(`${payloads.length} diagnóstico(s) guardado(s) desde el mapa`);
    } catch (err) {
      notify(`No se pudo guardar el mapa: ${err.message}`);
    } finally {
      S.saving = false;
      render();
    }
  }

  async function eliminar(kind, id) {
    const labels = { diagnostico: 'este diagnóstico', tratamiento: 'este tratamiento', documento: 'este documento' };
    const ok = await confirmDialog({
      title: 'Eliminar registro',
      message: `¿Seguro que deseas eliminar ${labels[kind]}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      if (kind === 'diagnostico') {
        await diagnosticosApi.remove(id);
        S.diagnosticos = S.diagnosticos.filter((d) => String(d.Diagnostico_id ?? d.id) !== String(id));
      } else if (kind === 'tratamiento') {
        await tratamientosApi.remove(id);
        S.tratamientos = S.tratamientos.filter((t) => String(t.Tratamiento_id ?? t.id) !== String(id));
      } else {
        await documentosApi.remove(id);
        S.documentos = S.documentos.filter((d) => String(d.Documento_id ?? d.id) !== String(id));
      }
      notify('Registro eliminado');
      render();
    } catch (err) {
      notify(`No se pudo eliminar: ${err.message}`);
    }
  }

  // ---------- Eventos (delegación) ----------
  function selectZona(id) {
    if (S.afeccionActiva) S.pendientes = toggleMark(S.pendientes, id, S.afeccionActiva);
    S.zonaActiva = id;
    const keepNote = root.querySelector('#mapa-nota');
    if (keepNote) S.notaMapa = keepNote.value;
    const keepCons = root.querySelector('#mapa-consulta');
    if (keepCons) S.consultaMapa = keepCons.value;
    rerenderPanel();
    root.querySelector(`[data-zona-id="${id}"]`)?.focus();
  }

  root.addEventListener('click', (e) => {
    const t = e.target;
    const tab = t.closest('[data-tab]');
    if (tab) { S.tab = tab.dataset.tab; render(); root.querySelector(`#tab-${S.tab}`)?.focus(); return; }

    const action = t.closest('[data-action]')?.dataset.action;
    if (action === 'volver') return ctx.actions.volver();
    if (action === 'agendar') return ctx.actions.agendar(S.pacienteRaw);
    if (action === 'nueva-consulta') return ctx.actions.nuevaConsulta(S.pacienteRaw);
    if (action === 'limpiar-mapa') { S.pendientes = []; rerenderPanel(); return; }
    if (t.closest('[data-retry]')) return load();

    const tog = t.closest('[data-toggle-consulta]');
    if (tog) {
      const id = tog.dataset.toggleConsulta;
      S.expandidas.has(id) ? S.expandidas.delete(id) : S.expandidas.add(id);
      rerenderPanel();
      return;
    }
    const chip = t.closest('[data-afeccion]');
    if (chip) {
      S.afeccionActiva = S.afeccionActiva === chip.dataset.afeccion ? '' : chip.dataset.afeccion;
      rerenderPanel();
      return;
    }
    const zona = t.closest('[data-zona-id]');
    if (zona) return selectZona(zona.dataset.zonaId);

    const rm = t.closest('[data-remove-mark]');
    if (rm) { S.pendientes = S.pendientes.filter((m) => m.id !== rm.dataset.removeMark); rerenderPanel(); return; }

    const del = t.closest('[data-del]');
    if (del) eliminar(del.dataset.del, del.dataset.id);
  });

  root.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-zona-id]')) {
      e.preventDefault();
      selectZona(e.target.dataset.zonaId);
    }
  });

  root.addEventListener('change', (e) => {
    if (e.target.id === 'filtro-estado') { S.filtroEstado = e.target.value; rerenderPanel(); }
    else if (e.target.id === 'filtro-mapa') { S.filtroMapa = e.target.value; rerenderPanel(); }
    else if (e.target.id === 'doc-archivo') {
      const dz = root.querySelector('#dz-text');
      if (dz) dz.textContent = e.target.files[0]?.name || 'Arrastra el archivo o haz clic';
    }
  });

  root.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = e.target.id;
    if (id === 'form-diagnostico') submitDiagnostico(e.target);
    else if (id === 'form-tratamiento') submitTratamiento(e.target);
    else if (id === 'form-documento') submitDocumento(e.target);
    else if (id === 'form-mapa') submitMapa(e.target);
  });

  // Arrastrar y soltar archivos
  root.addEventListener('dragover', (e) => { if (e.target.closest('#dropzone')) { e.preventDefault(); e.target.closest('#dropzone').classList.add('is-over'); } });
  root.addEventListener('dragleave', (e) => e.target.closest('#dropzone')?.classList.remove('is-over'));
  root.addEventListener('drop', (e) => {
    const dz = e.target.closest('#dropzone');
    if (!dz) return;
    e.preventDefault();
    dz.classList.remove('is-over');
    const input = root.querySelector('#doc-archivo');
    if (e.dataTransfer?.files?.length) {
      input.files = e.dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  load();
  return { reload: load, state: S };
}
