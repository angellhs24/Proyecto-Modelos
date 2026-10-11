/**
 * Módulo Financiero (Caja y Control de Pagos)
 * Estética Material 3 / Glassmorphism
 * Conexión directa a http://localhost:4000/api/pagos
 */
import { esc } from '../utils/html.js';
import { pagosApi, pacientesApi, consultasApi } from '../api/index.js';
import { pageHeader } from './shellView.js';
import { notify, skeleton, emptyState } from './ui.js';
import { formatFechaHora } from '../utils/dates.js';

export function renderPagosShell() {
  return '<section class="module" id="pagos-root" aria-live="polite"></section>';
}

/**
 * @param {HTMLElement} root
 * @param {{ getRole: Function, clinicName: Function }} ctx
 */
export function mountPagos(root, ctx = {}) {
  const S = {
    status: 'loading',
    resumen: {
      total_ingresos: 0,
      ingresos_mes: 0,
      total_pendiente: 0,
      total_hoy: 0,
      transacciones_hoy: 0,
      cobros_pendientes_count: 0,
      metodos_pago: []
    },
    historial: [],
    filtroEstado: 'todos', // 'todos' | 'Pagado' | 'Pendiente'
    busqueda: '',
    modalNuevoPago: false,
    nuevoPago: {
      expediente: '',
      fk_consulta_id: '',
      monto: '',
      metodo_pago: 'Efectivo',
      estado_pago: 'Pagado',
      concepto: 'Consulta General de Quiropodia'
    },
    pacientes: []
  };

  async function load() {
    try {
      const [resumenData, listaPagos, pacientesList] = await Promise.all([
        pagosApi.resumen().catch(() => ({
          total_ingresos: 0,
          ingresos_mes: 0,
          total_pendiente: 0,
          total_hoy: 0,
          metodos_pago: []
        })),
        pagosApi.list().catch(() => []),
        pacientesApi.list().catch(() => [])
      ]);

      S.resumen = resumenData || S.resumen;
      S.historial = Array.isArray(listaPagos) ? listaPagos : [];
      S.pacientes = Array.isArray(pacientesList) ? pacientesList : [];
      S.status = 'ready';
    } catch (err) {
      console.error('Error cargando módulo de pagos:', err);
      S.status = 'error';
    }
    paint();
  }

  function getPagosFiltrados() {
    return S.historial.filter((p) => {
      const matchEstado =
        S.filtroEstado === 'todos' ||
        String(p.estado_pago).toLowerCase() === S.filtroEstado.toLowerCase();

      const q = S.busqueda.trim().toLowerCase();
      const matchQ =
        !q ||
        (p.paciente_nombre && p.paciente_nombre.toLowerCase().includes(q)) ||
        (p.Pago_id && p.Pago_id.toLowerCase().includes(q)) ||
        (p.metodo_pago && p.metodo_pago.toLowerCase().includes(q)) ||
        (p.expediente && String(p.expediente).includes(q));

      return matchEstado && matchQ;
    });
  }

  function paint() {
    if (S.status === 'loading') {
      root.innerHTML =
        pageHeader({
          title: 'Caja y Finanzas',
          icon: 'fa-cash-register',
          subtitle: 'Control financiero, cobros e historial contable'
        }) + skeleton(6);
      return;
    }

    const fmt = (num) =>
      Number(num || 0).toLocaleString('es-MX', {
        style: 'currency',
        currency: 'MXN'
      });

    const pagos = getPagosFiltrados();

    root.innerHTML = `
      ${pageHeader({
        title: 'Caja y Control Financiero',
        icon: 'fa-cash-register',
        subtitle: 'Gestión de ingresos clínicos, métodos de pago y cuentas por cobrar',
        actions: `
          <button type="button" class="efc-btn efc-btn--primary" id="btn-abrir-nuevo-pago">
            <i class="fa-solid fa-plus" aria-hidden="true"></i> Registrar Cobro
          </button>
          <button type="button" class="efc-btn efc-btn--ghost" id="btn-refrescar-pagos">
            <i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Actualizar
          </button>
        `
      })}

      <!-- 1. KPIS FINANCIEROS -->
      <div class="finance-kpi-grid">
        <div class="finance-card glass-panel">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div class="finance-card-icon" style="background:#eaf6f0; color:#15803d;">
              <i class="fa-solid fa-sack-dollar"></i>
            </div>
            <span class="pill pill--ok">Hoy</span>
          </div>
          <span class="finance-sub">Ingresos Cobrados Hoy</span>
          <div class="finance-val">${fmt(S.resumen.total_hoy)}</div>
          <small style="color:var(--text-muted); font-size:11px;">${S.resumen.transacciones_hoy || 0} operaciones hoy</small>
        </div>

        <div class="finance-card glass-panel">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div class="finance-card-icon" style="background:#eff6ff; color:#2563eb;">
              <i class="fa-solid fa-calendar-check"></i>
            </div>
            <span class="pill pill--ok">Mes actual</span>
          </div>
          <span class="finance-sub">Ingresos Totales del Mes</span>
          <div class="finance-val">${fmt(S.resumen.ingresos_mes)}</div>
          <small style="color:var(--text-muted); font-size:11px;">Cierre mensual acumulado</small>
        </div>

        <div class="finance-card glass-panel">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div class="finance-card-icon" style="background:#fef3c7; color:#d97706;">
              <i class="fa-solid fa-clock-rotate-left"></i>
            </div>
            <span class="pill pill--warn">${S.resumen.cobros_pendientes_count || 0} pendientes</span>
          </div>
          <span class="finance-sub">Cuentas por Cobrar</span>
          <div class="finance-val" style="color:var(--accent-amber);">${fmt(S.resumen.total_pendiente)}</div>
          <small style="color:var(--text-muted); font-size:11px;">Atenciones con saldo pendiente</small>
        </div>

        <div class="finance-card glass-panel">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div class="finance-card-icon" style="background:#faede8; color:var(--primary);">
              <i class="fa-solid fa-chart-line"></i>
            </div>
            <span class="pill pill--ok">Histórico</span>
          </div>
          <span class="finance-sub">Ingresos Globales</span>
          <div class="finance-val">${fmt(S.resumen.total_ingresos)}</div>
          <small style="color:var(--text-muted); font-size:11px;">${S.historial.length} pagos registrados</small>
        </div>
      </div>

      <!-- 2. DESGLOSE DE MÉTODOS Y FILTROS -->
      <div style="display:grid; grid-template-columns: 1fr 2fr; gap:18px; margin-bottom:20px;">
        <div class="panel glass-panel" style="padding:18px;">
          <h4 style="font-size:14px; color:var(--secondary); margin-bottom:12px; display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-wallet" style="color:var(--primary);"></i> Métodos de Pago
          </h4>
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${(S.resumen.metodos_pago || [])
              .map(
                (m) => `
              <div>
                <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px;">
                  <strong>${esc(m.metodo_pago)} (${m.transacciones})</strong>
                  <span>${fmt(m.total)}</span>
                </div>
                <div style="height:6px; background:var(--surface-alt); border-radius:10px; overflow:hidden;">
                  <div style="height:100%; width:${Math.min(100, Math.round((m.total / (S.resumen.total_ingresos || 1)) * 100))}%; background:var(--primary);"></div>
                </div>
              </div>`
              )
              .join('') || '<p style="font-size:12px; color:var(--text-muted);">Sin datos de métodos</p>'}
          </div>
        </div>

        <div class="panel glass-panel" style="padding:18px; display:flex; flex-direction:column; justify-content:space-between;">
          <h4 style="font-size:14px; color:var(--secondary); margin-bottom:10px; display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-filter" style="color:var(--primary);"></i> Filtros de Historial
          </h4>
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <div class="search-field" style="flex:1; min-width:200px;">
              <i class="fa-solid fa-magnifying-glass" style="color:var(--text-subtle);"></i>
              <input type="text" id="pagos-buscar" placeholder="Buscar por paciente, folio o método..." value="${esc(S.busqueda)}">
            </div>
            <div style="display:inline-flex; border:1px solid var(--border); border-radius:var(--radius-pill); overflow:hidden; background:var(--surface);">
              <button type="button" class="efc-btn ${S.filtroEstado === 'todos' ? 'efc-btn--primary' : 'efc-btn--ghost'}" data-filtro-estado="todos" style="border-radius:0; padding:6px 14px; font-size:12px;">Todos</button>
              <button type="button" class="efc-btn ${S.filtroEstado === 'Pagado' ? 'efc-btn--primary' : 'efc-btn--ghost'}" data-filtro-estado="Pagado" style="border-radius:0; padding:6px 14px; font-size:12px;">Pagados</button>
              <button type="button" class="efc-btn ${S.filtroEstado === 'Pendiente' ? 'efc-btn--primary' : 'efc-btn--ghost'}" data-filtro-estado="Pendiente" style="border-radius:0; padding:6px 14px; font-size:12px;">Pendientes</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. TABLA DE HISTORIAL DE PAGOS -->
      <div class="panel glass-panel" style="padding:0; overflow:hidden;">
        <header style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size:15px; font-family:var(--font-sans); color:var(--secondary); margin:0;">
            Transacciones Registradas (${pagos.length})
          </h3>
          <span style="font-size:11.5px; color:var(--text-muted);">Sincronizado con MySQL</span>
        </header>

        ${
          pagos.length === 0
            ? emptyState('fa-receipt', 'Sin movimientos de caja', 'No se encontraron registros de cobro con los filtros seleccionados.')
            : `
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Paciente</th>
                  <th>Fecha</th>
                  <th>Método</th>
                  <th class="num">Monto</th>
                  <th>Estado</th>
                  <th style="text-align:right;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${pagos
                  .map(
                    (p) => `
                  <tr data-pago-id="${esc(p.Pago_id)}">
                    <td>
                      <strong>${esc(p.Pago_id)}</strong>
                      <small>Cons. ${esc(p.fk_consulta_id || 'N/A')}</small>
                    </td>
                    <td>
                      <strong>${esc(p.paciente_nombre || 'Paciente General')}</strong>
                      <small>Exp. ${esc(p.expediente || 'S/E')} · ${esc(p.paciente_telefono || '')}</small>
                    </td>
                    <td>
                      <span>${esc(formatFechaHora(p.fecha_pago))}</span>
                    </td>
                    <td>
                      <span style="display:inline-flex; align-items:center; gap:6px; font-weight:600;">
                        <i class="fa-solid ${
                          p.metodo_pago === 'Tarjeta'
                            ? 'fa-credit-card'
                            : p.metodo_pago === 'Transferencia'
                            ? 'fa-money-bill-transfer'
                            : 'fa-money-bill-wave'
                        }" style="color:var(--primary);"></i>
                        ${esc(p.metodo_pago)}
                      </span>
                    </td>
                    <td class="num" style="font-weight:700; font-size:14px; color:var(--secondary);">
                      ${fmt(p.monto)}
                    </td>
                    <td>
                      <span class="pill ${p.estado_pago === 'Pagado' ? 'pill--pagado' : p.estado_pago === 'Pendiente' ? 'pill--pendiente' : 'pill--cancelado'}">
                        ${esc(p.estado_pago)}
                      </span>
                    </td>
                    <td>
                      <div class="row-actions">
                        ${
                          p.estado_pago === 'Pendiente'
                            ? `<button type="button" class="efc-btn efc-btn--primary efc-btn--sm" data-marcar-pagado="${esc(p.Pago_id)}" title="Marcar como cobrado">
                                 <i class="fa-solid fa-check"></i> Cobrar
                               </button>`
                            : ''
                        }
                        <button type="button" class="efc-btn efc-btn--ghost efc-btn--icon" data-del-pago="${esc(p.Pago_id)}" title="Eliminar registro">
                          <i class="fa-solid fa-trash" style="color:var(--accent-rose);"></i>
                        </button>
                      </div>
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

      <!-- 4. MODAL NUEVO COBRO -->
      ${
        S.modalNuevoPago
          ? `
        <div class="modal-backdrop open" id="modal-nuevo-pago-bg">
          <div class="modal-card glass-panel" style="max-width:500px; padding:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <h3 style="font-family:var(--font-serif); font-size:20px; color:var(--secondary); margin:0;">
                <i class="fa-solid fa-receipt" style="color:var(--primary);"></i> Registrar Cobro en Caja
              </h3>
              <button type="button" class="modal-close-btn" id="btn-cerrar-modal-pago">&times;</button>
            </div>

            <form id="form-nuevo-pago" class="form-grid" style="grid-template-columns:1fr 1fr; gap:12px;">
              <label class="field span2">Paciente
                <select id="pago-paciente" required>
                  <option value="">Selecciona paciente...</option>
                  ${S.pacientes
                    .map(
                      (pac) => `
                    <option value="${esc(pac.No_expediente || pac.expediente || pac.id_paciente)}">
                      ${esc(pac.Nombres ? `${pac.Nombres} ${pac.ape_paterno}` : pac.nombre_completo || 'Paciente')} · Exp: ${esc(pac.No_expediente || pac.expediente)}
                    </option>`
                    )
                    .join('')}
                </select>
              </label>

              <label class="field span2">Monto ($ MXN)
                <input type="number" id="pago-monto" min="1" step="0.50" placeholder="Ej. 450.00" required>
              </label>

              <label class="field">Método de Pago
                <select id="pago-metodo">
                  <option value="Efectivo" selected>Efectivo</option>
                  <option value="Tarjeta">Tarjeta de Débito/Crédito</option>
                  <option value="Transferencia">Transferencia SPEI</option>
                </select>
              </label>

              <label class="field">Estado del Pago
                <select id="pago-estado">
                  <option value="Pagado" selected>Pagado (Cobrado)</option>
                  <option value="Pendiente">Pendiente (Por cobrar)</option>
                </select>
              </label>

              <div class="span2" style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
                <button type="button" class="efc-btn efc-btn--ghost" id="btn-cancelar-modal-pago">Cancelar</button>
                <button type="submit" class="efc-btn efc-btn--primary">
                  <i class="fa-solid fa-check"></i> Guardar Cobro
                </button>
              </div>
            </form>
          </div>
        </div>
      `
          : ''
      }
    `;

    bindEvents();
  }

  function bindEvents() {
    // Abrir modal
    root.querySelector('#btn-abrir-nuevo-pago')?.addEventListener('click', () => {
      S.modalNuevoPago = true;
      paint();
    });

    // Refrescar
    root.querySelector('#btn-refrescar-pagos')?.addEventListener('click', async () => {
      notify('Actualizando caja...');
      await load();
    });

    // Cerrar modal
    root.querySelector('#btn-cerrar-modal-pago')?.addEventListener('click', () => {
      S.modalNuevoPago = false;
      paint();
    });
    root.querySelector('#btn-cancelar-modal-pago')?.addEventListener('click', () => {
      S.modalNuevoPago = false;
      paint();
    });

    // Búsqueda en tiempo real
    root.querySelector('#pagos-buscar')?.addEventListener('input', (e) => {
      S.busqueda = e.target.value;
      // Actualizar solo lista para no perder foco
      paint();
      const el = root.querySelector('#pagos-buscar');
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });

    // Filtros por estado
    root.querySelectorAll('[data-filtro-estado]').forEach((btn) => {
      btn.addEventListener('click', () => {
        S.filtroEstado = btn.dataset.filtroEstado;
        paint();
      });
    });

    // Marcar como pagado
    root.querySelectorAll('[data-marcar-pagado]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.marcarPagado;
        try {
          await pagosApi.update(id, { estado_pago: 'Pagado' });
          notify(`Pago ${id} marcado como Pagado`);
          await load();
        } catch (err) {
          notify('Error al actualizar pago: ' + (err.message || 'Error de red'));
        }
      });
    });

    // Eliminar pago
    root.querySelectorAll('[data-del-pago]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.delPago;
        if (confirm(`¿Deseas eliminar el registro de pago ${id}?`)) {
          try {
            await pagosApi.remove(id);
            notify(`Pago ${id} eliminado`);
            await load();
          } catch (err) {
            notify('Error al eliminar: ' + (err.message || 'Error'));
          }
        }
      });
    });

    // Guardar nuevo cobro
    root.querySelector('#form-nuevo-pago')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const exp = root.querySelector('#pago-paciente').value;
      const monto = root.querySelector('#pago-monto').value;
      const metodo = root.querySelector('#pago-metodo').value;
      const estado = root.querySelector('#pago-estado').value;

      if (!exp || !monto) {
        notify('Por favor completa todos los campos requeridos');
        return;
      }

      try {
        await pagosApi.create({
          expediente: exp,
          monto: parseFloat(monto),
          metodo_pago: metodo,
          estado_pago: estado
        });
        notify('Cobro registrado en la base de datos con éxito');
        S.modalNuevoPago = false;
        await load();
      } catch (err) {
        notify('Error al registrar pago: ' + (err.message || 'Error'));
      }
    });
  }

  load();

  return {
    destroy: () => {},
    reload: load
  };
}
