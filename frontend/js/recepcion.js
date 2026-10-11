/**
 * LÓGICA DE VANILLA JS: RECEPCIÓN CLÍNICA (ROL ID: 3)
 * Elite Foot Care - Gestión de Pacientes, Agenda Global y Cobros
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializar Sesión para Rol Recepcionista (ID 3)
  let currentUser = AppAuth.getCurrentUser();
  if (!currentUser || currentUser.fk_rol_id !== 3) {
    currentUser = await AppAuth.autoLoginDemo(3);
  }

  actualizarUIUsuario(currentUser);

  // 2. Control de Pestañas Material 3
  inicializarNavegacionTabs();

  // 3. Cargar Catálogos iniciales (Podólogos y Clínicas)
  await cargarCatalogos();

  // 4. Cargar Datos Principales
  await Promise.all([
    cargarAgendaGlobal(),
    cargarDirectorioPacientes(),
    cargarCobrosPendientes()
  ]);

  // 5. Configurar Listeners de Eventos y Formularios
  configurarEventosAgenda();
  configurarEventosPacientes();
  configurarEventosCobros();
  configurarPruebaSeguridadRBAC();
});

// Variables de Estado en Memoria
let catalogos = { podologos: [], clinicas: [] };
let listaPacientesCache = [];
let listaConsultasCache = [];

/**
 * Actualiza el chip de perfil del usuario en el encabezado
 */
function actualizarUIUsuario(user) {
  if (!user) return;
  const nameEl = document.getElementById('user-display-name');
  const avatarEl = document.getElementById('user-avatar-initials');
  const cajeraIndicador = document.getElementById('cajera-nombre-indicador');
  const cobroFirmante = document.getElementById('cobro-recep-firmante');

  const nombre = user.nombre || user.perfil?.Nombre || 'María López';
  const ape = user.ape_paterno || user.perfil?.ape_paterno || '';
  const nombreCompleto = `${nombre} ${ape}`.trim();
  const recepId = user.recepcionista_id || user.Recepcionista_id || user.perfil?.Recepcionista_id || 1;

  if (nameEl) nameEl.textContent = nombreCompleto;
  if (avatarEl) avatarEl.textContent = `${nombre[0] || 'M'}${ape[0] || 'L'}`;
  if (cajeraIndicador) cajeraIndicador.textContent = `${nombreCompleto} [ID: ${recepId}]`;
  if (cobroFirmante) cobroFirmante.textContent = `${nombreCompleto} (fk_recepcionista_id: ${recepId})`;
}

/**
 * Manejo de pestañas Material 3
 */
function inicializarNavegacionTabs() {
  const tabBtns = document.querySelectorAll('.nav-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });
}

/**
 * Cargar catálogos de podólogos y clínicas
 */
async function cargarCatalogos() {
  const res = await AppAuth.fetchApi('/api/recepcion/catalogos');
  if (res.ok && res.data) {
    catalogos = res.data;

    // Poblar selects de podólogos
    const selectFiltro = document.getElementById('filtro-podologo');
    const selectModalCita = document.getElementById('modal-cita-podologo');
    const selectEditCita = document.getElementById('edit-cita-podologo');

    if (selectFiltro) {
      selectFiltro.innerHTML = '<option value="">Todos los Podólogos</option>';
      catalogos.podologos.forEach(p => {
        selectFiltro.innerHTML += `<option value="${p.Cedula_podologo}">${p.nombre_completo || p.Nombre}</option>`;
      });
    }

    [selectModalCita, selectEditCita].forEach(select => {
      if (select) {
        select.innerHTML = '<option value="">Seleccione un podólogo...</option>';
        catalogos.podologos.forEach(p => {
          select.innerHTML += `<option value="${p.Cedula_podologo}">${p.nombre_completo || p.Nombre} (${p.Cedula_podologo})</option>`;
        });
      }
    });

    // Poblar select de clínicas
    const selectClinica = document.getElementById('modal-cita-clinica');
    if (selectClinica) {
      selectClinica.innerHTML = '<option value="">Seleccione clínica...</option>';
      catalogos.clinicas.forEach(c => {
        selectClinica.innerHTML += `<option value="${c.Clinica_id}">${c.Nombre} - ${c.Municipio_clinica || ''}</option>`;
      });
    }

    const kpiMedicos = document.getElementById('kpi-medicos-activos');
    if (kpiMedicos) kpiMedicos.textContent = catalogos.podologos.length;
  }
}

/**
 * =========================================================================
 * 1. AGENDA GLOBAL (CRUD DE CONSULTAS)
 * =========================================================================
 */
async function cargarAgendaGlobal() {
  const tbody = document.getElementById('tabla-agenda-body');
  if (!tbody) return;

  const podologo = document.getElementById('filtro-podologo')?.value || '';
  const estado = document.getElementById('filtro-estado')?.value || '';
  const fecha = document.getElementById('filtro-fecha')?.value || '';

  const params = new URLSearchParams();
  if (podologo) params.append('podologo', podologo);
  if (estado) params.append('estado', estado);
  if (fecha) params.append('fecha', fecha);

  const endpoint = `/api/recepcion/consultas?${params.toString()}`;
  const res = await AppAuth.fetchApi(endpoint);

  if (res.ok && Array.isArray(res.data)) {
    listaConsultasCache = res.data;
    renderTablaAgenda(res.data);
    actualizarKPIsAgenda(res.data);
  } else {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--color-danger); padding: 1.5rem;">Error al cargar la agenda global</td></tr>`;
  }
}

function renderTablaAgenda(consultas) {
  const tbody = document.getElementById('tabla-agenda-body');
  if (!tbody) return;

  if (consultas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">No se encontraron consultas registradas con los filtros actuales.</td></tr>`;
    return;
  }

  tbody.innerHTML = consultas.map(c => {
    const fechaObj = new Date(c.fecha_hora);
    const fechaFormat = isNaN(fechaObj) ? c.fecha_hora : fechaObj.toLocaleString('es-MX', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const estadoBadgeClass = {
      'Programada': 'badge-programada',
      'En espera': 'badge-atencion',
      'En atención': 'badge-atencion',
      'Finalizada': 'badge-finalizada',
      'Cancelada': 'badge-cancelada'
    }[c.estado] || 'badge-programada';

    const estadoPagoBadge = c.estado_pago === 'Completado'
      ? `<span class="status-badge badge-pagado"><i class="fa-solid fa-check"></i> Pagado</span>`
      : `<span class="status-badge badge-pendiente"><i class="fa-solid fa-clock"></i> Pendiente</span>`;

    return `
      <tr>
        <td><strong>${fechaFormat}</strong></td>
        <td><code style="color:#38bdf8;">${c.Consulta_id}</code></td>
        <td>
          <div style="font-weight: 600;">${c.paciente_nombre || 'Paciente'}</div>
          <small style="color: var(--text-secondary);">Exp: ${c.fk_no_expediente}</small>
        </td>
        <td>${c.paciente_telefono || '—'}</td>
        <td>
          <i class="fa-solid fa-user-doctor" style="color: #c084fc; margin-right: 0.3rem;"></i>
          ${c.podologo_nombre || c.fk_cedula_podologo}
        </td>
        <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${c.motivo_o_notas || ''}">
          ${c.motivo_o_notas || '—'}
        </td>
        <td><span class="status-badge ${estadoBadgeClass}">${c.estado}</span></td>
        <td>${estadoPagoBadge}</td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-secondary btn-sm" onclick="abrirModalEditarConsulta('${c.Consulta_id}')" title="Reprogramar o cambiar estado">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            ${c.estado_pago !== 'Completado' ? `
              <button class="btn btn-success btn-sm" onclick="abrirModalCobro('${c.Consulta_id}', '${(c.paciente_nombre || '').replace(/'/g, "\\'")}')" title="Cobrar consulta">
                <i class="fa-solid fa-dollar-sign"></i> Cobrar
              </button>
            ` : `
              <button class="btn btn-secondary btn-sm" onclick="verComprobantePago('${c.Pago_id}')" title="Ver recibo de pago">
                <i class="fa-solid fa-receipt"></i>
              </button>
            `}
            <button class="btn btn-danger-outline btn-sm" onclick="cancelarConsulta('${c.Consulta_id}')" title="Cancelar cita">
              <i class="fa-solid fa-ban"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function actualizarKPIsAgenda(consultas) {
  const kpiTotal = document.getElementById('kpi-total-citas');
  const kpiPend = document.getElementById('kpi-pendientes');
  const kpiFin = document.getElementById('kpi-finalizadas');

  if (kpiTotal) kpiTotal.textContent = consultas.length;
  if (kpiPend) {
    kpiPend.textContent = consultas.filter(c => c.estado === 'Programada' || c.estado === 'En espera' || c.estado === 'En atención').length;
  }
  if (kpiFin) {
    kpiFin.textContent = consultas.filter(c => c.estado === 'Finalizada').length;
  }
}

function configurarEventosAgenda() {
  document.getElementById('filtro-podologo')?.addEventListener('change', cargarAgendaGlobal);
  document.getElementById('filtro-estado')?.addEventListener('change', cargarAgendaGlobal);
  document.getElementById('filtro-fecha')?.addEventListener('change', cargarAgendaGlobal);
  document.getElementById('btn-recargar-agenda')?.addEventListener('click', cargarAgendaGlobal);

  document.getElementById('btn-limpiar-filtros')?.addEventListener('click', () => {
    document.getElementById('filtro-podologo').value = '';
    document.getElementById('filtro-estado').value = '';
    document.getElementById('filtro-fecha').value = '';
    cargarAgendaGlobal();
  });

  // Modal Agendar Cita
  const btnAbrirModal = document.getElementById('btn-abrir-modal-cita');
  const modalCita = document.getElementById('modal-agendar-consulta');
  btnAbrirModal?.addEventListener('click', () => {
    poblarSelectPacientesModal();
    // Poner fecha mínima hoy
    const fechaInput = document.getElementById('modal-cita-fechahora');
    if (fechaInput) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      fechaInput.value = now.toISOString().slice(0, 16);
    }
    modalCita.showModal();
  });

  // Submit Agendar Cita
  const formCita = document.getElementById('form-agendar-consulta');
  formCita?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      fk_no_expediente: document.getElementById('modal-cita-paciente').value,
      fk_cedula_podologo: document.getElementById('modal-cita-podologo').value,
      fk_clinica_id: document.getElementById('modal-cita-clinica').value || 1,
      fecha_hora: document.getElementById('modal-cita-fechahora').value.replace('T', ' ') + ':00',
      motivo_o_notas: document.getElementById('modal-cita-motivo').value
    };

    const res = await AppAuth.fetchApi('/api/recepcion/consultas', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      AppAuth.showToast('¡Consulta agendada exitosamente en la Agenda Global!', 'success');
      modalCita.close();
      formCita.reset();
      cargarAgendaGlobal();
      cargarCobrosPendientes();
    } else {
      AppAuth.showToast(`Error al agendar consulta: ${res.data?.error || 'Verifique los campos'}`, 'error');
    }
  });

  // Submit Editar Cita
  const formEdit = document.getElementById('form-editar-consulta');
  formEdit?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-cita-id').value;
    const payload = {
      fk_cedula_podologo: document.getElementById('edit-cita-podologo').value,
      estado: document.getElementById('edit-cita-estado').value,
      fecha_hora: document.getElementById('edit-cita-fechahora').value.replace('T', ' ') + ':00',
      motivo_o_notas: document.getElementById('edit-cita-motivo').value
    };

    const res = await AppAuth.fetchApi(`/api/recepcion/consultas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      AppAuth.showToast('Consulta actualizada exitosamente', 'success');
      document.getElementById('modal-editar-consulta').close();
      cargarAgendaGlobal();
    }
  });
}

window.abrirModalEditarConsulta = (id) => {
  const consulta = listaConsultasCache.find(c => c.Consulta_id === id);
  if (!consulta) return;

  document.getElementById('edit-cita-id').value = consulta.Consulta_id;
  document.getElementById('edit-cita-id-display').value = `${consulta.Consulta_id} - ${consulta.paciente_nombre}`;
  document.getElementById('edit-cita-podologo').value = consulta.fk_cedula_podologo;
  document.getElementById('edit-cita-estado').value = consulta.estado;
  
  if (consulta.fecha_hora) {
    const d = new Date(consulta.fecha_hora);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    document.getElementById('edit-cita-fechahora').value = d.toISOString().slice(0, 16);
  }

  document.getElementById('edit-cita-motivo').value = consulta.motivo_o_notas || '';
  document.getElementById('modal-editar-consulta').showModal();
};

window.cancelarConsulta = async (id) => {
  if (!confirm(`¿Deseas marcar como Cancelada la consulta ${id}?`)) return;
  const res = await AppAuth.fetchApi(`/api/recepcion/consultas/${id}`, { method: 'DELETE' });
  if (res.ok) {
    AppAuth.showToast('Consulta marcada como Cancelada', 'info');
    cargarAgendaGlobal();
  }
};

/**
 * =========================================================================
 * 2. REGISTRO DE PACIENTES (EXCLUSIVAMENTE DATOS DE CONTACTO)
 * =========================================================================
 */
async function cargarDirectorioPacientes(query = '') {
  const tbody = document.getElementById('tabla-pacientes-body');
  if (!tbody) return;

  const endpoint = query ? `/api/recepcion/pacientes?q=${encodeURIComponent(query)}` : '/api/recepcion/pacientes';
  const res = await AppAuth.fetchApi(endpoint);

  if (res.ok && Array.isArray(res.data)) {
    listaPacientesCache = res.data;
    renderTablaPacientes(res.data);
  }
}

function renderTablaPacientes(pacientes) {
  const tbody = document.getElementById('tabla-pacientes-body');
  if (!tbody) return;

  if (pacientes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No se encontraron pacientes.</td></tr>`;
    return;
  }

  tbody.innerHTML = pacientes.map(p => `
    <tr>
      <td><strong style="color: #38bdf8;">#${p.No_expediente}</strong></td>
      <td><strong>${p.nombre_completo || `${p.Nombres} ${p.ape_paterno}`}</strong></td>
      <td>${p.telefono || '—'}</td>
      <td>${p.Municipio || '—'}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="agendarCitaParaPaciente('${p.No_expediente}')">
          <i class="fa-solid fa-calendar-plus"></i> Agendar Cita
        </button>
      </td>
    </tr>
  `).join('');
}

function poblarSelectPacientesModal(preseleccionarExpediente = null) {
  const select = document.getElementById('modal-cita-paciente');
  if (!select) return;

  select.innerHTML = '<option value="">Seleccione un paciente...</option>';
  listaPacientesCache.forEach(p => {
    const isSelected = String(p.No_expediente) === String(preseleccionarExpediente) ? 'selected' : '';
    select.innerHTML += `<option value="${p.No_expediente}" ${isSelected}>#${p.No_expediente} - ${p.nombre_completo || p.Nombres}</option>`;
  });
}

function configurarEventosPacientes() {
  const formPac = document.getElementById('form-registro-paciente');
  formPac?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Solo recopilar datos de contacto estrictamente permitidos para el Rol 3
    const payload = {
      Nombres: document.getElementById('pac-nombres').value.trim(),
      ape_paterno: document.getElementById('pac-ape-paterno').value.trim(),
      ape_materno: document.getElementById('pac-ape-materno').value.trim() || null,
      telefono: document.getElementById('pac-telefono').value.trim() || null,
      Fecha_nacimiento: document.getElementById('pac-fecha-nac').value || null,
      Sexo: document.getElementById('pac-sexo').value || null,
      Calle_direccion: document.getElementById('pac-calle').value.trim() || null,
      Municipio: document.getElementById('pac-municipio').value.trim() || null,
      Ocupacion: document.getElementById('pac-ocupacion').value.trim() || null
    };

    const res = await AppAuth.fetchApi('/api/recepcion/pacientes', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      AppAuth.showToast(`¡Paciente registrado con éxito! Expediente: #${res.data?.paciente?.No_expediente}`, 'success');
      formPac.reset();
      await cargarDirectorioPacientes();
    } else {
      AppAuth.showToast(`Error al registrar paciente: ${res.data?.error || 'Verifique los campos'}`, 'error');
    }
  });

  const buscador = document.getElementById('buscador-pacientes');
  let debounceTimeout = null;
  buscador?.addEventListener('input', (e) => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      cargarDirectorioPacientes(e.target.value.trim());
    }, 300);
  });
}

window.agendarCitaParaPaciente = (expediente) => {
  poblarSelectPacientesModal(expediente);
  const modalCita = document.getElementById('modal-agendar-consulta');
  if (modalCita) {
    const fechaInput = document.getElementById('modal-cita-fechahora');
    if (fechaInput) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      fechaInput.value = now.toISOString().slice(0, 16);
    }
    modalCita.showModal();
  }
};

/**
 * =========================================================================
 * 3. MÓDULO DE COBROS (PAGOS CON fk_recepcionista_id)
 * =========================================================================
 */
async function cargarCobrosPendientes() {
  const tbody = document.getElementById('tabla-cobros-pendientes-body');
  if (!tbody) return;

  const res = await AppAuth.fetchApi('/api/recepcion/cobros/pendientes');
  if (res.ok && Array.isArray(res.data)) {
    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">No hay consultas pendientes de cobro en este momento.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(item => `
      <tr>
        <td><strong style="color: #38bdf8;">${item.Consulta_id}</strong></td>
        <td>${new Date(item.fecha_hora).toLocaleDateString('es-MX')}</td>
        <td>#${item.No_expediente}</td>
        <td><strong>${item.paciente_nombre}</strong></td>
        <td>${item.podologo_nombre}</td>
        <td><span class="status-badge badge-programada">${item.estado}</span></td>
        <td><span class="status-badge badge-pendiente">Pendiente</span></td>
        <td>
          <button class="btn btn-success btn-sm" onclick="abrirModalCobro('${item.Consulta_id}', '${(item.paciente_nombre || '').replace(/'/g, "\\'")}')">
            <i class="fa-solid fa-cash-register"></i> Cobrar Consulta
          </button>
        </td>
      </tr>
    `).join('');
  }
}

async function cargarHistorialCobros() {
  const tbody = document.getElementById('tabla-historial-cobros-body');
  if (!tbody) return;

  const res = await AppAuth.fetchApi('/api/recepcion/cobros');
  if (res.ok && Array.isArray(res.data)) {
    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">No se han registrado cobros aún.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(item => `
      <tr>
        <td><code>${item.Pago_id}</code></td>
        <td>${new Date(item.fecha_pago).toLocaleString('es-MX')}</td>
        <td>${item.fk_consulta_id}</td>
        <td><strong>${item.paciente_nombre}</strong></td>
        <td><strong style="color: #34d399;">$${parseFloat(item.monto).toFixed(2)}</strong></td>
        <td><span class="status-badge badge-programada">${item.metodo_pago}</span></td>
        <td>
          <i class="fa-solid fa-user-check" style="color: #38bdf8;"></i>
          ${item.recepcionista_nombre || `Recepcionista [${item.fk_recepcionista_id}]`}
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="verComprobantePago('${item.Pago_id}')">
            <i class="fa-solid fa-file-invoice-dollar"></i> Recibo
          </button>
        </td>
      </tr>
    `).join('');
  }
}

window.abrirModalCobro = (consultaId, pacienteNombre) => {
  document.getElementById('cobro-consulta-id').value = consultaId;
  document.getElementById('cobro-paciente-display').value = `${consultaId} - ${pacienteNombre}`;
  document.getElementById('cobro-monto').value = '450.00';
  document.getElementById('modal-procesar-cobro').showModal();
};

function configurarEventosCobros() {
  const btnPendientes = document.getElementById('btn-ver-cobros-pendientes');
  const btnHistorial = document.getElementById('btn-ver-historial-cobros');
  const secPendientes = document.getElementById('seccion-pendientes-cobro');
  const secHistorial = document.getElementById('seccion-historial-cobros');

  btnPendientes?.addEventListener('click', () => {
    btnPendientes.classList.add('active');
    btnHistorial.classList.remove('active');
    secPendientes.style.display = 'block';
    secHistorial.style.display = 'none';
    cargarCobrosPendientes();
  });

  btnHistorial?.addEventListener('click', () => {
    btnHistorial.classList.add('active');
    btnPendientes.classList.remove('active');
    secHistorial.style.display = 'block';
    secPendientes.style.display = 'none';
    cargarHistorialCobros();
  });

  // Submit Cobro
  const formCobro = document.getElementById('form-procesar-cobro');
  formCobro?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      fk_consulta_id: document.getElementById('cobro-consulta-id').value,
      monto: parseFloat(document.getElementById('cobro-monto').value),
      metodo_pago: document.getElementById('cobro-metodo').value
    };

    const res = await AppAuth.fetchApi('/api/recepcion/cobros', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      AppAuth.showToast('¡Cobro procesado y registrado con éxito!', 'success');
      document.getElementById('modal-procesar-cobro').close();
      cargarCobrosPendientes();
      cargarAgendaGlobal();
      verComprobantePago(res.data?.pago?.Pago_id);
    } else {
      AppAuth.showToast(`Error al procesar cobro: ${res.data?.error || ''}`, 'error');
    }
  });
}

window.verComprobantePago = async (pagoId) => {
  if (!pagoId) return;
  const res = await AppAuth.fetchApi(`/api/recepcion/cobros/${pagoId}/recibo`);
  if (res.ok && res.data) {
    const p = res.data;
    const renderDiv = document.getElementById('recibo-contenido-render');
    if (renderDiv) {
      renderDiv.innerHTML = `
        <div class="receipt-card">
          <div class="receipt-header">
            <h3 style="color:#fff; margin-bottom: 0.25rem;">${p.clinica_nombre || 'ELITE FOOT CARE'}</h3>
            <p style="font-size: 0.8rem; color: #94a3b8;">${p.Calle_clinica || ''}, ${p.Municipio_clinica || ''}</p>
            <p style="font-size: 0.78rem; color: #94a3b8;">Tel: ${p.clinica_telefono || '5512345678'}</p>
            <div style="margin-top: 0.75rem; font-weight: bold; color: #38bdf8;">COMPROBANTE OFICIAL DE PAGO</div>
          </div>
          <div class="receipt-row">
            <span>No. Transacción:</span>
            <strong>${p.Pago_id}</strong>
          </div>
          <div class="receipt-row">
            <span>Fecha y Hora:</span>
            <span>${new Date(p.fecha_pago).toLocaleString('es-MX')}</span>
          </div>
          <div class="receipt-row">
            <span>Consulta Asociada:</span>
            <span>${p.Consulta_id}</span>
          </div>
          <div class="receipt-row">
            <span>Paciente:</span>
            <strong>${p.paciente_nombre} (Exp: ${p.No_expediente})</strong>
          </div>
          <div class="receipt-row">
            <span>Podólogo Tratante:</span>
            <span>${p.podologo_nombre}</span>
          </div>
          <div class="receipt-row">
            <span>Recepcionista Responsable:</span>
            <span>${p.recepcionista_nombre || 'Recepción'}</span>
          </div>
          <div class="receipt-row">
            <span>Método de Pago:</span>
            <span>${p.metodo_pago}</span>
          </div>
          <div class="receipt-row receipt-total">
            <span>TOTAL PAGADO:</span>
            <span>$${parseFloat(p.monto).toFixed(2)} MXN</span>
          </div>
          <p style="font-size: 0.72rem; text-align: center; color: #64748b; margin-top: 1rem;">
            Gracias por confiar en Elite Foot Care. Conserve este comprobante para cualquier aclaración.
          </p>
        </div>
      `;
    }
    document.getElementById('modal-ver-recibo').showModal();
  }
};

/**
 * =========================================================================
 * 4. COMPROBACIÓN DE AUDITORÍA Y SEGURIDAD RBAC EN VIVO
 * =========================================================================
 */
function configurarPruebaSeguridadRBAC() {
  const btn = document.getElementById('btn-probar-bloqueo-recep');
  const box = document.getElementById('resultado-bloqueo-box');
  const jsonPre = document.getElementById('resultado-bloqueo-json');

  btn?.addEventListener('click', async () => {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ejecutando petición interceptada...';

    // Intento explícito de consultar endpoint clínico prohibido
    const res = await AppAuth.fetchApi('/api/recepcion/prueba-bloqueo/diagnosticos');

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-shield-virus"></i> Ejecutar Petición de Prueba Bloqueada (GET /api/recepcion/prueba-bloqueo/diagnosticos)';

    if (box && jsonPre) {
      box.style.display = 'block';
      jsonPre.textContent = JSON.stringify({
        http_status: res.status,
        estado: res.status === 403 ? '403 Forbidden (BLOQUEADO CORRECTAMENTE)' : res.status,
        middleware_activado: 'bloquearTablasClinicasParaRecepcionista',
        respuesta_servidor: res.data
      }, null, 2);
    }
  });
}
