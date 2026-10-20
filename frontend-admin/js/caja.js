/**
 * Lógica del Módulo de Caja y Pagos (Vanilla JS)
 * Para Recepcionista (Rol ID: 3) y Administrador (Rol ID: 1)
 */

// Estado global de Caja
const CajaState = {
  pendientes: [],
  pendientesFiltrados: [],
  historial: [],
  consultaSeleccionada: null,
  metodoSeleccionado: 'Efectivo',
  usuarioActual: null
};

document.addEventListener('DOMContentLoaded', async () => {
  await inicializarCaja();
});

/**
 * Inicialización con verificación RBAC
 */
async function inicializarCaja() {
  let usuario = AppAuth.getCurrentUser();
  if (!usuario) {
    console.info('Sesión no encontrada. Iniciando sesión demo de Recepcionista...');
    usuario = await AppAuth.autoLoginDemo(3);
  }

  // Guardia RBAC: Solo Admin (1) y Recepcionista (3)
  usuario = AppAuth.checkAuthGuard([1, 3]);
  if (!usuario) return;

  CajaState.usuarioActual = usuario;
  renderizarUsuarioHeader(usuario);

  // Cargar datos
  await Promise.all([
    cargarConsultasPendientes(),
    cargarResumenCaja(),
    cargarHistorialCobros()
  ]);

  configurarEventosCaja();
}

/**
 * Mostrar datos del usuario activo en la cabecera
 */
function renderizarUsuarioHeader(usuario) {
  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-role-text');
  const avatarEl = document.getElementById('user-avatar-initials');

  const rolId = Number(usuario.fk_rol_id || usuario.rolId || 3);
  const nombre = usuario.nombre_completo || usuario.nombre || (rolId === 1 ? 'Administrador General' : 'María López');
  const rolTexto = rolId === 1 ? 'Rol ID: 1 • Administrador' : 'Rol ID: 3 • Recepcionista';

  if (nameEl) nameEl.textContent = nombre;
  if (roleEl) roleEl.textContent = rolTexto;

  if (avatarEl) {
    const iniciales = nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    avatarEl.textContent = iniciales || 'ML';
  }
}

/**
 * GET /api/pagos: Cargar consultas pendientes de pago
 */
async function cargarConsultasPendientes() {
  const tbody = document.getElementById('tabla-pendientes-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 2.5rem; color: var(--text-secondary);">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.8rem; color: var(--color-primary); margin-bottom: 0.5rem; display:block;"></i>
          Consultando cuentas pendientes de cobro...
        </td>
      </tr>
    `;
  }

  try {
    const res = await AppAuth.fetchApi('/api/pagos');
    if (!res.ok) {
      if (res.status === 403) {
        AppAuth.showToast('Acceso denegado: Tu rol no tiene permisos para acceder a Caja.', 'error');
        return;
      }
      throw new Error(res.data?.error || 'Error al obtener cuentas pendientes');
    }

    CajaState.pendientes = res.data || [];
    aplicarFiltrosCaja();
  } catch (err) {
    console.error('Error al cargar pendientes:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding: 2.5rem; color: #f87171;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 0.5rem; display:block;"></i>
            Error al consultar caja: ${err.message}
          </td>
        </tr>
      `;
    }
    AppAuth.showToast(err.message, 'error');
  }
}

/**
 * GET /api/pagos/resumen-caja: Actualizar tarjetas KPI
 */
async function cargarResumenCaja() {
  try {
    const res = await AppAuth.fetchApi('/api/pagos/resumen-caja');
    if (res.ok && res.data) {
      const data = res.data;
      const totalPendientesEl = document.getElementById('kpi-total-pendientes');
      const totalHoyEl = document.getElementById('kpi-total-hoy');
      const cobrosHoyEl = document.getElementById('kpi-cobros-hoy');
      const estimadoEl = document.getElementById('kpi-monto-estimado');

      if (totalPendientesEl) totalPendientesEl.textContent = data.total_pendientes || 0;
      if (totalHoyEl) totalHoyEl.textContent = `$${Number(data.total_hoy || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
      if (cobrosHoyEl) cobrosHoyEl.textContent = data.cobros_hoy || 0;
      if (estimadoEl) estimadoEl.textContent = `$${Number(data.monto_pendiente_estimado || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    }
  } catch (err) {
    console.warn('No se pudo actualizar resumen de caja:', err);
  }
}

/**
 * GET /api/pagos/historial: Cargar cobros completados del día
 */
async function cargarHistorialCobros() {
  const tbody = document.getElementById('tabla-historial-body');
  if (!tbody) return;

  try {
    const res = await AppAuth.fetchApi('/api/pagos/historial');
    if (res.ok && Array.isArray(res.data)) {
      CajaState.historial = res.data;
      renderizarHistorial(res.data);
    }
  } catch (err) {
    console.warn('Error al cargar historial de cobros:', err);
  }
}

/**
 * Filtrar tabla de pacientes pendientes de cobro
 */
function aplicarFiltrosCaja() {
  const q = (document.getElementById('caja-search-input')?.value || '').toLowerCase().trim();

  CajaState.pendientesFiltrados = CajaState.pendientes.filter(item => {
    if (!q) return true;
    return (
      (item.paciente_nombre || '').toLowerCase().includes(q) ||
      (item.Consulta_id || '').toLowerCase().includes(q) ||
      String(item.expediente || '').includes(q) ||
      (item.podologo_nombre || '').toLowerCase().includes(q) ||
      (item.motivo_o_notas || '').toLowerCase().includes(q)
    );
  });

  renderizarTablaPendientes(CajaState.pendientesFiltrados);
}

/**
 * Renderiza la tabla central de pacientes listos para pagar
 */
function renderizarTablaPendientes(articulos) {
  const tbody = document.getElementById('tabla-pendientes-body');
  const contadorEl = document.getElementById('contador-pendientes');
  if (!tbody) return;

  if (contadorEl) {
    contadorEl.textContent = `${articulos.length} paciente(s) esperando liquidación`;
  }

  if (articulos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-table-state" style="padding: 3.5rem 1rem; text-align: center;">
            <i class="fa-solid fa-circle-check" style="color: #10b981; font-size: 3rem; margin-bottom: 0.85rem; opacity: 0.85; display:block;"></i>
            <h3 style="color: #fff; font-size: 1.2rem; margin-bottom: 0.35rem;">¡Caja al Día!</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">No hay consultas médicas pendientes de pago en este momento.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = articulos.map(item => {
    const monto = Number(item.monto || 450).toFixed(2);
    const estadoConsulta = item.estado_consulta || 'Atendida';
    const fechaHora = formatearFechaHora(item.fecha_hora);

    return `
      <tr data-consulta-id="${item.Consulta_id}">
        <td>
          <span style="font-family: monospace; font-weight: 700; color: #38bdf8;">
            ${escapeHtml(item.Consulta_id)}
          </span>
        </td>
        <td>
          <div style="font-weight: 700; color: #f8fafc; font-size: 0.95rem;">
            ${escapeHtml(item.paciente_nombre)}
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); display:flex; gap: 0.6rem; align-items:center; margin-top: 0.15rem;">
            <span><i class="fa-regular fa-folder-open"></i> Exp: ${item.expediente || 'N/A'}</span>
            ${item.paciente_telefono ? `<span><i class="fa-solid fa-phone"></i> ${escapeHtml(item.paciente_telefono)}</span>` : ''}
          </div>
        </td>
        <td>
          <div style="font-size: 0.88rem; color: #e2e8f0; font-weight: 600;">
            ${escapeHtml(item.podologo_nombre || 'Dr. Carlos Pérez')}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(item.clinica_nombre || 'Sucursal Centro')}</div>
        </td>
        <td>
          <div style="font-size: 0.85rem; color: var(--text-secondary); max-width: 260px; line-height: 1.3;">
            ${escapeHtml(item.motivo_o_notas || 'Atención podológica general')}
          </div>
        </td>
        <td>
          <span class="badge-consulta-atendida">
            <i class="fa-solid fa-stethoscope"></i> ${escapeHtml(estadoConsulta)}
          </span>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">${fechaHora}</div>
        </td>
        <td>
          <span class="badge-pago-pendiente">
            <i class="fa-solid fa-clock"></i> Pendiente
          </span>
        </td>
        <td style="text-align: right;">
          <span class="monto-pill">$${monto}</span>
        </td>
        <td style="text-align: center;">
          <!-- Botón verde de 'Cobrar' que abre modal estilizado -->
          <button 
            type="button" 
            class="btn-cobrar" 
            onclick="abrirModalCobro('${item.Consulta_id}')"
            title="Registrar cobro para este paciente">
            <i class="fa-solid fa-cash-register"></i>
            <span>Cobrar</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Renderiza el historial de cobros realizados hoy
 */
function renderizarHistorial(cobros) {
  const tbody = document.getElementById('tabla-historial-body');
  if (!tbody) return;

  if (cobros.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No se han registrado cobros el día de hoy.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = cobros.map(c => `
    <tr>
      <td><span style="font-family: monospace; font-weight: 700; color: #34d399;">${escapeHtml(c.Pago_id)}</span></td>
      <td><strong>${escapeHtml(c.paciente_nombre)}</strong></td>
      <td>${escapeHtml(c.fk_consulta_id)}</td>
      <td>
        <span class="category-badge ${c.metodo_pago === 'Tarjeta' ? 'cat-curacion' : (c.metodo_pago === 'Transferencia' ? 'cat-instrumental' : 'cat-desechables')}">
          ${escapeHtml(c.metodo_pago || 'Efectivo')}
        </span>
      </td>
      <td><strong style="color: #34d399;">$${Number(c.monto).toFixed(2)}</strong></td>
      <td><span class="badge-pago-completado"><i class="fa-solid fa-check"></i> Pagado</span></td>
      <td>
        <button type="button" class="btn btn-secondary btn-sm" onclick="verReciboPrevio('${c.Pago_id}', '${escapeHtml(c.paciente_nombre)}', ${c.monto}, '${escapeHtml(c.metodo_pago)}', '${escapeHtml(c.fecha_pago)}')">
          <i class="fa-solid fa-receipt"></i> Recibo
        </button>
      </td>
    </tr>
  `).join('');
}

/**
 * Abre el modal con fondo blur para cobrar
 */
function abrirModalCobro(consultaId) {
  const consulta = CajaState.pendientes.find(c => c.Consulta_id === consultaId);
  if (!consulta) {
    AppAuth.showToast('No se encontró la consulta seleccionada.', 'error');
    return;
  }

  CajaState.consultaSeleccionada = consulta;
  CajaState.metodoSeleccionado = 'Efectivo';

  // Llenar datos en el modal
  const nombreEl = document.getElementById('modal-paciente-nombre');
  const expEl = document.getElementById('modal-paciente-expediente');
  const doctorEl = document.getElementById('modal-doctor-nombre');
  const folioEl = document.getElementById('modal-consulta-folio');
  const motivoEl = document.getElementById('modal-consulta-motivo');
  const montoInput = document.getElementById('cobro-monto');
  const idHidden = document.getElementById('cobro-consulta-id');
  const avatarEl = document.getElementById('modal-paciente-avatar');

  if (nombreEl) nombreEl.textContent = consulta.paciente_nombre;
  if (expEl) expEl.textContent = `Expediente: #${consulta.expediente || 'N/A'}`;
  if (doctorEl) doctorEl.textContent = consulta.podologo_nombre || 'Dr. Carlos Pérez';
  if (folioEl) folioEl.textContent = consulta.Consulta_id;
  if (motivoEl) motivoEl.textContent = consulta.motivo_o_notas || 'Atención podológica estándar';
  if (montoInput) montoInput.value = Number(consulta.monto || 450).toFixed(2);
  if (idHidden) idHidden.value = consulta.Consulta_id;

  if (avatarEl) {
    const inits = consulta.paciente_nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    avatarEl.textContent = inits || 'P';
  }

  // Resetear selector de método
  seleccionarMetodo('Efectivo');

  const modal = document.getElementById('modal-cobro');
  if (modal) modal.showModal();
}

/**
 * Selecciona un método de pago en el modal
 */
function seleccionarMetodo(metodo) {
  CajaState.metodoSeleccionado = metodo;
  const inputHidden = document.getElementById('cobro-metodo-pago');
  if (inputHidden) inputHidden.value = metodo;

  document.querySelectorAll('.metodo-card').forEach(card => {
    if (card.getAttribute('data-metodo') === metodo) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });
}

/**
 * Procesar el cobro: PUT o POST hacia /api/pagos/cobrar
 */
async function procesarCobroSubmit(e) {
  e.preventDefault();

  const consultaId = document.getElementById('cobro-consulta-id')?.value;
  const monto = parseFloat(document.getElementById('cobro-monto')?.value);
  const metodo_pago = CajaState.metodoSeleccionado || 'Efectivo';
  const notas = document.getElementById('cobro-notas')?.value || '';

  if (!consultaId) {
    AppAuth.showToast('ID de consulta inválido.', 'error');
    return;
  }

  if (isNaN(monto) || monto <= 0) {
    AppAuth.showToast('Ingresa un monto válido mayor a 0.', 'error');
    return;
  }

  const btnSubmit = document.getElementById('btn-procesar-cobro');
  const btnOriginal = btnSubmit ? btnSubmit.innerHTML : 'Confirmar';
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Registrando Pago...`;
  }

  try {
    const res = await AppAuth.fetchApi('/api/pagos/cobrar', {
      method: 'POST',
      body: JSON.stringify({
        fk_consulta_id: consultaId,
        monto,
        metodo_pago,
        notas
      })
    });

    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = btnOriginal;
    }

    if (!res.ok) {
      if (res.status === 403) {
        AppAuth.showToast('🛡️ Acción bloqueada: Solo Administrador y Recepcionista (Rol ID: 3) pueden procesar cobros.', 'error');
        return;
      }
      throw new Error(res.data?.error || 'Error al procesar el cobro');
    }

    // Cerrar modal de cobro
    cerrarModal('modal-cobro');

    // Notificación Toast flotante de éxito
    AppAuth.showToast(`✅ ¡Cobro de $${monto.toFixed(2)} registrado exitosamente con método ${metodo_pago}!`, 'success');

    // Desplegar Recibo Digital
    const recibo = res.data?.recibo;
    if (recibo) {
      mostrarReciboDigital(recibo);
    }

    // Refrescar datos
    await Promise.all([
      cargarConsultasPendientes(),
      cargarResumenCaja(),
      cargarHistorialCobros()
    ]);

  } catch (err) {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = btnOriginal;
    }
    console.error('Error al procesar cobro:', err);
    AppAuth.showToast(err.message, 'error');
  }
}

/**
 * Despliega el modal de recibo digital
 */
function mostrarReciboDigital(recibo) {
  const modal = document.getElementById('modal-recibo');
  if (!modal) return;

  const folioEl = document.getElementById('recibo-folio');
  const fechaEl = document.getElementById('recibo-fecha');
  const pacienteEl = document.getElementById('recibo-paciente');
  const expEl = document.getElementById('recibo-expediente');
  const metodoEl = document.getElementById('recibo-metodo');
  const totalEl = document.getElementById('recibo-total');
  const cajeroEl = document.getElementById('recibo-cajero');

  if (folioEl) folioEl.textContent = recibo.Pago_id || recibo.id;
  if (fechaEl) fechaEl.textContent = formatearFechaHora(recibo.fecha_pago || new Date());
  if (pacienteEl) pacienteEl.textContent = recibo.paciente;
  if (expEl) expEl.textContent = recibo.expediente || 'N/A';
  if (metodoEl) metodoEl.textContent = recibo.metodo_pago;
  if (totalEl) totalEl.textContent = `$${Number(recibo.monto).toFixed(2)}`;
  if (cajeroEl) cajeroEl.textContent = recibo.cajero || 'María López (Recepción)';

  modal.showModal();
}

function verReciboPrevio(pagoId, paciente, monto, metodo, fecha) {
  mostrarReciboDigital({
    Pago_id: pagoId,
    paciente,
    monto,
    metodo_pago: metodo,
    fecha_pago: fecha,
    cajero: 'Recepción Clínica'
  });
}

function imprimirRecibo() {
  window.print();
}

function cerrarModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.close();
}

/**
 * Configurar eventos DOM
 */
function configurarEventosCaja() {
  const searchInput = document.getElementById('caja-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => aplicarFiltrosCaja());
  }

  const formCobro = document.getElementById('form-cobro');
  if (formCobro) {
    formCobro.addEventListener('submit', procesarCobroSubmit);
  }

  // Alternar pestañas en la vista de caja
  document.querySelectorAll('.caja-subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.caja-subtab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.caja-subtab-content').forEach(c => c.style.display = 'none');

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-target');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.style.display = 'block';
    });
  });
}

function formatearFechaHora(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Exportar globalmente
window.abrirModalCobro = abrirModalCobro;
window.seleccionarMetodo = seleccionarMetodo;
window.cerrarModal = cerrarModal;
window.imprimirRecibo = imprimirRecibo;
window.verReciboPrevio = verReciboPrevio;
window.cargarConsultasPendientes = cargarConsultasPendientes;
