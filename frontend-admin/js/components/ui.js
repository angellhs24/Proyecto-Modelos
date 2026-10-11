/** Piezas de UI compartidas: toasts, modales accesibles, insignias. */
import { esc } from '../utils/html.js';
import { estadoMeta } from '../domain/scheduling.js';

export function notify(message) {
  const safe = esc(message);
  if (typeof window.toast === 'function') window.toast(safe);
  else console.info('[toast]', message);
}

let openModals = [];

/**
 * Abre un modal accesible (role=dialog, Esc, clic fuera, foco restaurado).
 * @returns {{ el: HTMLElement, close: () => void }}
 */
export function openModal({ title, subtitle = '', body, width = 560, id = 'efc-modal', onClose } = {}) {
  closeModalById(id);
  const previouslyFocused = document.activeElement;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop efc-modal-backdrop';
  backdrop.id = id;
  backdrop.innerHTML = `
    <div class="modal-card efc-modal-card" role="dialog" aria-modal="true" aria-labelledby="${id}-title" style="max-width:${width}px">
      <button class="modal-close-btn" type="button" data-modal-close aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
      <header class="efc-modal-head">
        <h2 id="${id}-title" class="efc-modal-title">${esc(title)}</h2>
        ${subtitle ? `<p class="efc-modal-sub">${esc(subtitle)}</p>` : ''}
      </header>
      <div class="efc-modal-body">${body}</div>
    </div>`;
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('open'));

  const close = () => {
    backdrop.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    openModals = openModals.filter((m) => m !== api);
    setTimeout(() => backdrop.remove(), 220);
    if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    if (onClose) onClose();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-modal-close]')) close();
  });
  const api = { el: backdrop, close };
  openModals.push(api);

  const first = backdrop.querySelector('input:not([type=hidden]), select, textarea, button:not([data-modal-close])');
  if (first) setTimeout(() => first.focus(), 60);
  return api;
}

export function closeModalById(id) {
  const el = document.getElementById(id);
  if (el) {
    const m = openModals.find((x) => x.el === el);
    if (m) m.close();
    else el.remove();
  }
}

export function closeAllModals() {
  [...openModals].forEach((m) => m.close());
}

export function estadoBadge(estado) {
  const m = estadoMeta(estado);
  return `<span class="efc-badge" style="--b-color:${m.color};--b-bg:${m.bg}"><i class="fa-solid ${m.icon}"></i>${esc(m.label)}</span>`;
}

export function skeleton(lines = 3) {
  return `<div class="efc-skeleton" aria-busy="true" aria-label="Cargando">${Array.from({ length: lines }, () => '<span></span>').join('')}</div>`;
}

export function emptyState(icon, title, text = '') {
  return `<div class="efc-empty"><i class="fa-solid ${icon}"></i><strong>${esc(title)}</strong>${text ? `<p>${esc(text)}</p>` : ''}</div>`;
}

export function errorState(message, retryAttr = 'data-retry') {
  return `<div class="efc-empty efc-empty--error" role="alert"><i class="fa-solid fa-triangle-exclamation"></i><strong>No se pudo cargar</strong><p>${esc(message)}</p><button type="button" class="efc-btn efc-btn--ghost" ${retryAttr}>Reintentar</button></div>`;
}

/** Confirmación modal (reemplaza window.confirm). Resuelve true/false. */
export function confirmDialog({ title = 'Confirmar', message = '', confirmLabel = 'Confirmar', danger = false } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    const modal = openModal({
      id: 'efc-confirm',
      title,
      width: 420,
      body: `<p class="efc-confirm-msg">${esc(message)}</p>
        <div class="efc-actions">
          <button type="button" class="efc-btn efc-btn--ghost" data-confirm="no">Cancelar</button>
          <button type="button" class="efc-btn ${danger ? 'efc-btn--danger' : 'efc-btn--primary'}" data-confirm="yes" id="efc-confirm-yes">${esc(confirmLabel)}</button>
        </div>`,
      onClose: () => done(false),
    });
    modal.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-confirm]');
      if (!b) return;
      done(b.dataset.confirm === 'yes');
      modal.close();
    });
  });
}
