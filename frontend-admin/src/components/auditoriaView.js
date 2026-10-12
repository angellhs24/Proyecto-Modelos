/**
 * Monitor de Auditoría y Ciberseguridad (Bitácora de Eventos)
 * Tabla de solo lectura para supervisión de seguridad y trazabilidad.
 * Conexión directa a http://localhost:4000/api/auditoria
 */
import { esc } from '../utils/html.js';
import { auditoriaApi } from '../api/index.js';
import { pageHeader } from './shellView.js';
import { notify, skeleton, emptyState } from './ui.js';
import { formatFechaHora } from '../utils/dates.js';

export function renderAuditoriaShell() {
  return '<section class="module" id="auditoria-root" aria-live="polite"></section>';
}

/**
 * @param {HTMLElement} root
 */
export function mountAuditoria(root) {
  const S = {
    status: 'loading',
    estadisticas: {
      total: 0,
      hoy: 0,
      usuarios_activos: 0,
      actividad_por_tabla: []
    },
    logs: [],
    filtroTabla: '',
    busqueda: '',
    ultimaActualizacion: new Date()
  };

  async function load() {
    try {
      const [stats, logsData] = await Promise.all([
        auditoriaApi.estadisticas().catch(() => ({
          total: 0,
          hoy: 0,
          usuarios_activos: 0,
          actividad_por_tabla: []
        })),
        auditoriaApi.list({ limit: 150 }).catch(() => ({ total: 0, logs: [] }))
      ]);

      S.estadisticas = stats || S.estadisticas;
      S.logs = Array.isArray(logsData?.logs) ? logsData.logs : Array.isArray(logsData) ? logsData : [];
      S.ultimaActualizacion = new Date();
      S.status = 'ready';
    } catch (err) {
      console.error('Error al cargar bitácora de auditoría:', err);
      S.status = 'error';
    }
    paint();
  }

  function getLogsFiltrados() {
    return S.logs.filter((log) => {
      const matchTabla = !S.filtroTabla || log.tabla_afectada === S.filtroTabla;
      const q = S.busqueda.trim().toLowerCase();
      const matchQ =
        !q ||
        (log.usuario_responsable && log.usuario_responsable.toLowerCase().includes(q)) ||
        (log.accion_realizada && log.accion_realizada.toLowerCase().includes(q)) ||
        (log.tabla_afectada && log.tabla_afectada.toLowerCase().includes(q)) ||
        (log.direccion_ip && log.direccion_ip.includes(q));

      return matchTabla && matchQ;
    });
  }

  function getBadgeClase(accion = '') {
    const act = accion.toLowerCase();
    if (act.includes('creación') || act.includes('emitid') || act.includes('alta') || act.includes('registrad') || act.includes('insert')) {
      return 'audit-badge-insert';
    }
    if (act.includes('actualiz') || act.includes('modific') || act.includes('edit')) {
      return 'audit-badge-update';
    }
    if (act.includes('elimin') || act.includes('borrad') || act.includes('cancel')) {
      return 'audit-badge-delete';
    }
    return 'audit-badge-other';
  }

  function paint() {
    if (S.status === 'loading') {
      root.innerHTML =
        pageHeader({
          title: 'Monitor de Auditoría y Seguridad',
          icon: 'fa-shield-halved',
          subtitle: 'Bitácora inmutable de eventos y operaciones del sistema'
        }) + skeleton(6);
      return;
    }

    const logs = getLogsFiltrados();
    const tablasUnicas = [...new Set(S.logs.map((l) => l.tabla_afectada).filter(Boolean))];

    root.innerHTML = `
      ${pageHeader({
        title: 'Bitácora de Auditoría y Ciberseguridad',
        icon: 'fa-shield-halved',
        subtitle: 'Registro de trazabilidad y control de accesos (Tabla: Bitacora_Auditoria)',
        actions: `
          <button type="button" class="efc-btn efc-btn--primary" id="btn-refrescar-auditoria">
            <i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Actualizar Bitácora
          </button>
        `
      })}

      <!-- KPIS DE AUDITORÍA -->
      <div class="audit-kpi-grid">
        <div class="audit-kpi-item glass-panel">
          <div style="width:40px; height:40px; border-radius:10px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; font-size:18px;">
            <i class="fa-solid fa-list-check"></i>
          </div>
          <div>
            <strong style="font-size:20px; color:var(--secondary); display:block; line-height:1.2;">
              ${S.estadisticas.total || S.logs.length}
            </strong>
            <small style="color:var(--text-muted); font-size:11px;">Eventos Totales</small>
          </div>
        </div>

        <div class="audit-kpi-item glass-panel">
          <div style="width:40px; height:40px; border-radius:10px; background:#eaf6f0; color:#15803d; display:flex; align-items:center; justify-content:center; font-size:18px;">
            <i class="fa-solid fa-calendar-day"></i>
          </div>
          <div>
            <strong style="font-size:20px; color:var(--secondary); display:block; line-height:1.2;">
              ${S.estadisticas.hoy || 0}
            </strong>
            <small style="color:var(--text-muted); font-size:11px;">Acciones Hoy</small>
          </div>
        </div>

        <div class="audit-kpi-item glass-panel">
          <div style="width:40px; height:40px; border-radius:10px; background:#fef3c7; color:#d97706; display:flex; align-items:center; justify-content:center; font-size:18px;">
            <i class="fa-solid fa-user-shield"></i>
          </div>
          <div>
            <strong style="font-size:20px; color:var(--secondary); display:block; line-height:1.2;">
              ${S.estadisticas.usuarios_activos || 1}
            </strong>
            <small style="color:var(--text-muted); font-size:11px;">Usuarios Registrados</small>
          </div>
        </div>

        <div class="audit-kpi-item glass-panel">
          <div style="width:40px; height:40px; border-radius:10px; background:#faede8; color:var(--primary); display:flex; align-items:center; justify-content:center; font-size:18px;">
            <i class="fa-solid fa-database"></i>
          </div>
          <div>
            <strong style="font-size:20px; color:var(--secondary); display:block; line-height:1.2;">
              ${tablasUnicas.length || 0}
            </strong>
            <small style="color:var(--text-muted); font-size:11px;">Tablas Monitoreadas</small>
          </div>
        </div>
      </div>

      <!-- FILTROS Y CONTROLES -->
      <div class="panel glass-panel" style="padding:16px 20px; margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
          <div style="display:flex; gap:12px; flex:1; min-width:280px;">
            <div class="search-field" style="flex:1;">
              <i class="fa-solid fa-magnifying-glass" style="color:var(--text-subtle);"></i>
              <input type="text" id="audit-buscar" placeholder="Buscar por usuario, acción o IP..." value="${esc(S.busqueda)}">
            </div>

            <select id="audit-filtro-tabla" style="padding:8px 12px; border-radius:var(--radius-pill); border:1px solid var(--border); background:var(--surface); font-size:12.5px;">
              <option value="">Todas las tablas</option>
              ${tablasUnicas.map((t) => `<option value="${esc(t)}" ${S.filtroTabla === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
            </select>
          </div>

          <div style="display:flex; align-items:center; gap:8px;">
            <span class="status-badge-dot"></span>
            <small style="color:var(--text-muted); font-size:11.5px;">
              Sincronizado: ${S.ultimaActualizacion.toLocaleTimeString()}
            </small>
          </div>
        </div>
      </div>

      <!-- TABLA DE SOLO LECTURA -->
      <div class="panel glass-panel" style="padding:0; overflow:hidden;">
        <header style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size:15px; font-family:var(--font-sans); color:var(--secondary); margin:0;">
            Eventos de Seguridad (${logs.length} mostrados)
          </h3>
          <span style="font-size:11.5px; color:var(--accent-mint); font-weight:700;">
            <i class="fa-solid fa-lock"></i> Registros de solo lectura
          </span>
        </header>

        ${
          logs.length === 0
            ? emptyState('fa-shield-halved', 'Sin eventos registrados', 'No se encontraron registros de auditoría que coincidan con la búsqueda.')
            : `
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:70px;">ID</th>
                  <th style="width:160px;">Fecha y Hora</th>
                  <th style="width:170px;">Usuario Responsable</th>
                  <th>Acción Realizada</th>
                  <th style="width:140px;">Tabla Afectada</th>
                  <th style="width:110px;">Dirección IP</th>
                </tr>
              </thead>
              <tbody>
                ${logs
                  .map(
                    (l) => `
                  <tr>
                    <td>
                      <strong style="color:var(--text-muted); font-family:monospace;">#${l.Log_id}</strong>
                    </td>
                    <td>
                      <span style="font-size:12px; font-weight:600;">${esc(formatFechaHora(l.fecha_hora))}</span>
                    </td>
                    <td>
                      <div style="display:flex; align-items:center; gap:6px;">
                        <i class="fa-regular fa-user" style="color:var(--primary); font-size:11px;"></i>
                        <strong style="color:var(--secondary); font-size:12.5px;">${esc(l.usuario_responsable)}</strong>
                      </div>
                    </td>
                    <td>
                      <span class="audit-badge-action ${getBadgeClase(l.accion_realizada)}" style="margin-right:6px;">
                        ${esc(l.accion_realizada.split(' ')[0] || 'Evento')}
                      </span>
                      <span style="font-size:12.5px; color:var(--secondary);">${esc(l.accion_realizada)}</span>
                    </td>
                    <td>
                      <span class="pill pill--muted" style="font-weight:600;">
                        ${esc(l.tabla_afectada || 'General')}
                      </span>
                    </td>
                    <td>
                      <span class="audit-ip-pill">${esc(l.direccion_ip || '127.0.0.1')}</span>
                    </td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `
        }
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    root.querySelector('#btn-refrescar-auditoria')?.addEventListener('click', async () => {
      notify('Actualizando bitácora de auditoría...');
      await load();
    });

    root.querySelector('#audit-buscar')?.addEventListener('input', (e) => {
      S.busqueda = e.target.value;
      paint();
      const el = root.querySelector('#audit-buscar');
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });

    root.querySelector('#audit-filtro-tabla')?.addEventListener('change', (e) => {
      S.filtroTabla = e.target.value;
      paint();
    });
  }

  load();

  return {
    destroy: () => {},
    reload: load
  };
}
