/**
 * Capa de Presentación · Panel Principal Analítico (Dashboard).
 * Tarjetas de métricas, gráfico de citas de los últimos 7 días, estado de consultas,
 * agenda del día y alertas de inventario. Gráficos 100 % CSS (sin dependencias externas).
 */
import { esc } from '../utils/html.js';
import { computeDashboard } from '../domain/dashboard.js';
import { estadoMeta, normalizeCita } from '../domain/scheduling.js';
import { inventarioApi } from '../api/index.js';
import { navItemsFor } from '../core/rbac.js';
import { toTimeKey } from '../utils/dates.js';
import { skeleton } from './ui.js';

const kpi = ({ icon, tone, label, value, hint, nav }) => `
  <article class="kpi kpi--${tone}" ${nav ? `data-nav="${esc(nav)}" tabindex="0" role="link"` : ''}>
    <div class="kpi-icon"><i class="fa-solid ${esc(icon)}" aria-hidden="true"></i></div>
    <div class="kpi-body">
      <span class="kpi-label">${esc(label)}</span>
      <strong class="kpi-value">${esc(value)}</strong>
      <small class="kpi-hint">${esc(hint)}</small>
    </div>
  </article>`;

export function renderDashboardShell() {
  return '<section class="module" id="dashboard-root" aria-live="polite"></section>';
}

export function barChart(serie, max) {
  return `
    <div class="bars" role="img" aria-label="Citas por día en los últimos 7 días">
      ${serie
        .map((s) => {
          const h = Math.max(4, Math.round((s.total / max) * 100));
          return `
          <div class="bar-col ${s.esHoy ? 'is-today' : ''}">
            <span class="bar-val">${esc(s.total)}</span>
            <div class="bar-track"><div class="bar-fill" style="height:${h}%"></div></div>
            <span class="bar-lbl">${esc(s.label)}</span>
          </div>`;
        })
        .join('')}
    </div>`;
}

export function donut(estados, total) {
  if (!total) {
    return '<div class="efc-empty"><i class="fa-solid fa-chart-pie"></i><strong>Sin consultas registradas</strong></div>';
  }
  let acc = 0;
  const stops = estados
    .map((e) => {
      const from = acc;
      acc += (e.total / total) * 100;
      return `${e.color} ${from.toFixed(2)}% ${acc.toFixed(2)}%`;
    })
    .join(', ');
  return `
    <div class="donut-wrap">
      <div class="donut" style="background:conic-gradient(${stops})" role="img" aria-label="Distribución de consultas por estado">
        <div class="donut-hole"><strong>${esc(total)}</strong><small>consultas</small></div>
      </div>
      <ul class="legend">
        ${estados
          .map((e) => `<li><span class="dot" style="background:${esc(e.color)}"></span>${esc(estadoMeta(e.estado).label)}<b>${esc(e.total)}</b></li>`)
          .join('')}
      </ul>
    </div>`;
}

function agendaList(citas, titulo) {
  if (!citas.length) {
    return '<div class="efc-empty"><i class="fa-solid fa-calendar-check"></i><strong>Sin citas por mostrar</strong><p>Agenda una nueva cita para comenzar.</p></div>';
  }
  return `
    <p class="list-caption">${esc(titulo)}</p>
    <ul class="agenda-list">
      ${citas
        .map((c) => {
          const m = estadoMeta(c.estado);
          return `
          <li class="agenda-item" data-nav="agenda" tabindex="0" role="link">
            <span class="agenda-time">${c.start ? esc(toTimeKey(c.start)) : '--:--'}</span>
            <div class="agenda-info">
              <strong>${esc(c.paciente)}</strong>
              <small>${esc(c.motivo || 'Consulta podológica')}</small>
            </div>
            ${c.esDiabetico ? '<span class="micro-tag tag-diabetic" title="Pie diabético"><i class="fa-solid fa-triangle-exclamation"></i></span>' : ''}
            <span class="efc-badge" style="--b-color:${esc(m.color)};--b-bg:${esc(m.bg)}">${esc(m.label)}</span>
          </li>`;
        })
        .join('')}
    </ul>`;
}

/** Citas de hoy; si no hay, las próximas; si tampoco, las últimas registradas. */
export function pickAgenda(appointments, hoyLista, now = new Date()) {
  if (hoyLista.length) return { lista: hoyLista, titulo: `Citas de hoy · ${hoyLista.length}` };
  const todas = appointments
    .map(normalizeCita)
    .filter((c) => c.start)
    .sort((a, b) => a.start - b.start);
  const prox = todas.filter((c) => c.start.getTime() >= now.getTime()).slice(0, 5);
  if (prox.length) return { lista: prox, titulo: 'No hay citas hoy · próximas citas' };
  return { lista: todas.slice(-5).reverse(), titulo: 'No hay citas hoy · últimas registradas' };
}

/**
 * @param {HTMLElement} root
 * @param {{ getData: () => {appointments:object[], patients:object[]}, getRole: () => string }} ctx
 */
export function mountDashboard(root, ctx) {
  let insumos = [];
  let invSource = 'api';
  let invStatus = 'loading';
  let destroyed = false;

  function paint() {
    if (destroyed) return;
    const { appointments, patients } = ctx.getData();
    const d = computeDashboard({ appointments, patients, insumos });
    const inv = d.inventario;
    const alertasInv = inv.agotados + inv.bajos + inv.porVencer + inv.vencidos;
    const { lista, titulo } = pickAgenda(appointments, d.citasHoyLista);

    const accesos = navItemsFor(ctx.getRole())
      .filter((i) => i.page !== 'inicio')
      .map(
        (i) =>
          `<button type="button" class="quick-link" data-nav="${esc(i.page)}"><i class="fa-solid ${esc(i.icon)}" aria-hidden="true"></i><span>${esc(i.label)}</span></button>`
      )
      .join('');

    root.innerHTML = `
      <section class="kpi-grid" aria-label="Indicadores clave">
        ${kpi({ icon: 'fa-calendar-check', tone: 'teal', label: 'Citas de hoy', value: d.citasHoy, hint: `${d.citasTotal} citas en total`, nav: 'agenda' })}
        ${kpi({ icon: 'fa-users', tone: 'blue', label: 'Pacientes totales', value: d.pacientesTotal, hint: `${d.diabeticos} diabéticos · ${d.hipertensos} hipertensos`, nav: 'pacientes' })}
        ${kpi({ icon: 'fa-heart-pulse', tone: 'green', label: 'Tasa de atención', value: `${d.tasaAtencion}%`, hint: `${d.tasaCancelacion}% canceladas o inasistencias` })}
        ${kpi({
          icon: 'fa-boxes-stacked',
          tone: alertasInv ? 'amber' : 'slate',
          label: 'Alertas de inventario',
          value: invStatus === 'loading' ? '…' : alertasInv,
          hint: invStatus === 'loading' ? 'Consultando insumos' : `${inv.agotados} agotados · ${inv.bajos} stock bajo · ${inv.porVencer + inv.vencidos} caducidad`,
          nav: 'inventario',
        })}
      </section>

      <section class="dash-grid">
        <article class="panel glass">
          <header class="panel-head"><h3>Citas · últimos 7 días</h3><span class="panel-tag">Productividad</span></header>
          ${barChart(d.serie, d.maxSerie)}
        </article>

        <article class="panel glass">
          <header class="panel-head"><h3>Estado de las consultas</h3><span class="panel-tag">Distribución</span></header>
          ${donut(d.estados, d.citasTotal)}
        </article>

        <article class="panel glass panel--wide">
          <header class="panel-head"><h3>Agenda</h3><button type="button" class="efc-btn efc-btn--ghost efc-btn--sm" data-nav="agenda">Ver calendario <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></header>
          ${agendaList(lista, titulo)}
        </article>

        <article class="panel glass">
          <header class="panel-head"><h3>Motivos frecuentes</h3><span class="panel-tag">Top 5</span></header>
          ${
            d.topMotivos.length
              ? `<ul class="rank">${d.topMotivos
                  .map(
                    (m) =>
                      `<li><span>${esc(m.motivo)}</span><div class="rank-bar"><i style="width:${Math.round((m.total / d.topMotivos[0].total) * 100)}%"></i></div><b>${esc(m.total)}</b></li>`
                  )
                  .join('')}</ul>`
              : '<div class="efc-empty"><i class="fa-solid fa-notes-medical"></i><strong>Sin datos</strong></div>'
          }
        </article>

        <article class="panel glass">
          <header class="panel-head"><h3>Accesos rápidos</h3><span class="panel-tag">Según tu rol</span></header>
          <div class="quick-grid">${accesos}</div>
          ${invSource === 'local' ? '<p class="note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Inventario en modo local: el endpoint /api/inventario aún no está disponible.</p>' : ''}
        </article>
      </section>`;
  }

  root.innerHTML = skeleton(6);
  paint();

  inventarioApi
    .list()
    .then(({ data, source }) => {
      insumos = data;
      invSource = source;
      invStatus = 'ready';
      paint();
    })
    .catch(() => {
      invStatus = 'error';
      paint();
    });

  return {
    refresh: paint,
    destroy() {
      destroyed = true;
    },
  };
}
