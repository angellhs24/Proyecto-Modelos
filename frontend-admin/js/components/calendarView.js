/**
 * Gestión de agenda inteligente: calendario FullCalendar conectado a /api/citas y /api/consultas.
 * - Estados de cita con color, alertas de choque, sugerencia de huecos libres
 * - Arrastrar para reprogramar (con validación), nueva cita, cambio de estado
 */
import { esc } from '../utils/html.js';
import { debounce } from '../utils/html.js';
import {
  parseDate, toDateKey, toTimeKey, toMySQLDateTime, formatFechaHora, formatFechaCorta,
} from '../utils/dates.js';
import { pacientesApi, citasApi, consultasApi } from '../api/index.js';
import { normalizePaciente } from '../domain/paciente.js';
import {
  ESTADOS, estadoMeta, esEstadoActivo, esEstadoFinal, canTransition, findConflicts, findConflictPairs,
  suggestSlots, isWithinBusinessHours, validateCitaForm, buildCitaPayload, normalizeCita,
} from '../domain/scheduling.js';
import { AGENDA } from '../config.js';
import { agendaStore } from '../core/agendaStore.js';
import { openModal, closeAllModals, notify, estadoBadge, confirmDialog } from './ui.js';

const MOTIVOS = [
  'Quiropodia clínica general', 'Control de pie diabético', 'Onicocriptosis', 'Hiperqueratosis / callosidades',
  'Verruga plantar', 'Micosis ungueal', 'Valoración y estudio de la pisada', 'Revisión de tratamiento',
];

export function renderAgendaShell(clinicName = '') {
  const legend = Object.entries(ESTADOS)
    .filter(([k]) => !['Completada'].includes(k))
    .map(([k, m]) => `<span class="legend-item" style="--b-color:${m.color}"><i></i>${esc(m.label)}</span>`)
    .join('');
  return `
  <section class="agenda" id="agenda-root">
    <header class="agenda-head glass">
      <div>
        <h1 class="agenda-title">Agenda</h1>
        <p class="agenda-sub"><i class="fa-solid fa-location-dot"></i> <span id="agenda-clinic">${esc(clinicName)}</span></p>
      </div>
      <div class="agenda-head-actions">
        <button class="efc-btn efc-btn--ghost efc-btn--icon bell-btn" type="button" data-agenda-action="bell" id="agenda-bell" aria-label="Notificaciones">
          <i class="fa-regular fa-bell"></i><span class="bell-badge" data-notif-badge hidden>0</span>
        </button>
        <button class="efc-btn efc-btn--primary" type="button" data-agenda-action="nueva" id="btn-nueva-cita"><i class="fa-solid fa-calendar-plus"></i> Nueva cita</button>
      </div>
    </header>
    <div id="agenda-banner"></div>
    <div class="agenda-legend" aria-label="Leyenda de estados">${legend}
      <label class="legend-toggle"><input type="checkbox" id="toggle-canceladas" checked> Mostrar canceladas</label>
    </div>
    <div class="agenda-cal glass"><div id="calendar" aria-label="Calendario de citas"></div></div>
  </section>`;
}

/**
 * @param {HTMLElement} root
 * @param {{ getClinicaId:()=>number, podologo:()=>string|null,
 *           actions:{abrirExpediente:Function, iniciarConsulta:Function, fallbackCitas:Function, localPacientes:Function, toggleNotifications:Function} }} ctx
 */
export function mountAgenda(root, ctx) {
  const calEl = root.querySelector('#calendar');
  if (!calEl) return { destroy() {} };
  if (typeof window.FullCalendar === 'undefined') {
    calEl.innerHTML = '<div class="efc-empty efc-empty--error"><i class="fa-solid fa-triangle-exclamation"></i><strong>No se pudo cargar FullCalendar</strong><p>Verifica js/vendor/fullcalendar.index.global.min.js (npm run vendor).</p></div>';
    return { destroy() {} };
  }

  let mostrarCanceladas = true;

  const banner = () => {
    const b = root.querySelector('#agenda-banner');
    if (!b) return;
    const pairs = findConflictPairs(agendaStore.state.citas);
    b.innerHTML = [
      agendaStore.state.offline
        ? '<div class="ece-alert ece-alert--warn" role="status"><i class="fa-solid fa-plug-circle-xmark"></i><div>Sin conexión con el servidor: se muestran citas locales. Los cambios no se guardarán.</div></div>'
        : '',
      pairs.length
        ? `<div class="ece-alert ece-alert--danger" role="alert" id="banner-choques"><i class="fa-solid fa-triangle-exclamation"></i><div><strong>${pairs.length} choque(s) de horario</strong> detectado(s): ${pairs.slice(0, 3).map(([a, c]) => `${esc(a.paciente)} / ${esc(c.paciente)} (${toTimeKey(a.start)})`).join(', ')}</div></div>`
        : '',
    ].join('');
  };

  // ---------- Eventos para FullCalendar ----------
  function toEvents() {
    const conflictIds = new Set(findConflictPairs(agendaStore.state.citas).flat().map((c) => c.id));
    return agendaStore.state.citas
      .filter((c) => mostrarCanceladas || esEstadoActivo(c.estado))
      .map((c) => {
        const m = estadoMeta(c.estado);
        const editable = esEstadoActivo(c.estado) && !esEstadoFinal(c.estado);
        return {
          id: c.id,
          title: c.paciente,
          start: c.start,
          end: c.end,
          backgroundColor: m.bg,
          borderColor: m.color,
          textColor: '#211c19',
          startEditable: editable,
          durationEditable: false,
          classNames: [
            `fc-estado-${c.estado.replace(/\s+/g, '-').toLowerCase()}`,
            conflictIds.has(c.id) ? 'fc-has-conflict' : '',
            !esEstadoActivo(c.estado) ? 'fc-muted' : '',
          ].filter(Boolean),
          extendedProps: { cita: c },
        };
      });
  }

  const calendar = new window.FullCalendar.Calendar(calEl, {
    locale: 'es',
    initialView: window.matchMedia('(max-width: 767px)').matches ? 'listWeek' : 'timeGridWeek',
    firstDay: 1,
    height: 'auto',
    nowIndicator: true,
    selectable: false,
    editable: true,
    allDaySlot: false,
    slotMinTime: '08:00:00',
    slotMaxTime: '20:00:00',
    slotDuration: '00:30:00',
    expandRows: true,
    businessHours: { daysOfWeek: [1, 2, 3, 4, 5, 6], startTime: AGENDA.HORA_INICIO, endTime: AGENDA.HORA_FIN },
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' },
    buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día', list: 'Lista' },
    noEventsText: 'No hay citas en este periodo',
    events: (_info, success) => success(toEvents()),
    dateClick: (info) => {
      const d = info.date;
      // En vista mensual la fecha llega a medianoche: proponer 10:00.
      if (info.allDay || (d.getHours() === 0 && d.getMinutes() === 0)) d.setHours(10, 0, 0, 0);
      abrirModalCita({ start: d });
    },
    eventClick: (info) => abrirModalDetalle(info.event.id),
    eventDidMount: (info) => {
      const c = info.event.extendedProps.cita;
      info.el.setAttribute('data-cita-id', c.id);
      info.el.setAttribute('data-estado', c.estado);
      info.el.title = `${c.paciente} · ${c.estado}${c.motivo ? ` · ${c.motivo}` : ''}`;
    },
    eventAllow: (_drop, dragged) => dragged.extendedProps.cita && esEstadoActivo(dragged.extendedProps.cita.estado),
    eventDrop: async (info) => {
      const cita = info.event.extendedProps.cita;
      const nuevo = info.event.start;
      const choques = findConflicts(
        { start: nuevo, duracionMin: cita.duracionMin, podologo: cita.podologo, expediente: cita.expediente },
        agendaStore.state.citas,
        { ignoreId: cita.id }
      );
      if (choques.length) {
        info.revert();
        notify(`No se puede reprogramar: ${choques[0].mensaje}`);
        return;
      }
      if (nuevo < new Date()) {
        info.revert();
        notify('No se puede reprogramar a una fecha pasada');
        return;
      }
      try {
        await consultasApi.reschedule(cita.id, toMySQLDateTime(nuevo));
        agendaStore.patch(cita.id, { start: nuevo, end: new Date(nuevo.getTime() + cita.duracionMin * 60000) });
        notify(`Cita reprogramada: ${formatFechaHora(nuevo)}`);
        calendar.refetchEvents();
      } catch (err) {
        info.revert();
        notify(err.status === 409 ? 'El servidor detectó un choque de horario' : `No se pudo reprogramar: ${err.message}`);
      }
    },
  });
  calendar.render();

  const unsub = agendaStore.subscribe(() => {
    calendar.refetchEvents();
    banner();
  });

  async function recargar() {
    await agendaStore.load(ctx.getClinicaId(), { fallback: ctx.actions.fallbackCitas });
  }

  // ---------- Modal: nueva cita ----------
  function abrirModalCita({ start = new Date(), paciente = null } = {}) {
    const fechaInicial = toDateKey(start);
    const horaInicial = toTimeKey(start);
    let seleccionado = paciente ? normalizePaciente(paciente) : null;
    let resultados = [];

    const modal = openModal({
      id: 'modal-cita',
      title: 'Nueva cita',
      subtitle: 'Agenda una consulta y revisa disponibilidad al instante',
      width: 600,
      body: `
      <form id="form-cita" novalidate class="efc-form">
        <div class="efc-field">
          <label for="cita-buscar">Paciente</label>
          <div id="cita-seleccion" ${seleccionado ? '' : 'hidden'}></div>
          <div id="cita-buscador" ${seleccionado ? 'hidden' : ''}>
            <input id="cita-buscar" type="search" autocomplete="off" placeholder="Nombre, teléfono o No. de expediente" role="combobox" aria-expanded="false" aria-controls="cita-resultados">
            <ul id="cita-resultados" class="pac-results" role="listbox" hidden></ul>
          </div>
          <small class="efc-err" data-err="paciente"></small>
        </div>

        <div class="efc-row efc-row--3">
          <div class="efc-field"><label for="cita-fecha">Fecha</label><input type="date" id="cita-fecha" value="${fechaInicial}" min="${toDateKey(new Date())}"><small class="efc-err" data-err="fecha"></small></div>
          <div class="efc-field"><label for="cita-hora">Hora</label><input type="time" id="cita-hora" value="${horaInicial}" step="1800"><small class="efc-err" data-err="hora"></small></div>
          <div class="efc-field"><label for="cita-duracion">Duración</label>
            <select id="cita-duracion"><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option></select></div>
        </div>

        <div id="cita-conflictos" aria-live="polite"></div>

        <div class="efc-row">
          <div class="efc-field"><label for="cita-motivo">Motivo</label>
            <input id="cita-motivo" list="cita-motivos" maxlength="150" value="${MOTIVOS[0]}">
            <datalist id="cita-motivos">${MOTIVOS.map((m) => `<option value="${esc(m)}">`).join('')}</datalist></div>
          <div class="efc-field"><label for="cita-estado">Estado</label>
            <select id="cita-estado"><option>Programada</option><option>Confirmada</option><option>Pendiente</option></select></div>
        </div>

        <div class="efc-actions">
          <button type="button" class="efc-btn efc-btn--ghost" data-modal-close>Cancelar</button>
          <button type="submit" class="efc-btn efc-btn--primary" id="cita-guardar"><i class="fa-solid fa-calendar-check"></i> Agendar cita</button>
        </div>
      </form>`,
    });
    const $ = (s) => modal.el.querySelector(s);
    const form = $('#form-cita');

    const pintarSeleccion = () => {
      const box = $('#cita-seleccion');
      const finder = $('#cita-buscador');
      if (seleccionado) {
        box.hidden = false;
        finder.hidden = true;
        box.innerHTML = `<div class="pac-chip" id="cita-paciente-sel"><span class="pac-avatar">${esc(seleccionado.nombre[0] || 'P')}</span>
          <div><strong>${esc(seleccionado.nombre)}</strong><small>Exp. #${esc(seleccionado.expediente)}${seleccionado.telefono ? ` · ${esc(seleccionado.telefono)}` : ''}</small></div>
          <button type="button" class="efc-link" id="cita-cambiar-paciente">Cambiar</button></div>`;
      } else {
        box.hidden = true;
        finder.hidden = false;
      }
      validar();
    };

    // Estado de validación en vivo (choques + horario)
    function leerForm() {
      return {
        fecha: $('#cita-fecha').value,
        hora: $('#cita-hora').value,
        duracionMin: Number($('#cita-duracion').value),
      };
    }
    let sobrecupoPermitido = false;
    function validar() {
      const { fecha, hora, duracionMin } = leerForm();
      const cont = $('#cita-conflictos');
      const startDate = fecha && hora ? parseDate(`${fecha} ${hora}`) : null;
      if (!startDate) { cont.innerHTML = ''; return { conflictos: [] }; }

      const conflictos = findConflicts(
        { start: startDate, duracionMin, podologo: ctx.podologo(), expediente: seleccionado?.expediente },
        agendaStore.state.citas
      );
      const fueraHorario = !isWithinBusinessHours(startDate, duracionMin);
      let html = '';
      if (conflictos.length) {
        const sugerencias = suggestSlots(startDate, agendaStore.state.citas, {
          podologo: ctx.podologo(), expediente: seleccionado?.expediente, durationMin: duracionMin, limit: 3,
        });
        html += `<div class="conflict-box" role="alert" id="aviso-choque">
          <strong><i class="fa-solid fa-triangle-exclamation"></i> Choque de horario</strong>
          <ul>${conflictos.map((c) => `<li>${esc(c.mensaje)}</li>`).join('')}</ul>
          ${sugerencias.length ? `<div class="slot-row"><span>Horarios libres:</span>${sugerencias.map((s) => `<button type="button" class="slot-btn" data-slot="${toDateKey(s)} ${toTimeKey(s)}">${esc(formatFechaCorta(s))} ${toTimeKey(s)}</button>`).join('')}</div>` : ''}
          <label class="override"><input type="checkbox" id="cita-sobrecupo" ${sobrecupoPermitido ? 'checked' : ''}> Agendar de todos modos (sobrecupo)</label>
        </div>`;
      } else if (seleccionado) {
        html += '<div class="ok-box" id="aviso-libre"><i class="fa-solid fa-circle-check"></i> Horario disponible</div>';
      }
      if (fueraHorario) html += `<div class="warn-box" id="aviso-horario"><i class="fa-solid fa-clock"></i> Fuera del horario de atención (${AGENDA.HORA_INICIO}–${AGENDA.HORA_FIN}, lunes a sábado).</div>`;
      cont.innerHTML = html;
      return { conflictos };
    }

    const buscar = debounce(async (q) => {
      const lista = $('#cita-resultados');
      if (q.length < 2) { lista.hidden = true; return; }
      const ql = q.toLowerCase();
      const local = (ctx.actions.localPacientes?.() || []).map(normalizePaciente)
        .filter((p) => (p.nombre || '').toLowerCase().includes(ql) || (p.expediente || '').includes(q) || (p.telefono || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')));

      resultados = local;
      lista.innerHTML = resultados.length
        ? resultados.map((p, i) => `<li role="option" tabindex="0" data-pac="${i}"><strong>${esc(p.nombre)}</strong><small>Exp. #${esc(p.expediente)}${p.telefono ? ` · ${esc(p.telefono)}` : ''}</small></li>`).join('')
        : '<li class="pac-none">Sin resultados</li>';
      lista.hidden = false;
      $('#cita-buscar').setAttribute('aria-expanded', 'true');

      if (!agendaStore.state.offline) {
        try {
          const remotos = (await pacientesApi.search(q)).map(normalizePaciente);
          if (remotos.length) {
            resultados = remotos.slice(0, 6);
            lista.innerHTML = resultados.map((p, i) => `<li role="option" tabindex="0" data-pac="${i}"><strong>${esc(p.nombre)}</strong><small>Exp. #${esc(p.expediente)}${p.telefono ? ` · ${esc(p.telefono)}` : ''}</small></li>`).join('');
          }
        } catch {}
      }
    }, 80);

    const elegir = (i) => {
      seleccionado = resultados[i];
      $('#cita-resultados').hidden = true;
      pintarSeleccion();
    };

    modal.el.addEventListener('input', (e) => {
      if (e.target.id === 'cita-buscar') buscar(e.target.value.trim());
      if (['cita-fecha', 'cita-hora', 'cita-duracion'].includes(e.target.id)) { sobrecupoPermitido = false; validar(); }
    });
    modal.el.addEventListener('change', (e) => {
      if (e.target.id === 'cita-sobrecupo') sobrecupoPermitido = e.target.checked;
      if (['cita-fecha', 'cita-hora', 'cita-duracion'].includes(e.target.id)) validar();
    });
    modal.el.addEventListener('click', (e) => {
      const li = e.target.closest('[data-pac]');
      if (li) return elegir(Number(li.dataset.pac));
      if (e.target.closest('#cita-cambiar-paciente')) { seleccionado = null; pintarSeleccion(); $('#cita-buscar').focus(); return; }
      const slot = e.target.closest('[data-slot]');
      if (slot) {
        const [f, h] = slot.dataset.slot.split(' ');
        $('#cita-fecha').value = f;
        $('#cita-hora').value = h;
        validar();
      }
    });
    modal.el.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-pac]')) { e.preventDefault(); elegir(Number(e.target.dataset.pac)); }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { fecha, hora, duracionMin } = leerForm();
      const { valid, errors, start: startDate } = validateCitaForm({ paciente: seleccionado, fecha, hora });
      form.querySelectorAll('[data-err]').forEach((el) => { el.textContent = errors[el.dataset.err] || ''; });
      if (!valid) return;

      const { conflictos } = validar();
      if (conflictos.length && !sobrecupoPermitido) {
        $('#aviso-choque')?.scrollIntoView({ block: 'nearest' });
        notify('Resuelve el choque de horario o marca el sobrecupo');
        return;
      }

      const btn = $('#cita-guardar');
      btn.disabled = true;
      const payload = buildCitaPayload({
        paciente: seleccionado, start: startDate, duracionMin,
        motivo: $('#cita-motivo').value.trim(), estado: $('#cita-estado').value,
        clinicaId: ctx.getClinicaId(), podologo: ctx.podologo(),
      });
      try {
        await citasApi.create(payload);
        notify(`Cita agendada: ${seleccionado.nombre} · ${formatFechaHora(startDate)}`);
        modal.close();
        await recargar();
        ctx.actions.afterCitaCreada?.();
      } catch (err) {
        btn.disabled = false;
        if (err.status === 409) {
          $('#cita-conflictos').innerHTML = `<div class="conflict-box" role="alert" id="aviso-choque"><strong><i class="fa-solid fa-triangle-exclamation"></i> El servidor rechazó la cita</strong><ul><li>${esc(err.message)}</li></ul></div>`;
        } else {
          notify(`No se pudo agendar: ${err.message}`);
        }
      }
    });

    pintarSeleccion();
  }

  // ---------- Modal: detalle de cita ----------
  function abrirModalDetalle(id) {
    const cita = agendaStore.find(id);
    if (!cita) return;
    const m = estadoMeta(cita.estado);
    const acciones = [
      ['Confirmada', 'Confirmar', 'fa-circle-check', 'efc-btn--success'],
      ['Cancelada', 'Cancelar cita', 'fa-ban', 'efc-btn--danger'],
      ['No asistió', 'No asistió', 'fa-user-slash', 'efc-btn--ghost'],
      ['Programada', 'Reactivar', 'fa-rotate-left', 'efc-btn--ghost'],
    ].filter(([to]) => canTransition(cita.estado, to));

    const modal = openModal({
      id: 'modal-detalle-cita',
      title: cita.paciente,
      subtitle: `Exp. #${cita.expediente || '—'}`,
      width: 520,
      body: `
        <div class="detalle-head" style="--b-color:${m.color}">${estadoBadge(cita.estado)}
          ${cita.esDiabetico ? '<span class="micro-tag tag-diabetic">Pie diabético</span>' : ''}
          ${cita.esHipertenso ? '<span class="micro-tag tag-hypertension">Hipertenso</span>' : ''}</div>
        <dl class="detalle-grid">
          <div><dt>Fecha y hora</dt><dd id="det-fecha">${esc(formatFechaHora(cita.start))}</dd></div>
          <div><dt>Duración</dt><dd>${cita.duracionMin} min</dd></div>
          <div><dt>Motivo</dt><dd>${esc(cita.motivo) || '—'}</dd></div>
          <div><dt>Teléfono</dt><dd>${esc(cita.telefono) || '—'}</dd></div>
        </dl>
        <div class="efc-actions efc-actions--wrap">
          ${acciones.map(([to, label, icon, cls]) => `<button type="button" class="efc-btn ${cls}" data-estado="${esc(to)}"><i class="fa-solid ${icon}"></i> ${label}</button>`).join('')}
        </div>
        <div class="efc-actions efc-actions--wrap detalle-main">
          <button type="button" class="efc-btn efc-btn--ghost" data-det="expediente" ${cita.expediente ? '' : 'disabled'}><i class="fa-solid fa-folder-open"></i> Abrir expediente</button>
          <button type="button" class="efc-btn efc-btn--primary" data-det="consulta" ${esEstadoActivo(cita.estado) && !esEstadoFinal(cita.estado) ? '' : 'disabled'}><i class="fa-solid fa-notes-medical"></i> Iniciar consulta</button>
        </div>`,
    });

    modal.el.addEventListener('click', async (e) => {
      const det = e.target.closest('[data-det]')?.dataset.det;
      if (det === 'expediente') { modal.close(); ctx.actions.abrirExpediente(cita.expediente); return; }
      if (det === 'consulta') { modal.close(); ctx.actions.iniciarConsulta(cita); return; }
      const nuevo = e.target.closest('[data-estado]')?.dataset.estado;
      if (!nuevo) return;
      if (nuevo === 'Cancelada') {
        const ok = await confirmDialog({
          title: 'Cancelar cita', message: `¿Cancelar la cita de ${cita.paciente} del ${formatFechaHora(cita.start)}?`,
          confirmLabel: 'Sí, cancelar', danger: true,
        });
        if (!ok) return;
      }
      try {
        await consultasApi.updateEstado(cita.id, nuevo);
        agendaStore.patch(cita.id, { estado: nuevo });
        notify(`Cita actualizada a "${nuevo}"`);
        modal.close();
      } catch (err) {
        notify(`No se pudo actualizar: ${err.message}`);
      }
    });
  }

  banner();
  return {
    calendar,
    recargar,
    abrirModalCita,
    abrirModalDetalle,
    setMostrarCanceladas(v) { mostrarCanceladas = v; calendar.refetchEvents(); },
    destroy() {
      unsub();
      calendar.destroy();
      closeAllModals();
    },
  };
}
