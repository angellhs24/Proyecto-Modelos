/**
 * Capa de Presentación · Estructura de la aplicación (menú lateral, barra superior y navegación móvil).
 * El menú se genera dinámicamente según el rol del usuario (RBAC): lo no permitido no se renderiza.
 */
import { esc } from '../utils/html.js';
import { navGroupsFor, navItemsFor, ROLE_LABELS } from '../core/rbac.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function fechaLarga(d = new Date()) {
  const dia = DIAS[d.getDay()];
  return `${dia[0].toUpperCase()}${dia.slice(1)}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/**
 * @param {{page:string, role:string, clinics:Array, currentClinicId:number, user:string}} ctx
 */
export function renderSidebar({ page, role, clinics = [], currentClinicId }) {
  const groups = navGroupsFor(role)
    .map(
      (g) => `
      <div class="nav-group" role="group" aria-label="${esc(g.name)}">
        <span class="nav-group-label">${esc(g.name)}</span>
        ${g.items
          .map(
            (it) => `
          <button type="button" class="${page === it.page ? 'active' : ''}" data-nav="${esc(it.page)}" id="nav-${esc(it.page)}" ${page === it.page ? 'aria-current="page"' : ''}>
            <i class="fa-solid ${esc(it.icon)}" aria-hidden="true"></i>
            <span>${esc(it.label)}</span>
          </button>`
          )
          .join('')}
      </div>`
    )
    .join('');

  return `
    <aside class="sidebar" aria-label="Navegación principal">
      <div class="brand">
        <div class="brand-logo"><i class="fa-solid fa-stethoscope" aria-hidden="true"></i></div>
        <div>
          <h2>Elite Foot Care</h2>
          <small>Podología Clínica</small>
        </div>
      </div>

      <nav class="nav" aria-label="Módulos del sistema">${groups}</nav>

      <div class="sidebar-bottom">
        <div class="clinic-selector-widget">
          <label class="lbl" for="clinic-select">Sede activa</label>
          <select id="clinic-select" data-clinic-select>
            ${clinics
              .map(
                (c) =>
                  `<option value="${esc(c.id_clinica)}" ${Number(c.id_clinica) === Number(currentClinicId) ? 'selected' : ''}>${esc(c.nombre)}</option>`
              )
              .join('')}
          </select>
        </div>
        <button type="button" class="logout" data-logout>
          <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>`;
}

export function renderTopbar({ user, role, clinicName, quickAction }) {
  const first = String(user || '').trim().split(/\s+/)[0] || 'Doctor';
  const initial = (String(user || 'U').trim()[0] || 'U').toUpperCase();
  const prefijo = role === 'recepcion' ? '' : 'Dr. ';
  return `
    <header class="topbar-wrapper">
      <div class="topbar-header">
        <div class="topbar-greeting">
          <h1 class="greeting-title">Hola, ${esc(prefijo)}${esc(first)}</h1>
          <div class="greeting-subtitle">
            <span class="sede-chip"><span class="status-badge-dot" aria-hidden="true"></span>${esc(clinicName)}</span>
            <span class="greeting-date-pill"><i class="fa-regular fa-calendar-days" aria-hidden="true"></i>${esc(fechaLarga())}</span>
          </div>
        </div>
        <div class="topbar-actions">
          ${quickAction ? `<button type="button" class="efc-btn efc-btn--primary" data-nav="${esc(quickAction.page)}"><i class="fa-solid ${esc(quickAction.icon)}" aria-hidden="true"></i><span>${esc(quickAction.label)}</span></button>` : ''}
          <button type="button" class="icon-btn-pill" data-notifications aria-label="Notificaciones" id="topbar-bell">
            <i class="fa-regular fa-bell" aria-hidden="true"></i>
            <span class="notif-dot" data-notif-dot style="display:none"></span>
          </button>
          <div class="user-chip" title="${esc(user)}">
            <div class="user-avatar-pill" aria-hidden="true">${esc(initial)}</div>
            <div class="user-chip-text"><strong>${esc(first)}</strong><small id="user-role-label">${esc(ROLE_LABELS[role] || role)}</small></div>
          </div>
        </div>
      </div>
    </header>`;
}

/** Navegación inferior (móvil): hasta 5 accesos permitidos para el rol. */
export function renderBottomNav({ page, role }) {
  const items = navItemsFor(role).slice(0, 5);
  return `
    <nav class="bottom-nav" aria-label="Navegación móvil">
      ${items
        .map(
          (it) => `
        <button type="button" class="bottom-nav-item ${page === it.page ? 'active' : ''}" data-nav="${esc(it.page)}" aria-label="${esc(it.label)}">
          <i class="fa-solid ${esc(it.icon)}" aria-hidden="true"></i>
          <span>${esc(it.label.split(' ')[0])}</span>
        </button>`
        )
        .join('')}
    </nav>`;
}

/** Cabecera estándar de cada módulo. */
export function pageHeader({ title, subtitle = '', actions = '', icon = '' }) {
  return `
    <div class="page-head">
      <div>
        <h2 class="page-title">${icon ? `<i class="fa-solid ${esc(icon)}" aria-hidden="true"></i>` : ''}${esc(title)}</h2>
        ${subtitle ? `<p class="page-sub">${esc(subtitle)}</p>` : ''}
      </div>
      <div class="page-actions">${actions}</div>
    </div>`;
}
