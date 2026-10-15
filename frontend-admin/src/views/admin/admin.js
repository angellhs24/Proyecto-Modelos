/**
 * LÓGICA DE VANILLA JS: PANEL DE ADMINISTRACIÓN GENERAL (ROL ID: 1)
 * Elite Foot Care - Gestión de Podólogos, Recepcionistas, Pacientes y Avisos
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializar sesión para Administrador (Rol ID: 1)
  let currentUser = AppAuth.getCurrentUser();
  if (!currentUser || currentUser.fk_rol_id !== 1) {
    currentUser = await AppAuth.autoLoginDemo(1);
  }

  actualizarUIAdmin(currentUser);

  // 2. Control de pestañas Material 3
  inicializarNavegacionTabs();

  // 3. Cargar datos iniciales
  await Promise.all([
    cargarMetricas(),
    cargarPodologos(),
    cargarRecepcionistas(),
    cargarClinicas(),
    cargarPacientes(),
    cargarHistorialAvisos()
  ]);

  // 4. Configurar escuchadores de eventos y formularios
  configurarEventosPodologos();
  configurarEventosRecepcionistas();
  configurarEventosClinicas();
  configurarEventosPacientes();
  configurarEventosAvisos();
});

// Variables de Estado en Memoria
let listaPodologosCache = [];
let listaRecepcionistasCache = [];
let listaClinicasCache = [];
let listaPacientesCache = [];
let listaAvisosCache = [];
let podologoEnEdicion = null;
let recepcionistaEnEdicion = null;
let clinicaEnEdicion = null;
let pacienteEnEdicion = null;
let accionEstadoPendiente = null; // { tipo: 'podologo' | 'recepcionista' | 'clinica', id: ..., activoActual: ... }

/**
 * Actualiza el chip del administrador en el encabezado
 */
function actualizarUIAdmin(user) {
  if (!user) return;
  const nameEl = document.getElementById('admin-display-name');
  const avatarEl = document.getElementById('admin-avatar-initials');

  const nombre = user.nombre || user.perfil?.Nombre || 'Lic. Roberto';
  const ape = user.ape_paterno || user.perfil?.ape_paterno || 'Méndez';
  const nombreCompleto = `${nombre} ${ape}`.trim();

  if (nameEl) nameEl.textContent = nombreCompleto;
  if (avatarEl) avatarEl.textContent = `${nombre[0] || 'A'}${ape[0] || 'D'}`;
}

/**
 * Control del sistema de pestañas Material 3
 */
function inicializarNavegacionTabs() {
  const tabs = document.querySelectorAll('.nav-tab-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      navegarAPestana(targetId);
    });
  });
}

function navegarAPestana(tabId) {
  document.querySelectorAll('.nav-tab-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));

  const btn = document.querySelector(`.nav-tab-btn[data-tab="${tabId}"]`);
  const pane = document.getElementById(tabId);

  if (btn) btn.classList.add('active');
  if (pane) pane.classList.add('active');
}

// =========================================================================
// 1. DASHBOARD & KPIS
// =========================================================================
async function cargarMetricas() {
  const res = await AppAuth.fetchApi('/api/admin/metricas');
  const data = (res && res.ok && res.data) ? res.data : {
    podologos: { total: listaPodologosCache.length || 3, activos: 3, baja: 0 },
    recepcionistas: { total: listaRecepcionistasCache.length || 3, activos: 2, baja: 1 },
    pacientes: { total: listaPacientesCache.length || 52, diabeticos: 13, hipertensos: 14 },
    avisos: { total: 3, ultimos: [] }
  };

  // KPI Podólogos
  const podosTotalEl = document.getElementById('kpi-podos-total');
  const podosSubEl = document.getElementById('kpi-podos-sub');
  if (podosTotalEl) podosTotalEl.textContent = data.podologos?.total || 0;
  if (podosSubEl) {
    podosSubEl.textContent = `${data.podologos?.activos || 0} activos • ${data.podologos?.baja || 0} dados de baja`;
  }

  // KPI Recepcionistas
  const recepsTotalEl = document.getElementById('kpi-receps-total');
  const recepsSubEl = document.getElementById('kpi-receps-sub');
  if (recepsTotalEl) recepsTotalEl.textContent = data.recepcionistas?.total || 0;
  if (recepsSubEl) {
    recepsSubEl.textContent = `${data.recepcionistas?.activos || 0} activas • ${data.recepcionistas?.baja || 0} dadas de baja`;
  }

  // KPI Pacientes
  const pacTotalEl = document.getElementById('kpi-pacientes-total');
  const pacSubEl = document.getElementById('kpi-pacientes-sub');
  if (pacTotalEl) pacTotalEl.textContent = data.pacientes?.total || 0;
  if (pacSubEl) {
    pacSubEl.textContent = `${data.pacientes?.diabeticos || 0} Diabéticos • ${data.pacientes?.hipertensos || 0} Hipertensos`;
  }

  // KPI Avisos
  const avisosTotalEl = document.getElementById('kpi-avisos-total');
  const avisosSubEl = document.getElementById('kpi-avisos-sub');
  if (avisosTotalEl) avisosTotalEl.textContent = data.avisos?.total || 0;
  if (avisosSubEl) avisosSubEl.textContent = `Registrados en el sistema`;

  // Render resumen de avisos
  renderResumenUltimosAvisos(data.avisos?.ultimos || []);
}

function renderResumenUltimosAvisos(avisos) {
  const container = document.getElementById('resumen-ultimos-avisos');
  if (!container) return;

  if (avisos.length === 0) {
    container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.88rem;">No hay avisos recientes emitidos.</div>`;
    return;
  }

  container.innerHTML = avisos
    .slice(0, 3)
    .map(
      (a) => `
      <div style="padding: 0.85rem; background: rgba(2, 6, 23, 0.5); border-radius: 10px; border: 1px solid var(--border-color);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <strong style="color: #38bdf8; font-size: 0.9rem;">${escapeHtml(a.paciente_nombre)}</strong>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(a.fecha_envio)}</span>
        </div>
        <div style="font-size: 0.82rem; color: #f8fafc; line-height: 1.35;">${escapeHtml(a.mensaje)}</div>
      </div>
    `
    )
    .join('');
}

// =========================================================================
// 2. GESTIÓN DE PODÓLOGOS
// =========================================================================
async function cargarPodologos() {
  const res = await AppAuth.fetchApi('/api/admin/podologos');
  if (!res.ok) {
    AppAuth.showToast('No se pudieron cargar los podólogos', 'error');
    return;
  }

  listaPodologosCache = res.data || [];
  renderPodologosGrid(listaPodologosCache);
}

function renderPodologosGrid(podologos) {
  const container = document.getElementById('contenedor-podologos-grid');
  if (!container) return;

  if (podologos.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
        <i class="fa-solid fa-user-doctor" style="font-size: 2.5rem; opacity: 0.4; margin-bottom: 1rem;"></i>
        <p>No se encontraron podólogos con los filtros seleccionados.</p>
      </div>
    `;
    return;
  }

  const turnosMap = {
    M: 'Matutino (9:00 - 14:00)',
    V: 'Vespertino (14:00 - 19:00)',
    C: 'Completo / Mixto'
  };

  container.innerHTML = podologos
    .map((p) => {
      const estaActivo = p.activo !== false;
      const initials = `${p.Nombre?.[0] || 'P'}${p.ape_paterno?.[0] || 'O'}`.toUpperCase();
      const turnoTexto = turnosMap[p.turno] || p.turno || 'Completo';

      return `
      <div class="staff-card ${estaActivo ? '' : 'inactive'}" data-cedula="${escapeHtml(p.Cedula_podologo)}">
        <div class="staff-header">
          <div class="staff-avatar">${initials}</div>
          <div class="staff-title-group" style="flex: 1;">
            <h4>Dr. ${escapeHtml(p.Nombre)} ${escapeHtml(p.ape_paterno)} ${escapeHtml(p.ape_materno || '')}</h4>
            <div class="staff-subtitle">
              <i class="fa-solid fa-id-card"></i> Cédula: <strong>${escapeHtml(p.Cedula_podologo)}</strong>
            </div>
          </div>
          <div>
            ${
              estaActivo
                ? '<span class="status-pill active">Activo</span>'
                : '<span class="status-pill baja">Baja Temporal</span>'
            }
          </div>
        </div>

        <div class="staff-details-list">
          <div class="staff-detail-item">
            <i class="fa-solid fa-envelope"></i>
            <span>${escapeHtml(p.Email || 'Sin correo registrado')}</span>
          </div>
          <div class="staff-detail-item">
            <i class="fa-solid fa-phone"></i>
            <span>${escapeHtml(p.Telefono_pod || 'Sin teléfono')}</span>
          </div>
          <div class="staff-detail-item">
            <i class="fa-solid fa-clock"></i>
            <span>Turno: ${escapeHtml(turnoTexto)}</span>
          </div>
        </div>

        <div class="staff-actions">
          <button class="btn btn-secondary" style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" onclick="editarPodologo('${escapeHtml(p.Cedula_podologo)}')">
            <i class="fa-solid fa-pen-to-square"></i> Editar
          </button>

          ${
            estaActivo
              ? `
              <button class="btn-toggle-baja danger" onclick="confirmarCambioEstadoPodologo('${escapeHtml(p.Cedula_podologo)}', true)">
                <i class="fa-solid fa-user-xmark"></i> Dar de Baja
              </button>
            `
              : `
              <button class="btn-toggle-baja success" onclick="confirmarCambioEstadoPodologo('${escapeHtml(p.Cedula_podologo)}', false)">
                <i class="fa-solid fa-user-check"></i> Reactivar
              </button>
            `
          }
        </div>
      </div>
    `;
    })
    .join('');
}

function configurarEventosPodologos() {
  // Filtro de búsqueda
  const inputBuscar = document.getElementById('filtro-podologos-buscar');
  const selectEstado = document.getElementById('filtro-podologos-estado');

  function filtrar() {
    const q = (inputBuscar?.value || '').toLowerCase().trim();
    const estado = selectEstado?.value || 'todos';

    const filtrados = listaPodologosCache.filter((p) => {
      const matchText =
        !q ||
        (p.Nombre || '').toLowerCase().includes(q) ||
        (p.ape_paterno || '').toLowerCase().includes(q) ||
        (p.Cedula_podologo || '').toLowerCase().includes(q) ||
        (p.Email || '').toLowerCase().includes(q);

      const matchEstado =
        estado === 'todos' ||
        (estado === 'activos' && p.activo !== false) ||
        (estado === 'baja' && p.activo === false);

      return matchText && matchEstado;
    });

    renderPodologosGrid(filtrados);
  }

  inputBuscar?.addEventListener('input', filtrar);
  selectEstado?.addEventListener('change', filtrar);

  // Formulario crear / editar
  const form = document.getElementById('form-podologo');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const cedula = document.getElementById('podo-cedula').value.trim();
    const nombre = document.getElementById('podo-nombre').value.trim();
    const paterno = document.getElementById('podo-paterno').value.trim();
    const materno = document.getElementById('podo-materno').value.trim();
    const telefono = document.getElementById('podo-telefono').value.trim();
    const email = document.getElementById('podo-email').value.trim();
    const turno = document.getElementById('podo-turno').value;
    const password = document.getElementById('podo-password').value.trim();

    if (podologoEnEdicion) {
      // Editar
      const res = await AppAuth.fetchApi(`/api/admin/podologos/${podologoEnEdicion.Cedula_podologo}`, {
        method: 'PUT',
        body: JSON.stringify({
          Nombre: nombre,
          ape_paterno: paterno,
          ape_materno: materno,
          Telefono_pod: telefono,
          Email: email,
          turno
        })
      });

      if (res.ok) {
        AppAuth.showToast('¡Datos del podólogo actualizados exitosamente!', 'success');
        cerrarModal('modal-podologo');
        await cargarPodologos();
        await cargarMetricas();
      } else {
        AppAuth.showToast(`Error: ${res.data?.error || 'No se pudo actualizar'}`, 'error');
      }
    } else {
      // Crear
      const res = await AppAuth.fetchApi('/api/admin/podologos', {
        method: 'POST',
        body: JSON.stringify({
          Cedula_podologo: cedula,
          Nombre: nombre,
          ape_paterno: paterno,
          ape_materno: materno,
          Telefono_pod: telefono,
          Email: email,
          turno,
          password: password || 'podo123'
        })
      });

      if (res.ok) {
        AppAuth.showToast('¡Podólogo dado de alta con éxito!', 'success');
        cerrarModal('modal-podologo');
        await cargarPodologos();
        await cargarMetricas();
      } else {
        AppAuth.showToast(`Error: ${res.data?.error || 'No se pudo registrar'}`, 'error');
      }
    }
  });
}

function abrirModalNuevoPodologo() {
  podologoEnEdicion = null;
  const form = document.getElementById('form-podologo');
  if (form) form.reset();

  document.getElementById('modal-podologo-titulo').innerHTML = `
    <i class="fa-solid fa-user-plus" style="color: #38bdf8;"></i> Alta de Podólogo
  `;
  document.getElementById('podo-cedula').removeAttribute('readonly');
  document.getElementById('grupo-podo-password').style.display = 'block';

  abrirModal('modal-podologo');
}

function editarPodologo(cedula) {
  const p = listaPodologosCache.find((x) => x.Cedula_podologo === cedula);
  if (!p) return;

  podologoEnEdicion = p;
  document.getElementById('modal-podologo-titulo').innerHTML = `
    <i class="fa-solid fa-pen-to-square" style="color: #38bdf8;"></i> Modificar Podólogo: Dr. ${escapeHtml(p.Nombre)}
  `;

  document.getElementById('podo-cedula').value = p.Cedula_podologo;
  document.getElementById('podo-cedula').setAttribute('readonly', 'true');
  document.getElementById('podo-nombre').value = p.Nombre || '';
  document.getElementById('podo-paterno').value = p.ape_paterno || '';
  document.getElementById('podo-materno').value = p.ape_materno || '';
  document.getElementById('podo-telefono').value = p.Telefono_pod || '';
  document.getElementById('podo-email').value = p.Email || '';
  document.getElementById('podo-turno').value = p.turno || 'C';
  document.getElementById('grupo-podo-password').style.display = 'none';

  abrirModal('modal-podologo');
}

function confirmarCambioEstadoPodologo(cedula, estaActivoActualmente) {
  const p = listaPodologosCache.find((x) => x.Cedula_podologo === cedula);
  if (!p) return;

  accionEstadoPendiente = {
    tipo: 'podologo',
    id: cedula,
    nuevoEstado: !estaActivoActualmente,
    nombre: `Dr. ${p.Nombre} ${p.ape_paterno}`
  };

  const tituloEl = document.getElementById('modal-confirm-titulo');
  const mensajeEl = document.getElementById('modal-confirm-mensaje');
  const btnAccion = document.getElementById('btn-confirmar-cambio-accion');
  const motivoInput = document.getElementById('confirm-motivo');
  if (motivoInput) motivoInput.value = '';

  if (estaActivoActualmente) {
    tituloEl.innerHTML = `<i class="fa-solid fa-user-xmark" style="color: #f87171;"></i> Confirmar Baja Temporal`;
    mensajeEl.innerHTML = `¿Confirmas que deseas dar de <strong>BAJA TEMPORAL</strong> al especialista <strong>Dr. ${escapeHtml(p.Nombre)} ${escapeHtml(p.ape_paterno)}</strong> (Cédula: ${escapeHtml(cedula)})?`;
    btnAccion.className = 'btn btn-danger';
    btnAccion.textContent = 'Dar de Baja Especialista';
  } else {
    tituloEl.innerHTML = `<i class="fa-solid fa-user-check" style="color: #34d399;"></i> Confirmar Reactivación`;
    mensajeEl.innerHTML = `¿Confirmas que deseas <strong>REACTIVAR</strong> el acceso y agenda para el especialista <strong>Dr. ${escapeHtml(p.Nombre)} ${escapeHtml(p.ape_paterno)}</strong>?`;
    btnAccion.className = 'btn btn-success';
    btnAccion.textContent = 'Reactivar Especialista';
  }

  abrirModal('modal-confirmar-estado');
}

// =========================================================================
// 3. GESTIÓN DE RECEPCIONISTAS
// =========================================================================
async function cargarRecepcionistas() {
  const res = await AppAuth.fetchApi('/api/admin/recepcionistas');
  if (!res.ok) {
    AppAuth.showToast('No se pudieron cargar las recepcionistas', 'error');
    return;
  }

  listaRecepcionistasCache = res.data || [];
  renderRecepcionistasGrid(listaRecepcionistasCache);
}

function renderRecepcionistasGrid(recepcionistas) {
  const container = document.getElementById('contenedor-recepcionistas-grid');
  if (!container) return;

  if (recepcionistas.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
        <i class="fa-solid fa-users-gear" style="font-size: 2.5rem; opacity: 0.4; margin-bottom: 1rem;"></i>
        <p>No se encontraron recepcionistas registradas con los filtros.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = recepcionistas
    .map((r) => {
      const estaActiva = r.activo !== false;
      const initials = `${r.nombre?.[0] || 'R'}${r.ape_paterno?.[0] || 'E'}`.toUpperCase();

      return `
      <div class="staff-card ${estaActiva ? '' : 'inactive'}" data-recep-id="${r.id}">
        <div class="staff-header">
          <div class="staff-avatar recep">${initials}</div>
          <div class="staff-title-group" style="flex: 1;">
            <h4>${escapeHtml(r.nombre)} ${escapeHtml(r.ape_paterno)} ${escapeHtml(r.ape_materno || '')}</h4>
            <div class="staff-subtitle">
              <i class="fa-solid fa-hospital"></i> Sede: <strong>${escapeHtml(r.clinica_nombre || 'DIF Tecámac')}</strong>
            </div>
          </div>
          <div>
            ${
              estaActiva
                ? '<span class="status-pill active">Activa</span>'
                : '<span class="status-pill baja">Baja Temporal</span>'
            }
          </div>
        </div>

        <div class="staff-details-list">
          <div class="staff-detail-item">
            <i class="fa-solid fa-envelope"></i>
            <span>${escapeHtml(r.email || 'Sin correo')}</span>
          </div>
          <div class="staff-detail-item">
            <i class="fa-solid fa-phone"></i>
            <span>${escapeHtml(r.telefono || 'Sin teléfono')}</span>
          </div>
          <div class="staff-detail-item">
            <i class="fa-solid fa-calendar-check"></i>
            <span>Turno: ${escapeHtml(r.turno || 'Matutino')}</span>
          </div>
          ${
            r.motivo_baja
              ? `
            <div class="staff-detail-item" style="color: #f87171;">
              <i class="fa-solid fa-circle-exclamation"></i>
              <span>Motivo: ${escapeHtml(r.motivo_baja)}</span>
            </div>
          `
              : ''
          }
        </div>

        <div class="staff-actions">
          <button class="btn btn-secondary" style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" onclick="editarRecepcionista(${r.id})">
            <i class="fa-solid fa-pen-to-square"></i> Editar
          </button>

          ${
            estaActiva
              ? `
              <button class="btn-toggle-baja danger" onclick="confirmarCambioEstadoRecepcionista(${r.id}, true)">
                <i class="fa-solid fa-user-xmark"></i> Dar de Baja
              </button>
            `
              : `
              <button class="btn-toggle-baja success" onclick="confirmarCambioEstadoRecepcionista(${r.id}, false)">
                <i class="fa-solid fa-user-check"></i> Reactivar
              </button>
            `
          }
        </div>
      </div>
    `;
    })
    .join('');
}

function configurarEventosRecepcionistas() {
  const inputBuscar = document.getElementById('filtro-recep-buscar');
  const selectEstado = document.getElementById('filtro-recep-estado');

  function filtrar() {
    const q = (inputBuscar?.value || '').toLowerCase().trim();
    const estado = selectEstado?.value || 'todos';

    const filtrados = listaRecepcionistasCache.filter((r) => {
      const matchText =
        !q ||
        (r.nombre || '').toLowerCase().includes(q) ||
        (r.ape_paterno || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.clinica_nombre || '').toLowerCase().includes(q);

      const matchEstado =
        estado === 'todos' ||
        (estado === 'activos' && r.activo !== false) ||
        (estado === 'baja' && r.activo === false);

      return matchText && matchEstado;
    });

    renderRecepcionistasGrid(filtrados);
  }

  inputBuscar?.addEventListener('input', filtrar);
  selectEstado?.addEventListener('change', filtrar);

  // Formulario Recepcionista
  const form = document.getElementById('form-recepcionista');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('recep-edit-id').value;
    const nombre = document.getElementById('recep-nombre').value.trim();
    const paterno = document.getElementById('recep-paterno').value.trim();
    const materno = document.getElementById('recep-materno').value.trim();
    const email = document.getElementById('recep-email').value.trim();
    const telefono = document.getElementById('recep-telefono').value.trim();
    const fkClinica = document.getElementById('recep-clinica').value;
    const turno = document.getElementById('recep-turno').value;
    const clinicaNombre = document.getElementById('recep-clinica').selectedOptions[0]?.text || 'DIF Tecámac';

    if (id) {
      // Editar
      const res = await AppAuth.fetchApi(`/api/admin/recepcionistas/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          nombre,
          ape_paterno: paterno,
          ape_materno: materno,
          email,
          telefono,
          fk_clinica_id: fkClinica,
          turno,
          clinica_nombre: clinicaNombre
        })
      });

      if (res.ok) {
        AppAuth.showToast('¡Datos de recepcionista actualizados!', 'success');
        cerrarModal('modal-recepcionista');
        await cargarRecepcionistas();
        await cargarMetricas();
      } else {
        AppAuth.showToast('Error al actualizar recepcionista', 'error');
      }
    } else {
      // Crear
      const res = await AppAuth.fetchApi('/api/admin/recepcionistas', {
        method: 'POST',
        body: JSON.stringify({
          nombre,
          ape_paterno: paterno,
          ape_materno: materno,
          email,
          telefono,
          fk_clinica_id: fkClinica,
          turno,
          clinica_nombre: clinicaNombre
        })
      });

      if (res.ok) {
        AppAuth.showToast('¡Recepcionista registrada con éxito!', 'success');
        cerrarModal('modal-recepcionista');
        await cargarRecepcionistas();
        await cargarMetricas();
      } else {
        AppAuth.showToast('Error al registrar recepcionista', 'error');
      }
    }
  });

  // Modal confirmación de baja/reactivación común
  const btnConfirmAccion = document.getElementById('btn-confirmar-cambio-accion');
  btnConfirmAccion?.addEventListener('click', async () => {
    if (!accionEstadoPendiente) return;
    const { tipo, id, nuevoEstado } = accionEstadoPendiente;
    const motivo = document.getElementById('confirm-motivo')?.value.trim();

    if (tipo === 'podologo') {
      const res = await AppAuth.fetchApi(`/api/admin/podologos/${id}/estado`, {
        method: 'PUT',
        body: JSON.stringify({ activo: nuevoEstado, motivo })
      });
      if (res.ok) {
        AppAuth.showToast(res.data.mensaje, nuevoEstado ? 'success' : 'info');
        cerrarModal('modal-confirmar-estado');
        await cargarPodologos();
        await cargarMetricas();
      }
    } else if (tipo === 'recepcionista') {
      const res = await AppAuth.fetchApi(`/api/admin/recepcionistas/${id}/estado`, {
        method: 'PUT',
        body: JSON.stringify({ activo: nuevoEstado, motivo })
      });
      if (res.ok) {
        AppAuth.showToast(res.data.mensaje, nuevoEstado ? 'success' : 'info');
        cerrarModal('modal-confirmar-estado');
        await cargarRecepcionistas();
        await cargarMetricas();
      }
    } else if (tipo === 'clinica') {
      const res = await AppAuth.fetchApi(`/api/admin/clinicas/${id}/estado`, {
        method: 'PUT',
        body: JSON.stringify({ activa: nuevoEstado ? 1 : 0, motivo })
      });
      if (res.ok) {
        AppAuth.showToast(res.data?.mensaje || 'Estado de sede clínica actualizado', nuevoEstado ? 'success' : 'info');
        cerrarModal('modal-confirmar-estado');
        await cargarClinicas();
        await cargarMetricas();
      } else {
        AppAuth.showToast(res.data?.error || 'Error al actualizar sede clínica', 'error');
      }
    }
    accionEstadoPendiente = null;
  });
}

function abrirModalNuevaRecepcionista() {
  recepcionistaEnEdicion = null;
  const form = document.getElementById('form-recepcionista');
  if (form) form.reset();
  document.getElementById('recep-edit-id').value = '';
  document.getElementById('modal-recep-titulo').innerHTML = `
    <i class="fa-solid fa-user-plus" style="color: #34d399;"></i> Alta de Recepcionista
  `;
  abrirModal('modal-recepcionista');
}

function editarRecepcionista(id) {
  const r = listaRecepcionistasCache.find((x) => x.id === id);
  if (!r) return;

  recepcionistaEnEdicion = r;
  document.getElementById('modal-recep-titulo').innerHTML = `
    <i class="fa-solid fa-pen-to-square" style="color: #34d399;"></i> Modificar Recepcionista: ${escapeHtml(r.nombre)}
  `;

  document.getElementById('recep-edit-id').value = r.id;
  document.getElementById('recep-nombre').value = r.nombre || '';
  document.getElementById('recep-paterno').value = r.ape_paterno || '';
  document.getElementById('recep-materno').value = r.ape_materno || '';
  document.getElementById('recep-email').value = r.email || '';
  document.getElementById('recep-telefono').value = r.telefono || '';
  document.getElementById('recep-clinica').value = r.fk_clinica_id || '14';
  document.getElementById('recep-turno').value = r.turno || 'Matutino (8:00 - 15:00)';

  abrirModal('modal-recepcionista');
}

function confirmarCambioEstadoRecepcionista(id, estaActivaActualmente) {
  const r = listaRecepcionistasCache.find((x) => x.id === id);
  if (!r) return;

  accionEstadoPendiente = {
    tipo: 'recepcionista',
    id,
    nuevoEstado: !estaActivaActualmente,
    nombre: `${r.nombre} ${r.ape_paterno}`
  };

  const tituloEl = document.getElementById('modal-confirm-titulo');
  const mensajeEl = document.getElementById('modal-confirm-mensaje');
  const btnAccion = document.getElementById('btn-confirmar-cambio-accion');
  const motivoInput = document.getElementById('confirm-motivo');
  if (motivoInput) motivoInput.value = '';

  if (estaActivaActualmente) {
    tituloEl.innerHTML = `<i class="fa-solid fa-user-xmark" style="color: #f87171;"></i> Confirmar Baja Temporal de Recepción`;
    mensajeEl.innerHTML = `¿Confirmas que deseas dar de <strong>BAJA TEMPORAL</strong> a la recepcionista <strong>${escapeHtml(r.nombre)} ${escapeHtml(r.ape_paterno)}</strong>?`;
    btnAccion.className = 'btn btn-danger';
    btnAccion.textContent = 'Dar de Baja Recepcionista';
  } else {
    tituloEl.innerHTML = `<i class="fa-solid fa-user-check" style="color: #34d399;"></i> Confirmar Reactivación de Recepción`;
    mensajeEl.innerHTML = `¿Confirmas que deseas <strong>REACTIVAR</strong> a la recepcionista <strong>${escapeHtml(r.nombre)} ${escapeHtml(r.ape_paterno)}</strong>?`;
    btnAccion.className = 'btn btn-success';
    btnAccion.textContent = 'Reactivar Recepcionista';
  }

  abrirModal('modal-confirmar-estado');
}

// =========================================================================
// 3.5 GESTIÓN DE SEDES CLÍNICAS (ALTA, BAJA Y EDICIÓN)
// =========================================================================
async function cargarClinicas() {
  const res = await AppAuth.fetchApi('/api/admin/clinicas');
  if (!res.ok) {
    AppAuth.showToast('No se pudieron cargar las sedes clínicas', 'error');
    return;
  }

  listaClinicasCache = res.data || [];
  renderClinicasGrid(listaClinicasCache);
  renderResumenClinicas(listaClinicasCache);
  poblarSelectClinicasRecepcionistas(listaClinicasCache);
}

function renderClinicasGrid(clinicas) {
  const container = document.getElementById('contenedor-clinicas-grid');
  if (!container) return;

  if (clinicas.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
        <i class="fa-solid fa-hospital" style="font-size: 2.5rem; opacity: 0.4; margin-bottom: 1rem;"></i>
        <p>No se encontraron sedes clínicas registradas con los filtros actuales.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = clinicas
    .map((c) => {
      const estaActiva = c.Activa === 1 || c.Activa === true || c.Activa === null;

      return `
      <div class="staff-card ${estaActiva ? '' : 'inactive'}" data-clinica-id="${c.Clinica_id}">
        <div class="staff-header">
          <div class="staff-avatar" style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.4)); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);">
            <i class="fa-solid fa-hospital"></i>
          </div>
          <div class="staff-title-group" style="flex: 1;">
            <h4>${escapeHtml(c.Nombre)}</h4>
            <div class="staff-subtitle">
              <i class="fa-solid fa-hashtag"></i> Sede ID: <strong>${c.Clinica_id}</strong>
            </div>
          </div>
          <div>
            ${
              estaActiva
                ? '<span class="status-pill active"><i class="fa-solid fa-circle-check"></i> Operativa</span>'
                : '<span class="status-pill baja"><i class="fa-solid fa-circle-xmark"></i> Baja Temporal</span>'
            }
          </div>
        </div>

        <div class="staff-details-list">
          <div class="staff-detail-item">
            <i class="fa-solid fa-location-dot"></i>
            <span>${escapeHtml(c.Calle_clinica || 'Dirección no especificada')}</span>
          </div>
          <div class="staff-detail-item">
            <i class="fa-solid fa-city"></i>
            <span>Municipio: <strong>${escapeHtml(c.Municipio_clinica || 'Tecámac')}</strong></span>
          </div>
          <div class="staff-detail-item">
            <i class="fa-solid fa-phone"></i>
            <span>Teléfono: <strong>${escapeHtml(c.Telefono || 'Sin teléfono registrado')}</strong></span>
          </div>
        </div>

        <div class="staff-actions">
          <button class="btn btn-secondary" style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" onclick="editarClinica(${c.Clinica_id})">
            <i class="fa-solid fa-pen-to-square"></i> Editar Sede
          </button>
          ${
            estaActiva
              ? `
              <button class="btn-toggle-baja danger" onclick="confirmarCambioEstadoClinica(${c.Clinica_id}, true)">
                <i class="fa-solid fa-ban"></i> Dar de Baja
              </button>
            `
              : `
              <button class="btn-toggle-baja success" onclick="confirmarCambioEstadoClinica(${c.Clinica_id}, false)">
                <i class="fa-solid fa-check"></i> Reactivar Sede
              </button>
            `
          }
        </div>
      </div>
    `;
    })
    .join('');
}

function renderResumenClinicas(clinicas) {
  const container = document.getElementById('resumen-clinicas-lista');
  if (!container) return;

  if (clinicas.length === 0) {
    container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.88rem;">No hay sedes registradas.</div>`;
    return;
  }

  container.innerHTML = clinicas
    .map((c) => {
      const estaActiva = c.Activa === 1 || c.Activa === true || c.Activa === null;
      return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1rem; border-radius: var(--radius-md); background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); gap: 0.75rem;">
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 700; color: #f8fafc; font-size: 0.92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(c.Nombre)} <span style="font-size: 0.78rem; opacity: 0.7;">(Sede ${c.Clinica_id})</span>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            <i class="fa-solid fa-location-dot"></i> ${escapeHtml(c.Calle_clinica || '')}, ${escapeHtml(c.Municipio_clinica || 'Tecámac')} • Tel: ${escapeHtml(c.Telefono || 'N/A')}
          </div>
        </div>
        <div style="flex-shrink: 0;">
          ${
            estaActiva
              ? '<span class="status-pill active" style="font-size: 0.72rem; padding: 0.25rem 0.65rem;"><i class="fa-solid fa-circle" style="font-size: 0.5rem;"></i> OPERATIVA</span>'
              : '<span class="status-pill baja" style="font-size: 0.72rem; padding: 0.25rem 0.65rem;"><i class="fa-solid fa-circle" style="font-size: 0.5rem;"></i> INACTIVA</span>'
          }
        </div>
      </div>
    `;
    })
    .join('');
}

function poblarSelectClinicasRecepcionistas(clinicas) {
  const select = document.getElementById('recep-clinica');
  if (!select) return;

  const valorActual = select.value;
  select.innerHTML = clinicas
    .map((c) => `<option value="${c.Clinica_id}">${escapeHtml(c.Nombre)} (Sede ${c.Clinica_id})</option>`)
    .join('');

  if (valorActual && clinicas.some((c) => String(c.Clinica_id) === String(valorActual))) {
    select.value = valorActual;
  }
}

function configurarEventosClinicas() {
  const inputBuscar = document.getElementById('filtro-clinicas-buscar');
  const selectEstado = document.getElementById('filtro-clinicas-estado');

  function filtrar() {
    const q = (inputBuscar?.value || '').toLowerCase().trim();
    const estado = selectEstado?.value || 'todos';

    const filtradas = listaClinicasCache.filter((c) => {
      const estaActiva = c.Activa === 1 || c.Activa === true || c.Activa === null;
      const matchText =
        !q ||
        (c.Nombre || '').toLowerCase().includes(q) ||
        (c.Calle_clinica || '').toLowerCase().includes(q) ||
        (c.Municipio_clinica || '').toLowerCase().includes(q) ||
        (c.Telefono || '').includes(q);

      const matchEstado =
        estado === 'todos' ||
        (estado === 'activas' && estaActiva) ||
        (estado === 'baja' && !estaActiva);

      return matchText && matchEstado;
    });

    renderClinicasGrid(filtradas);
  }

  inputBuscar?.addEventListener('input', filtrar);
  selectEstado?.addEventListener('change', filtrar);

  // Formulario de guardar/editar clínica
  const form = document.getElementById('form-clinica');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('clinica-edit-id')?.value;
    const nombre = document.getElementById('clinica-nombre')?.value.trim();
    const calle = document.getElementById('clinica-calle')?.value.trim();
    const municipio = document.getElementById('clinica-municipio')?.value.trim();
    const telefono = document.getElementById('clinica-telefono')?.value.trim();

    if (!nombre) {
      AppAuth.showToast('El nombre de la sede es obligatorio', 'warning');
      return;
    }

    if (id) {
      // Editar sede
      const res = await AppAuth.fetchApi(`/api/admin/clinicas/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          Nombre: nombre,
          Calle_clinica: calle,
          Municipio_clinica: municipio,
          Telefono: telefono
        })
      });

      if (res.ok) {
        AppAuth.showToast('¡Sede clínica actualizada exitosamente!', 'success');
        cerrarModal('modal-clinica');
        await cargarClinicas();
        await cargarMetricas();
      } else {
        AppAuth.showToast(res.data?.error || 'Error al actualizar sede', 'error');
      }
    } else {
      // Alta nueva sede
      const res = await AppAuth.fetchApi('/api/admin/clinicas', {
        method: 'POST',
        body: JSON.stringify({
          Nombre: nombre,
          Calle_clinica: calle,
          Municipio_clinica: municipio,
          Telefono: telefono
        })
      });

      if (res.ok) {
        AppAuth.showToast('¡Sede clínica dada de alta exitosamente!', 'success');
        cerrarModal('modal-clinica');
        await cargarClinicas();
        await cargarMetricas();
      } else {
        AppAuth.showToast(res.data?.error || 'Error al dar de alta sede', 'error');
      }
    }
  });
}

function abrirModalNuevaClinica() {
  clinicaEnEdicion = null;
  const form = document.getElementById('form-clinica');
  if (form) form.reset();
  const idEl = document.getElementById('clinica-edit-id');
  if (idEl) idEl.value = '';

  const munEl = document.getElementById('clinica-municipio');
  if (munEl && !munEl.value) munEl.value = 'Tecámac';

  const tituloEl = document.getElementById('modal-clinica-titulo');
  if (tituloEl) {
    tituloEl.innerHTML = `<i class="fa-solid fa-hospital" style="color: #fbbf24;"></i> Alta de Sede Clínica`;
  }

  abrirModal('modal-clinica');
}

function editarClinica(id) {
  const c = listaClinicasCache.find((x) => Number(x.Clinica_id) === Number(id));
  if (!c) return;

  clinicaEnEdicion = c;
  const tituloEl = document.getElementById('modal-clinica-titulo');
  if (tituloEl) {
    tituloEl.innerHTML = `<i class="fa-solid fa-pen-to-square" style="color: #fbbf24;"></i> Modificar Sede: ${escapeHtml(c.Nombre)}`;
  }

  document.getElementById('clinica-edit-id').value = c.Clinica_id;
  document.getElementById('clinica-nombre').value = c.Nombre || '';
  document.getElementById('clinica-calle').value = c.Calle_clinica || '';
  document.getElementById('clinica-municipio').value = c.Municipio_clinica || 'Tecámac';
  document.getElementById('clinica-telefono').value = c.Telefono || '';

  abrirModal('modal-clinica');
}

function confirmarCambioEstadoClinica(id, estaActivaActualmente) {
  const c = listaClinicasCache.find((x) => Number(x.Clinica_id) === Number(id));
  if (!c) return;

  accionEstadoPendiente = {
    tipo: 'clinica',
    id,
    nuevoEstado: !estaActivaActualmente,
    nombre: c.Nombre
  };

  const tituloEl = document.getElementById('modal-confirm-titulo');
  const mensajeEl = document.getElementById('modal-confirm-mensaje');
  const btnAccion = document.getElementById('btn-confirmar-cambio-accion');
  const motivoInput = document.getElementById('confirm-motivo');
  if (motivoInput) motivoInput.value = '';

  if (estaActivaActualmente) {
    tituloEl.innerHTML = `<i class="fa-solid fa-ban" style="color: #f87171;"></i> Confirmar Baja de Sede Clínica`;
    mensajeEl.innerHTML = `¿Confirmas que deseas dar de <strong>BAJA TEMPORAL</strong> a la sede clínica <strong>${escapeHtml(c.Nombre)}</strong> (Sede #${id})?`;
    btnAccion.className = 'btn btn-danger';
    btnAccion.textContent = 'Dar de Baja Sede Clínica';
  } else {
    tituloEl.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #34d399;"></i> Confirmar Reactivación de Sede Clínica`;
    mensajeEl.innerHTML = `¿Confirmas que deseas <strong>REACTIVAR</strong> la operatividad de la sede clínica <strong>${escapeHtml(c.Nombre)}</strong>?`;
    btnAccion.className = 'btn btn-success';
    btnAccion.textContent = 'Reactivar Sede Clínica';
  }

  abrirModal('modal-confirmar-estado');
}

// =========================================================================
// 4. GESTIÓN Y MODIFICACIÓN DE PACIENTES / CLIENTES
// =========================================================================
async function cargarPacientes(filtroTexto = '', condicion = 'todos') {
  const params = new URLSearchParams();
  if (filtroTexto) params.append('q', filtroTexto);
  if (condicion && condicion !== 'todos') params.append('condicion', condicion);

  const res = await AppAuth.fetchApi(`/api/admin/pacientes?${params.toString()}`);
  if (!res.ok) {
    AppAuth.showToast('No se pudieron consultar los pacientes', 'error');
    return;
  }

  listaPacientesCache = res.data || [];
  renderPacientesTabla(listaPacientesCache);
  poblarSelectPacientesAvisos(listaPacientesCache);
}

function renderPacientesTabla(pacientes) {
  const tbody = document.getElementById('tbody-pacientes-admin');
  if (!tbody) return;

  if (pacientes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          <i class="fa-solid fa-users-slash" style="font-size: 2rem; opacity: 0.4; margin-bottom: 0.5rem;"></i>
          <div>No se encontraron pacientes registrados con los criterios de búsqueda.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pacientes
    .map((p) => {
      const exp = p.No_expediente || p.expediente;
      const tieneDiabetes = p.es_diabetico === 1 || p.es_diabetico === true;
      const tieneHipertension = p.es_hipertenso === 1 || p.es_hipertenso === true;
      const edadTexto = p.edad ? `${p.edad} años` : 'N/D';
      const sexoTexto = p.Sexo === 'F' ? 'Fem' : p.Sexo === 'M' ? 'Masc' : '';
      const ultimaAtencion = p.ultima_cita ? p.ultima_cita.split('T')[0] : 'Sin registro';

      return `
      <tr>
        <td>
          <span style="font-family: monospace; font-weight: 700; color: #38bdf8; background: rgba(56, 189, 248, 0.1); padding: 0.2rem 0.5rem; border-radius: 4px;">
            ${escapeHtml(String(exp))}
          </span>
        </td>
        <td>
          <div style="font-weight: 700; color: #f8fafc;">${escapeHtml(p.nombre_completo || `${p.Nombres} ${p.ape_paterno}`)}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(p.Municipio || 'Tecámac')}</div>
        </td>
        <td>${escapeHtml(edadTexto)} <small style="color: var(--text-muted);">(${escapeHtml(sexoTexto)})</small></td>
        <td>
          <a href="tel:${escapeHtml(p.telefono || '')}" style="color: inherit; text-decoration: none;" title="Llamar">
            <i class="fa-solid fa-phone" style="color: #38bdf8; font-size: 0.8rem;"></i> ${escapeHtml(p.telefono || 'Sin tel')}
          </a>
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
            ${tieneDiabetes ? '<span class="risk-tag diabetes"><i class="fa-solid fa-droplet"></i> Diabetes</span>' : ''}
            ${tieneHipertension ? '<span class="risk-tag hipertension"><i class="fa-solid fa-heart-pulse"></i> Hipertensión</span>' : ''}
            ${!tieneDiabetes && !tieneHipertension ? '<span class="risk-tag healthy">Control Normal</span>' : ''}
          </div>
        </td>
        <td><small style="color: var(--text-muted);">${escapeHtml(ultimaAtencion)}</small></td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 0.45rem;">
            <button class="btn btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.82rem;" title="Modificar datos del paciente" onclick="abrirModalEditarPaciente('${escapeHtml(String(exp))}')">
              <i class="fa-solid fa-pen-to-square"></i> Modificar
            </button>
            <button class="btn btn-primary" style="padding: 0.35rem 0.65rem; font-size: 0.82rem; background: #059669;" title="Mandar aviso por WhatsApp" onclick="prepararAvisoParaPaciente('${escapeHtml(String(exp))}')">
              <i class="fa-brands fa-whatsapp"></i> Avisar
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join('');
}

function configurarEventosPacientes() {
  const inputBuscar = document.getElementById('filtro-pacientes-buscar');
  const selectCondicion = document.getElementById('filtro-pacientes-condicion');

  let debounceTimer = null;
  inputBuscar?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      cargarPacientes(inputBuscar.value.trim(), selectCondicion.value);
    }, 250);
  });

  selectCondicion?.addEventListener('change', () => {
    cargarPacientes(inputBuscar.value.trim(), selectCondicion.value);
  });

  // Guardar cambios en paciente
  const formEditar = document.getElementById('form-editar-paciente');
  formEditar?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pacienteEnEdicion) return;

    const exp = pacienteEnEdicion.No_expediente || pacienteEnEdicion.expediente;
    const body = {
      Nombres: document.getElementById('pac-edit-nombres').value.trim(),
      ape_paterno: document.getElementById('pac-edit-paterno').value.trim(),
      ape_materno: document.getElementById('pac-edit-materno').value.trim(),
      telefono: document.getElementById('pac-edit-telefono').value.trim(),
      Calle_direccion: document.getElementById('pac-edit-direccion').value.trim(),
      Municipio: document.getElementById('pac-edit-municipio').value.trim(),
      Calzado: document.getElementById('pac-edit-calzado').value,
      es_diabetico: document.getElementById('pac-edit-diabetico').checked,
      es_hipertenso: document.getElementById('pac-edit-hipertenso').checked,
      Antecedentes_patologicos: document.getElementById('pac-edit-antecedentes').value.trim(),
      Notas: document.getElementById('pac-edit-notas').value.trim()
    };

    const res = await AppAuth.fetchApi(`/api/admin/pacientes/${exp}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });

    if (res.ok) {
      AppAuth.showToast(`¡Expediente #${exp} modificado correctamente!`, 'success');
      cerrarModal('modal-editar-paciente');
      await cargarPacientes(inputBuscar.value.trim(), selectCondicion.value);
      await cargarMetricas();
    } else {
      AppAuth.showToast('Error al modificar paciente', 'error');
    }
  });
}

function abrirModalEditarPaciente(expediente) {
  const p = listaPacientesCache.find((x) => String(x.No_expediente || x.expediente) === String(expediente));
  if (!p) return;

  pacienteEnEdicion = p;

  document.getElementById('pac-edit-exp').value = expediente;
  document.getElementById('pac-edit-nombres').value = p.Nombres || '';
  document.getElementById('pac-edit-paterno').value = p.ape_paterno || '';
  document.getElementById('pac-edit-materno').value = p.ape_materno || '';
  document.getElementById('pac-edit-telefono').value = p.telefono || '';
  document.getElementById('pac-edit-direccion').value = p.Calle_direccion || '';
  document.getElementById('pac-edit-municipio').value = p.Municipio || 'Tecámac';
  document.getElementById('pac-edit-calzado').value = p.Calzado || '';
  document.getElementById('pac-edit-diabetico').checked = p.es_diabetico === 1 || p.es_diabetico === true;
  document.getElementById('pac-edit-hipertenso').checked = p.es_hipertenso === 1 || p.es_hipertenso === true;
  document.getElementById('pac-edit-antecedentes').value = p.Antecedentes_patologicos || '';
  document.getElementById('pac-edit-notas').value = p.Notas || p.notas_alergias || '';

  abrirModal('modal-editar-paciente');
}

// =========================================================================
// 5. CENTRO DE AVISOS Y COMUNICACIONES CON CLIENTES / PACIENTES
// =========================================================================
function poblarSelectPacientesAvisos(pacientes) {
  const select = document.getElementById('aviso-select-paciente');
  if (!select) return;

  const actual = select.value;
  select.innerHTML = '<option value="">-- Elige un paciente de la lista --</option>';

  pacientes.forEach((p) => {
    const exp = p.No_expediente || p.expediente;
    const opt = document.createElement('option');
    opt.value = exp;
    opt.textContent = `#${exp} - ${p.nombre_completo || `${p.Nombres} ${p.ape_paterno}`} (${p.telefono || 'Sin tel'})`;
    opt.dataset.nombre = p.nombre_completo || `${p.Nombres} ${p.ape_paterno}`;
    opt.dataset.telefono = p.telefono || '';
    opt.dataset.diabetico = p.es_diabetico ? '1' : '0';
    select.appendChild(opt);
  });

  if (actual) select.value = actual;
}

function prepararAvisoParaPaciente(expediente) {
  navegarAPestana('tab-avisos');
  const select = document.getElementById('aviso-select-paciente');
  if (select) {
    select.value = expediente;
    select.dispatchEvent(new Event('change'));
  }
}

async function cargarHistorialAvisos() {
  const res = await AppAuth.fetchApi('/api/admin/avisos');
  if (!res.ok) return;

  listaAvisosCache = res.data || [];
  renderHistorialAvisos(listaAvisosCache);
}

function renderHistorialAvisos(avisos) {
  const container = document.getElementById('contenedor-historial-avisos');
  if (!container) return;

  if (avisos.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
        <i class="fa-solid fa-inbox" style="font-size: 2rem; opacity: 0.4; margin-bottom: 0.5rem;"></i>
        <div>Aún no se han enviado avisos a pacientes.</div>
      </div>
    `;
    return;
  }

  const canalIconos = {
    whatsapp: 'fa-brands fa-whatsapp text-success',
    sms: 'fa-solid fa-comment-sms text-info',
    sistema: 'fa-solid fa-clipboard-check text-purple'
  };

  container.innerHTML = avisos
    .map(
      (a) => `
      <div class="notice-history-item">
        <div class="notice-meta-line">
          <div>
            <i class="${canalIconos[a.canal] || 'fa-solid fa-envelope'}" style="margin-right: 0.4rem; color: #25d366;"></i>
            <strong>${escapeHtml(a.paciente_nombre)}</strong> (Exp. #${a.no_expediente})
          </div>
          <span>${escapeHtml(a.fecha_envio || '')}</span>
        </div>
        <div style="font-size: 0.8rem; color: #38bdf8; font-weight: 600; margin-bottom: 0.35rem;">
          ${escapeHtml(a.asunto || 'Aviso Clínico')} • <small style="color: var(--text-muted);">${escapeHtml(a.tipo_label || '')}</small>
        </div>
        <div class="notice-text-content">${escapeHtml(a.mensaje)}</div>
        <div style="margin-top: 0.65rem; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.75rem; color: var(--text-muted);">Tel: ${escapeHtml(a.telefono || '')}</span>
          ${
            a.enlace_whatsapp
              ? `
            <a href="${a.enlace_whatsapp}" target="_blank" class="btn btn-secondary" style="padding: 0.25rem 0.55rem; font-size: 0.75rem; color: #25d366;" title="Reenviar o abrir chat">
              <i class="fa-brands fa-whatsapp"></i> Chat WhatsApp
            </a>
          `
              : ''
          }
        </div>
      </div>
    `
    )
    .join('');
}

function configurarEventosAvisos() {
  const selectPaciente = document.getElementById('aviso-select-paciente');
  const inputTelefono = document.getElementById('aviso-telefono');
  const inputAsunto = document.getElementById('aviso-asunto');
  const textareaMensaje = document.getElementById('aviso-mensaje');
  const previewTelefono = document.getElementById('preview-destino-telefono');
  const previewMensaje = document.getElementById('preview-mensaje-render');
  const btnAbrirWhatsapp = document.getElementById('btn-abrir-whatsapp');
  const templateChips = document.querySelectorAll('.template-chip');

  // Al seleccionar paciente
  selectPaciente?.addEventListener('change', () => {
    const selected = selectPaciente.selectedOptions[0];
    if (selected && selected.value) {
      const tel = selected.dataset.telefono || '';
      const nombre = selected.dataset.nombre || 'Paciente';
      inputTelefono.value = tel;
      previewTelefono.textContent = `${nombre} • Tel: ${tel || 'Sin teléfono'}`;
      actualizarPreviewWhatsApp();
    } else {
      inputTelefono.value = '';
      previewTelefono.textContent = 'Sin destinatario';
      actualizarPreviewWhatsApp();
    }
  });

  inputTelefono?.addEventListener('input', actualizarPreviewWhatsApp);

  // Plantillas rápidas
  const plantillas = {
    recordatorio: (nombre) => ({
      asunto: 'Recordatorio de Consulta Podológica',
      mensaje: `Estimado(a) ${nombre}, le recordamos su próxima cita de atención podológica clínica en Elite Foot Care. Por favor recuerde llegar 5 minutos antes. ¡Cuidamos la salud de cada paso!`
    }),
    diabetico: (nombre) => ({
      asunto: 'Cuidado Preventivo de Pie Diabético',
      mensaje: `Hola ${nombre}, por su bienestar y de acuerdo con el protocolo médico para pacientes con Diabetes, le sugerimos agendar su revisión trimestral preventiva de corte clínico e inspección de sensibilidad.`
    }),
    seguimiento: (nombre) => ({
      asunto: 'Seguimiento Terapéutico Podológico',
      mensaje: `Estimado(a) ${nombre}, nos comunicamos desde la clínica Elite Foot Care para saber cómo continúa tras su último tratamiento podológico. Quedamos a su disposición si nota alguna molestia.`
    }),
    promocion: (nombre) => ({
      asunto: 'Campaña de Salud y Quiropodia Integral',
      mensaje: `Aviso especial para ${nombre}: En Elite Foot Care contamos con jornadas de valoración de pisada y profilaxis podológica. Escríbanos para reservar su horario preferente.`
    })
  };

  templateChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      templateChips.forEach((c) => c.classList.remove('selected'));
      chip.classList.add('selected');

      const tipo = chip.dataset.template;
      const selected = selectPaciente.selectedOptions[0];
      const nombre = selected && selected.value ? selected.dataset.nombre : 'Paciente';

      const generador = plantillas[tipo];
      if (generador) {
        const { asunto, mensaje } = generador(nombre);
        inputAsunto.value = asunto;
        textareaMensaje.value = mensaje;
        actualizarPreviewWhatsApp();
      }
    });
  });

  textareaMensaje?.addEventListener('input', actualizarPreviewWhatsApp);

  function actualizarPreviewWhatsApp() {
    const msg = textareaMensaje?.value.trim() || 'El mensaje que redactes se visualizará aquí en tiempo real antes de ser enviado.';
    const tel = inputTelefono?.value.replace(/\D/g, '') || '';

    if (previewMensaje) previewMensaje.textContent = msg;

    if (tel.length >= 10 && textareaMensaje?.value.trim()) {
      const telMex = tel.length === 10 ? `52${tel}` : tel;
      const url = `https://api.whatsapp.com/send?phone=${telMex}&text=${encodeURIComponent(textareaMensaje.value.trim())}`;
      btnAbrirWhatsapp.href = url;
      btnAbrirWhatsapp.style.display = 'inline-flex';
    } else {
      btnAbrirWhatsapp.style.display = 'none';
    }
  }

  // Formulario de envío
  const form = document.getElementById('form-enviar-aviso');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const exp = selectPaciente.value;
    const selected = selectPaciente.selectedOptions[0];
    const nombre = selected?.dataset.nombre || 'Paciente';
    const tel = inputTelefono.value.trim();
    const canal = document.querySelector('input[name="aviso-canal"]:checked')?.value || 'whatsapp';
    const asunto = inputAsunto.value.trim();
    const mensaje = textareaMensaje.value.trim();

    if (!exp) {
      AppAuth.showToast('Por favor selecciona un paciente destinatario', 'warning');
      return;
    }

    const res = await AppAuth.fetchApi('/api/admin/avisos', {
      method: 'POST',
      body: JSON.stringify({
        no_expediente: exp,
        paciente_nombre: nombre,
        telefono: tel,
        canal,
        asunto,
        mensaje
      })
    });

    if (res.ok) {
      AppAuth.showToast('¡Aviso registrado con éxito!', 'success');
      await cargarHistorialAvisos();
      await cargarMetricas();

      // Si es WhatsApp, dar feedback para abrirlo
      if (canal === 'whatsapp' && res.data?.aviso?.enlace_whatsapp) {
        window.open(res.data.aviso.enlace_whatsapp, '_blank');
      }
    } else {
      AppAuth.showToast('Error al registrar aviso', 'error');
    }
  });
}

// =========================================================================
// UTILIDADES DE MODALES Y SEGURIDAD
// =========================================================================
function abrirModal(id) {
  const modal = document.getElementById(id);
  if (modal && typeof modal.showModal === 'function') {
    modal.showModal();
  }
}

function cerrarModal(id) {
  const modal = document.getElementById(id);
  if (modal && typeof modal.close === 'function') {
    modal.close();
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Exponer funciones globales requeridas para inline listeners
window.abrirModalNuevoPodologo = abrirModalNuevoPodologo;
window.editarPodologo = editarPodologo;
window.confirmarCambioEstadoPodologo = confirmarCambioEstadoPodologo;
window.abrirModalNuevaRecepcionista = abrirModalNuevaRecepcionista;
window.editarRecepcionista = editarRecepcionista;
window.confirmarCambioEstadoRecepcionista = confirmarCambioEstadoRecepcionista;
window.abrirModalNuevaClinica = abrirModalNuevaClinica;
window.editarClinica = editarClinica;
window.confirmarCambioEstadoClinica = confirmarCambioEstadoClinica;
window.abrirModalEditarPaciente = abrirModalEditarPaciente;
window.prepararAvisoParaPaciente = prepararAvisoParaPaciente;
window.navegarAPestana = navegarAPestana;
window.cerrarModal = cerrarModal;
