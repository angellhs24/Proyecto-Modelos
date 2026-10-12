/** Panel de notificaciones visuales (próximas citas, citas sin atender, choques). */
import { esc } from '../utils/html.js';
import { buildAlerts } from '../domain/scheduling.js';
import { agendaStore } from '../core/agendaStore.js';
import { notify } from './ui.js';

const ICONS = { proxima: 'fa-clock', vencida: 'fa-hourglass-end', choque: 'fa-triangle-exclamation' };

export function createNotifier({ onOpenCita, now = () => new Date(), intervalMs = 60000 } = {}) {
  let alerts = [];
  const announced = new Set(); // evita repetir el mismo aviso emergente
  let panel = null;
  let timer = null;
  let unsub = null;

  function refresh() {
    alerts = buildAlerts(agendaStore.state.citas, now());
    document.querySelectorAll('[data-notif-badge]').forEach((el) => {
      el.textContent = alerts.length > 9 ? '9+' : String(alerts.length);
      el.hidden = alerts.length === 0;
    });
    document.querySelectorAll('[data-notif-dot]').forEach((el) => {
      el.style.display = alerts.length ? '' : 'none';
    });
    alerts
      .filter((a) => (a.severidad === 'danger' || a.tipo === 'proxima') && !announced.has(a.id))
      .forEach((a) => {
        announced.add(a.id);
        notify(`${a.titulo}: ${a.detalle}`);
      });
    if (panel) renderPanel();
  }

  function renderPanel() {
    panel.innerHTML = `
      <header><strong>Notificaciones</strong><button type="button" class="efc-link" data-close aria-label="Cerrar notificaciones"><i class="fa-solid fa-xmark"></i></button></header>
      ${alerts.length
        ? `<ul>${alerts.map((a) => `
          <li class="notif notif--${a.severidad}" data-cita="${esc(a.citaId)}" tabindex="0" role="button">
            <i class="fa-solid ${ICONS[a.tipo]}"></i>
            <div><strong>${esc(a.titulo)}</strong><small>${esc(a.detalle)}</small></div>
          </li>`).join('')}</ul>`
        : '<p class="notif-empty"><i class="fa-regular fa-circle-check"></i> Todo al día. Sin alertas pendientes.</p>'}`;
  }

  function close() {
    panel?.remove();
    panel = null;
  }

  function toggle() {
    if (panel) return close();
    panel = document.createElement('aside');
    panel.className = 'notif-panel glass';
    panel.id = 'notif-panel';
    panel.setAttribute('aria-label', 'Notificaciones');
    document.body.appendChild(panel);
    renderPanel();
    panel.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) return close();
      const item = e.target.closest('[data-cita]');
      if (item && onOpenCita) {
        close();
        onOpenCita(item.dataset.cita);
      }
    });
  }

  return {
    start() {
      unsub = agendaStore.subscribe(refresh);
      timer = setInterval(refresh, intervalMs);
      refresh();
    },
    stop() {
      unsub?.();
      clearInterval(timer);
      close();
    },
    toggle,
    refresh,
    get alerts() {
      return alerts;
    },
  };
}
