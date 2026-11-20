/**
 * LÓGICA DE VANILLA JS: CONSULTORIO PODOLÓGICO (ROL ID: 4)
 * Elite Foot Care - Agenda Personal, Expediente Clínico y Mapa Podológico Interactivo
 */
if (typeof window.escapeHtml !== 'function') {
  window.escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Guardián de Acceso RBAC: Podólogo (Rol ID: 4) o Administrador (Rol ID: 1)
  let currentUser = AppAuth.getCurrentUser();
  const urlParams = new URLSearchParams(window.location.search);
  if (!currentUser) {
    if (urlParams.get('demo') === 'true') {
      currentUser = await AppAuth.autoLoginDemo(4);
    } else {
      window.location.href = 'login.html';
      return;
    }
  } else {
    const rol = Number(currentUser.fk_rol_id || currentUser.rolId || 0);
    const nombreRol = String(currentUser.nombre_rol || currentUser.rol || '').toLowerCase();
    const esPodoOAdmin = rol === 4 || rol === 400 || rol === 1 || rol === 100 || nombreRol.includes('pod') || nombreRol.includes('especialista') || nombreRol.includes('admin');
    if (!esPodoOAdmin) {
      AppAuth.showToast('Acceso exclusivo para Podólogos. Redirigiendo a tu módulo...', 'warning');
      setTimeout(() => {
        AppAuth.redirectByRole(currentUser);
      }, 1000);
      return;
    }
  }

  actualizarUIPodologo(currentUser);

  // Refrescar perfil completo y actualizado desde el backend
  try {
    const perfilRes = await AppAuth.fetchApi('/api/auth/me');
    if (perfilRes.ok && perfilRes.data?.usuario) {
      currentUser = { ...currentUser, ...perfilRes.data.usuario };
      AppAuth.saveSession(currentUser);
    }
  } catch (e) {
    console.warn('No se pudo refrescar perfil desde /api/auth/me:', e);
  }

  actualizarUIPodologo(currentUser);

  // 2. Control de Pestañas Material 3
  inicializarNavegacionTabs();

  // 3. Cargar Agenda Personal y Pacientes Asignados
  await cargarAgendaPersonal();

  // 4. Configurar Eventos
  configurarEventosAgendaPersonal();
  configurarEventosExpediente();
  configurarMapaPodologicoInteractivo();
  configurarPruebasSeguridadRBAC();
});

// Variables de Estado en Memoria
let consultaActiva = null;
let pacienteActivo = null;
let misCitasCache = [];
let consultasPacienteCache = [];
let diagnosticosPacienteCache = [];
let tratamientosPacienteCache = [];
let recetasPacienteCache = [];
let recetasConsultaCache = [];
let mapaHallazgosPacienteCache = [];
let hallazgosMapaCache = [];
let vistaPieActual = 'plantar'; // 'plantar' | 'dorsal'
let zonaSeleccionadaActual = null;
let zonasSeleccionadasMapa = [];
let rangoFechaAgendaActual = 'todas';

/**
 * Determina el prefijo respetuoso (Dra. o Dr.) según el nombre
 */
function obtenerTituloProfesional(nombre) {
  const n = String(nombre || '').trim().toLowerCase();
  const primerNombre = n.split(' ')[0];
  const nombresFemeninos = ['kiara', 'maribel', 'jacqueline', 'camila', 'maria', 'maría', 'rosa', 'ana', 'patricia', 'laura', 'sofia', 'sofía', 'elena', 'carmen', 'lucia', 'lucía', 'paola', 'andrea', 'fernanda', 'daniela', 'valeria'];
  if (nombresFemeninos.includes(primerNombre) || primerNombre.endsWith('a')) {
    return 'Dra.';
  }
  return 'Dr.';
}

/**
 * Actualiza el chip de perfil del médico y el saludo personalizado dinámico
 */
function actualizarUIPodologo(user) {
  if (!user) return;
  const nameEl = document.getElementById('podo-display-name');
  const roleEl = document.getElementById('podo-role-text');
  const cedulaIndicador = document.getElementById('cedula-sesion-indicador');
  const avatarEl = document.getElementById('podo-avatar-initials');
  const greetingTitle = document.getElementById('podo-greeting-title');
  const greetingSub = document.getElementById('podo-greeting-subtitle');

  const nombre = user.nombre || user.Nombre || user.perfil?.Nombre || '';
  const ape = user.ape_paterno || user.perfil?.ape_paterno || '';
  const cedula = user.cedula || user.Cedula_podologo || user.perfil?.Cedula_podologo || '';
  const titulo = user.titulo || obtenerTituloProfesional(nombre || user.nombre_completo || '');

  const nombreDisplay = nombre
    ? `${titulo} ${nombre} ${ape}`.trim()
    : (user.nombre_completo || 'Especialista en Podología');
  const nombreCorto = nombre
    ? `${titulo} ${nombre}`.trim()
    : (user.nombre_completo || 'Especialista');

  if (nameEl) nameEl.textContent = nombreDisplay;
  if (roleEl) roleEl.textContent = cedula ? `Cédula: ${cedula} · Rol ID: 4` : 'Consultorio Podológico';
  if (cedulaIndicador) cedulaIndicador.textContent = cedula || 'Activa en Sistema';

  // Iniciales para el avatar
  const inicial1 = (nombre[0] || 'D').toUpperCase();
  const inicial2 = (ape[0] || (nombre[1] || 'P')).toUpperCase();
  if (avatarEl) avatarEl.textContent = `${inicial1}${inicial2}`;

  // Saludo dinámico personalizado en la agenda
  if (greetingTitle) {
    greetingTitle.textContent = `¡Hola, ${nombreCorto}! 👋`;
  }
  if (greetingSub) {
    greetingSub.textContent = `Agenda personal de consultas asignadas a tu cédula profesional (${cedula || 'Registrada'}), control de turnos e inicio de atención clínica.`;
  }
}

/**
 * Manejo de pestañas Material 3 con auto-apertura de expedientes
 */
function inicializarNavegacionTabs() {
  const tabBtns = document.querySelectorAll('.nav-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetId = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');

      // Si se abre Expediente y no hay paciente activo, mostrar aviso y ocultar formulario
      if (targetId === 'tab-expediente' && !pacienteActivo) {
        const citaEnAtencion = misCitasCache.find((c) => c.estado === 'En atención');
        if (citaEnAtencion) {
          consultaActiva = citaEnAtencion;
          await cargarExpedientePaciente(citaEnAtencion.fk_no_expediente);
        } else {
          const alerta = document.getElementById('sin-paciente-alerta');
          if (alerta) alerta.style.setProperty('display', 'flex', 'important');
          const contenedor = document.getElementById('contenedor-expediente-completo');
          if (contenedor) contenedor.style.display = 'none';
        }
      }

      // Si se abre Mapa Podológico, sincronizar indicador, hallazgos e historial de mapas
      if (targetId === 'tab-mapa-podologico') {
        const citaEnAtencion = consultaActiva || misCitasCache.find((c) => c.estado === 'En atención');
        if (citaEnAtencion) {
          consultaActiva = citaEnAtencion;
          const exp = pacienteActivo?.No_expediente || citaEnAtencion.fk_no_expediente;
          if (!pacienteActivo || String(pacienteActivo.No_expediente) !== String(exp)) {
            await cargarExpedientePaciente(exp);
          }
          actualizarIndicadorMapa(consultaActiva, pacienteActivo);
          await cargarMapaConsulta(consultaActiva.Consulta_id);
          await cargarHistorialMapasPaciente(exp);
        } else {
          renderHistorialMapasAnteriores();
        }
      }
    });
  });
}

function cambiarPestana(tabId) {
  const btn = document.querySelector(`.nav-tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * =========================================================================
 * 1. AGENDA PERSONAL (SOLO SUS CONSULTAS ASIGNADAS)
 * =========================================================================
 */
function obtenerFechaLocalOffset(dias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function filtrarAgendaPorRango(rango, btn) {
  rangoFechaAgendaActual = rango || 'todas';
  const inputFecha = document.getElementById('podo-filtro-fecha');

  document.querySelectorAll('.podo-rango-btn').forEach((b) => {
    b.classList.remove('active', 'btn-primary');
    if (b.dataset.rango === rangoFechaAgendaActual) {
      b.classList.add('active', 'btn-primary');
    }
  });

  if (inputFecha) {
    if (rangoFechaAgendaActual === 'hoy') {
      inputFecha.value = obtenerFechaLocalOffset(0);
    } else if (rangoFechaAgendaActual === 'manana') {
      inputFecha.value = obtenerFechaLocalOffset(1);
    } else {
      inputFecha.value = '';
    }
  }

  cargarAgendaPersonal();
}
window.filtrarAgendaPorRango = filtrarAgendaPorRango;

async function cargarAgendaPersonal() {
  const tbody = document.getElementById('tabla-agenda-personal-body');
  if (!tbody) return;

  const fecha = document.getElementById('podo-filtro-fecha')?.value || '';
  const estado = document.getElementById('podo-filtro-estado')?.value || '';

  const params = new URLSearchParams();
  if (fecha) {
    params.append('fecha', fecha);
  } else if (rangoFechaAgendaActual && rangoFechaAgendaActual !== 'todas') {
    params.append('rango', rangoFechaAgendaActual);
  }
  if (estado) params.append('estado', estado);

  const res = await AppAuth.fetchApi(`/api/medico/agenda?${params.toString()}`);

  if (res.ok && Array.isArray(res.data)) {
    misCitasCache = res.data;
    renderTablaAgendaPersonal(res.data);
    actualizarKPIsAgendaPersonal(res.data);
    poblarSelectoresPacientes(res.data);

    const citaEnAtencion = res.data.find((c) => c.estado === 'En atención');
    if (citaEnAtencion) {
      if (!consultaActiva || consultaActiva.Consulta_id !== citaEnAtencion.Consulta_id || !pacienteActivo) {
        consultaActiva = citaEnAtencion;
        await cargarExpedientePaciente(citaEnAtencion.fk_no_expediente);
      } else {
        consultaActiva.estado = 'En atención';
        actualizarHUDPaciente(pacienteActivo, consultaActiva);
      }
    } else if (!consultaActiva || consultaActiva.estado !== 'En atención') {
      consultaActiva = null;
      actualizarHUDPaciente(null, null);
    }

    const resumenEl = document.getElementById('podo-resumen-filtro');
    if (resumenEl) {
      const total = res.data.length;
      if (fecha) {
        resumenEl.textContent = `${total} paciente${total === 1 ? '' : 's'} agendado${total === 1 ? '' : 's'} para el ${fecha}`;
      } else if (rangoFechaAgendaActual === 'proximas') {
        resumenEl.textContent = `${total} cita${total === 1 ? '' : 's'} próxima${total === 1 ? '' : 's'}`;
      } else {
        resumenEl.textContent = `${total} cita${total === 1 ? '' : 's'} encontrada${total === 1 ? '' : 's'}`;
      }
    }
  } else {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--color-danger); padding: 1.5rem;">Error al cargar la agenda personal del podólogo</td></tr>`;
  }
}

function poblarSelectoresPacientes(citas) {
  const selectExp = document.getElementById('select-paciente-agenda-expediente');
  const selectMap = document.getElementById('select-paciente-agenda-mapa');

  const hoyStr = obtenerFechaLocalOffset(0);
  const estadosActivos = ['Pendiente', 'Confirmada', 'Programada', 'En espera', 'En atención'];
  const citasFiltradas = (citas || []).filter((c) => {
    const esActivaHoy = estadosActivos.includes(c.estado) && String(c.fecha_hora || '').startsWith(hoyStr);
    const esConsultaActual = consultaActiva && String(c.Consulta_id) === String(consultaActiva.Consulta_id);
    return esActivaHoy || esConsultaActual;
  });

  const formatearHora = (fechaHora) => {
    if (!fechaHora) return '';
    const d = new Date(fechaHora);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  if (selectExp) {
    const prevVal = selectExp.value;
    selectExp.innerHTML = '<option value="">-- Citas activas de hoy --</option>' +
      citasFiltradas.map(c => {
        const hora = formatearHora(c.fecha_hora);
        return `
          <option value="${escapeHtml(c.fk_no_expediente)}" data-consulta="${escapeHtml(c.Consulta_id)}">
            ${hora ? `${escapeHtml(hora)} · ` : ''}${escapeHtml(c.paciente_nombre)} (${escapeHtml(c.estado)})
          </option>
        `;
      }).join('');
    if (prevVal && citasFiltradas.some(c => String(c.fk_no_expediente) === String(prevVal))) {
      selectExp.value = prevVal;
    }
  }

  if (selectMap) {
    const prevVal = selectMap.value;
    selectMap.innerHTML = '<option value="">-- Citas activas de hoy --</option>' +
      citasFiltradas.map(c => {
        const hora = formatearHora(c.fecha_hora);
        return `
          <option value="${escapeHtml(c.Consulta_id)}" data-exp="${escapeHtml(c.fk_no_expediente)}">
            ${hora ? `${escapeHtml(hora)} · ` : ''}${escapeHtml(c.paciente_nombre)} (${escapeHtml(c.estado)})
          </option>
        `;
      }).join('');
    if (prevVal && citasFiltradas.some(c => String(c.Consulta_id) === String(prevVal))) {
      selectMap.value = prevVal;
    }
  }
}

function actualizarIndicadorMapa(cita, paciente = null) {
  const ind = document.getElementById('mapa-paciente-indicador');
  if (!ind) return;
  if (!cita) {
    ind.textContent = 'Ningún paciente en atención';
    return;
  }
  const nombre = cita.paciente_nombre || paciente?.nombre_completo || (paciente ? `${paciente.Nombres} ${paciente.ape_paterno}`.trim() : 'Paciente');
  const exp = cita.fk_no_expediente || paciente?.No_expediente || '—';
  ind.innerHTML = `Paciente activo: <strong>${escapeHtml(nombre)}</strong> (Exp: #${escapeHtml(exp)} · Consulta: <code>${escapeHtml(cita.Consulta_id)}</code>)`;
}

function renderTablaAgendaPersonal(citas) {
  const tbody = document.getElementById('tabla-agenda-personal-body');
  if (!tbody) return;

  if (citas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">No tienes consultas asignadas con los filtros actuales.</td></tr>`;
    return;
  }

  tbody.innerHTML = citas.map(c => {
    const fechaObj = new Date(c.fecha_hora);
    const fechaFormat = isNaN(fechaObj) ? escapeHtml(c.fecha_hora) : fechaObj.toLocaleString('es-MX', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const estadoBadgeClass = {
      'Pendiente': 'badge-espera',
      'Confirmada': 'badge-programada',
      'Programada': 'badge-programada',
      'En espera': 'badge-atencion',
      'En atención': 'badge-atencion',
      'Finalizada': 'badge-finalizada',
      'Completada': 'badge-finalizada',
      'Cancelada': 'badge-cancelada'
    }[c.estado] || 'badge-programada';

    const badgesRiesgo = [];
    if (c.es_diabetico) {
      badgesRiesgo.push('<span class="badge-risk diabetic" title="Riesgo de pie diabético"><i class="fa-solid fa-triangle-exclamation"></i> Diabético</span>');
    }
    if (c.es_hipertenso) {
      badgesRiesgo.push('<span class="badge-risk hypertensive"><i class="fa-solid fa-heart-pulse"></i> Hipertenso</span>');
    }

    const safeConsultaId = encodeURIComponent(String(c.Consulta_id));
    const estaCerrada = ['Finalizada', 'Completada', 'Cancelada'].includes(c.estado);
    const estaEnAtencion = c.estado === 'En atención';
    const otraEnAtencion = citas.some(x => x.estado === 'En atención' && x.Consulta_id !== c.Consulta_id)
      || (consultaActiva?.estado === 'En atención' && consultaActiva.Consulta_id !== c.Consulta_id);

    let botonAccionHtml = '';
    if (estaCerrada) {
      const iconoCerrada = c.estado === 'Cancelada' ? 'fa-ban' : 'fa-check-double';
      botonAccionHtml = `
        <button type="button" class="btn-atender-deshabilitado" disabled title="Esta consulta está ${escapeHtml(c.estado)} y no puede reactivarse">
          <i class="fa-solid ${iconoCerrada}"></i>
          <span>Atender Paciente</span>
        </button>
      `;
    } else if (estaEnAtencion) {
      botonAccionHtml = `
        <button type="button" class="btn-atender-en-curso" onclick="iniciarAtencionConsulta('${safeConsultaId}')" title="Abrir expediente de la consulta en curso">
          <i class="fa-solid fa-stethoscope"></i>
          <span>En Consulta</span>
        </button>
      `;
    } else if (otraEnAtencion) {
      botonAccionHtml = `
        <button type="button" class="btn-atender-deshabilitado" disabled title="Finaliza la consulta actual antes de atender a otro paciente">
          <i class="fa-solid fa-lock"></i>
          <span>Atender Paciente</span>
        </button>
      `;
    } else {
      botonAccionHtml = `
        <button type="button" class="btn-atender-activo" onclick="iniciarAtencionConsulta('${safeConsultaId}')">
          <i class="fa-solid fa-notes-medical"></i>
          <span>Atender Paciente</span>
        </button>
      `;
    }

    return `
      <tr>
        <td><strong>${fechaFormat}</strong></td>
        <td><code>${escapeHtml(c.Consulta_id)}</code></td>
        <td>
          <div style="font-weight: 700; color: var(--text-primary, #1e293b);">${escapeHtml(c.paciente_nombre)}</div>
          <small style="color: var(--text-secondary);">Expediente: #${escapeHtml(c.fk_no_expediente)}</small>
        </td>
        <td>
          <span>${c.paciente_edad ? `${escapeHtml(c.paciente_edad)} años` : '—'}</span>
          <small style="color: var(--text-muted);">(${escapeHtml(c.Sexo || 'N/A')})</small>
        </td>
        <td>${badgesRiesgo.length > 0 ? badgesRiesgo.join(' ') : '<span style="color:var(--text-muted);font-size:0.8rem;">Sin riesgos</span>'}</td>
        <td style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(c.motivo_o_notas || '')}">
          ${escapeHtml(c.motivo_o_notas || '—')}
        </td>
        <td><span class="status-badge ${estadoBadgeClass}">${escapeHtml(c.estado)}</span></td>
        <td>${botonAccionHtml}</td>
      </tr>
    `;
  }).join('');
}

function actualizarKPIsAgendaPersonal(citas) {
  const kpiTotal = document.getElementById('kpi-mis-citas-total');
  const kpiEspera = document.getElementById('kpi-mis-citas-espera');
  const kpiAtencion = document.getElementById('kpi-mis-citas-atencion');
  const kpiAtencionSub = document.getElementById('kpi-mis-citas-atencion-sub');
  const kpiFin = document.getElementById('kpi-mis-citas-finalizadas');

  const citaEnAtencion = citas.find(c => c.estado === 'En atención') || (consultaActiva?.estado === 'En atención' ? consultaActiva : null);

  if (kpiTotal) kpiTotal.textContent = citas.length;
  if (kpiEspera) kpiEspera.textContent = citas.filter(c => ['Pendiente', 'Confirmada', 'Programada', 'En espera'].includes(c.estado)).length;
  if (kpiAtencion) kpiAtencion.textContent = citaEnAtencion ? 'Sí' : 'No';
  if (kpiAtencionSub) {
    kpiAtencionSub.textContent = citaEnAtencion
      ? `Atendiendo a ${citaEnAtencion.paciente_nombre || pacienteActivo?.nombre_completo || 'paciente'}`
      : 'Sin consulta en curso';
  }
  if (kpiFin) kpiFin.textContent = citas.filter(c => c.estado === 'Finalizada' || c.estado === 'Completada').length;
}

function configurarEventosAgendaPersonal() {
  document.getElementById('podo-filtro-fecha')?.addEventListener('change', () => {
    rangoFechaAgendaActual = 'personalizada';
    document.querySelectorAll('.podo-rango-btn').forEach((b) => b.classList.remove('active', 'btn-primary'));
    cargarAgendaPersonal();
  });
  document.getElementById('podo-filtro-estado')?.addEventListener('change', cargarAgendaPersonal);
  document.getElementById('btn-recargar-agenda-podo')?.addEventListener('click', cargarAgendaPersonal);

  document.getElementById('btn-finalizar-consulta-activa')?.addEventListener('click', async () => {
    if (!consultaActiva) return;
    if (!confirm(`¿Deseas marcar como Finalizada la consulta ${consultaActiva.Consulta_id}?`)) return;

    const res = await AppAuth.fetchApi(`/api/medico/consultas/${consultaActiva.Consulta_id}/estado`, {
      method: 'PUT',
      body: JSON.stringify({ estado: 'Finalizada' })
    });

    if (res.ok) {
      AppAuth.showToast('¡Consulta finalizada con éxito!', 'success');
      limpiarExpedienteActivo();
      await cargarAgendaPersonal();
    }
  });
}

function limpiarExpedienteActivo() {
  consultaActiva = null;
  pacienteActivo = null;
  consultasPacienteCache = [];
  diagnosticosPacienteCache = [];
  tratamientosPacienteCache = [];
  recetasPacienteCache = [];
  recetasConsultaCache = [];
  mapaHallazgosPacienteCache = [];
  hallazgosMapaCache = [];

  actualizarHUDPaciente(null, null);

  const alerta = document.getElementById('sin-paciente-alerta');
  if (alerta) alerta.style.setProperty('display', 'flex', 'important');

  const contenedor = document.getElementById('contenedor-expediente-completo');
  if (contenedor) contenedor.style.display = 'none';

  // Limpiar campos de somatometría y antecedentes
  ['exp-peso', 'exp-altura', 'exp-tipo-pisada', 'exp-alineacion', 'exp-observaciones', 'ant-calzado', 'ant-patologicos', 'ant-notas', 'receta-indicaciones', 'input-buscar-expediente'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['ant-diabetico', 'ant-hipertenso'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });

  // Limpiar tablas y selectores
  const tbodyDiag = document.getElementById('tabla-diagnosticos-body');
  if (tbodyDiag) tbodyDiag.innerHTML = '';
  const tbodyTrat = document.getElementById('tabla-tratamientos-body');
  if (tbodyTrat) tbodyTrat.innerHTML = '';
  const listaRecetas = document.getElementById('lista-recetas-emitidas');
  if (listaRecetas) listaRecetas.innerHTML = '';

  const selectExp = document.getElementById('select-paciente-agenda-expediente');
  if (selectExp) selectExp.value = '';
  const selectMap = document.getElementById('select-paciente-agenda-mapa');
  if (selectMap) selectMap.value = '';

  const indMapa = document.getElementById('mapa-paciente-indicador');
  if (indMapa) indMapa.textContent = 'Ningún paciente en atención';

  const listaHistMapas = document.getElementById('lista-historial-mapas');
  if (listaHistMapas) {
    listaHistMapas.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--color-stone); padding: 1.25rem; font-size: 0.88rem;">
        Selecciona o atiende un paciente para consultar sus mapas anteriores.
      </div>
    `;
  }

  inicializarFormularioRecetaDinamica();
}

/**
 * Atender Paciente: Carga la consulta y paciente en turnos
 */
function obtenerConsultaEnAtencion() {
  if (consultaActiva?.estado === 'En atención') return consultaActiva;
  return (misCitasCache || []).find(c => c.estado === 'En atención') || null;
}

window.iniciarAtencionConsulta = async (consultaId) => {
  const cita = misCitasCache.find(c => c.Consulta_id === consultaId);
  if (!cita) return;

  if (['Finalizada', 'Completada', 'Cancelada'].includes(cita.estado)) {
    AppAuth.showToast(`La consulta ${consultaId} ya está ${cita.estado} y no puede reabrirse.`, 'warning');
    return;
  }

  const enCurso = obtenerConsultaEnAtencion();
  if (enCurso && enCurso.Consulta_id !== consultaId) {
    AppAuth.showToast(`Ya estás atendiendo a ${enCurso.paciente_nombre || 'un paciente'}. Finaliza la consulta actual antes de atender a otro.`, 'warning');
    return;
  }

  consultaActiva = cita;

  const selectExp = document.getElementById('select-paciente-agenda-expediente');
  const selectMap = document.getElementById('select-paciente-agenda-mapa');
  if (selectExp) selectExp.value = String(cita.fk_no_expediente);
  if (selectMap) selectMap.value = String(cita.Consulta_id);
  actualizarIndicadorMapa(cita);

  // Cambiar estado a 'En atención' si estaba pendiente/confirmada/programada/en espera
  if (['Pendiente', 'Confirmada', 'Programada', 'En espera'].includes(cita.estado)) {
    const resEst = await AppAuth.fetchApi(`/api/medico/consultas/${consultaId}/estado`, {
      method: 'PUT',
      body: JSON.stringify({ estado: 'En atención' })
    });
    if (!resEst.ok) {
      AppAuth.showToast(resEst.data?.error || 'No se pudo iniciar la atención', 'warning');
      return;
    }
    cita.estado = 'En atención';
  }

  // Cargar expediente completo del paciente
  await cargarExpedientePaciente(cita.fk_no_expediente);

  // Cargar mapa podológico de esta consulta
  await cargarMapaConsulta(consultaId);

  // Actualizar tabla y KPIs para reflejar 'En atención' (Sí)
  await cargarAgendaPersonal();

  // Cambiar a la pestaña de Expediente Clínico
  cambiarPestana('tab-expediente');
  AppAuth.showToast(`Paciente cargado: ${cita.paciente_nombre}`, 'info');
};

/**
 * Actualiza el HUD flotante superior con el paciente activo
 */
function actualizarHUDPaciente(paciente, consulta) {
  const hud = document.getElementById('hud-paciente-activo');
  if (!hud) return;

  if (!paciente || !consulta || consulta.estado !== 'En atención') {
    hud.style.setProperty('display', 'none', 'important');
    return;
  }

  hud.style.setProperty('display', 'flex', 'important');
  actualizarIndicadorMapa(consulta, paciente);
  document.getElementById('hud-paciente-nombre').textContent = paciente.nombre_completo || `${paciente.Nombres} ${paciente.ape_paterno}`;
  document.getElementById('hud-paciente-exp').textContent = `#${paciente.No_expediente}`;
  document.getElementById('hud-consulta-id').textContent = consulta.Consulta_id;
  document.getElementById('hud-paciente-edad').textContent = paciente.edad ? `${paciente.edad} años` : '—';
  document.getElementById('hud-paciente-tel').textContent = paciente.telefono || '—';
  document.getElementById('hud-consulta-estado').textContent = consulta.estado;

  // Badges de riesgo
  const badgesContainer = document.getElementById('hud-badges-riesgo');
  badgesContainer.innerHTML = '';
  if (paciente.es_diabetico) {
    badgesContainer.innerHTML += '<span class="badge-risk diabetic"><i class="fa-solid fa-triangle-exclamation"></i> Diabético</span>';
  }
  if (paciente.es_hipertenso) {
    badgesContainer.innerHTML += '<span class="badge-risk hypertensive"><i class="fa-solid fa-heart-pulse"></i> Hipertenso</span>';
  }

  // Calcular IMC si hay peso y altura
  calcularYActualizarIMC(consulta.Peso, consulta.Altura);
}

function calcularYActualizarIMC(peso, altura) {
  const imcVal = document.getElementById('hud-imc-val');
  const imcLabel = document.getElementById('hud-imc-label');
  const imcDot = document.getElementById('hud-imc-dot');

  if (peso && altura && altura > 0) {
    const imc = (parseFloat(peso) / (parseFloat(altura) * parseFloat(altura))).toFixed(1);
    imcVal.textContent = imc;

    if (imc < 18.5) {
      imcLabel.textContent = 'Bajo peso';
      imcDot.className = 'imc-indicator imc-sobrepeso';
    } else if (imc < 25) {
      imcLabel.textContent = 'Normal';
      imcDot.className = 'imc-indicator imc-normal';
    } else if (imc < 30) {
      imcLabel.textContent = 'Sobrepeso';
      imcDot.className = 'imc-indicator imc-sobrepeso';
    } else {
      imcLabel.textContent = 'Obesidad';
      imcDot.className = 'imc-indicator imc-obesidad';
    }
  } else {
    imcVal.textContent = '—';
    imcLabel.textContent = 'Pendiente';
    imcDot.className = 'imc-indicator imc-sobrepeso';
  }
}

/**
 * =========================================================================
 * 2. EXPEDIENTE CLÍNICO
 * =========================================================================
 */
async function cargarExpedientePaciente(expediente) {
  const res = await AppAuth.fetchApi(`/api/medico/expediente/${expediente}`);
  if (!res.ok || !res.data) {
    AppAuth.showToast('No se encontró el expediente del paciente', 'error');
    return;
  }

  pacienteActivo = res.data.paciente;
  consultasPacienteCache = res.data.consultas || [];
  diagnosticosPacienteCache = res.data.diagnosticos || [];
  tratamientosPacienteCache = res.data.tratamientos || [];
  recetasPacienteCache = res.data.recetas || [];
  mapaHallazgosPacienteCache = res.data.mapaHallazgos || [];
  renderHistorialMapasAnteriores();

  document.getElementById('sin-paciente-alerta')?.style.setProperty('display', 'none', 'important');
  document.getElementById('contenedor-expediente-completo').style.display = 'block';

  // Si no había consultaActiva seleccionada, usar la última consulta
  if (!consultaActiva && res.data.consultas && res.data.consultas.length > 0) {
    consultaActiva = res.data.consultas[0];
  }

  actualizarHUDPaciente(pacienteActivo, consultaActiva);

  // Poblar formulario de somatometría de la consulta
  if (consultaActiva) {
    document.getElementById('exp-peso').value = consultaActiva.Peso || '';
    document.getElementById('exp-altura').value = consultaActiva.Altura || '';
    document.getElementById('exp-tipo-pisada').value = consultaActiva.tipo_pisada || '';
    document.getElementById('exp-alineacion').value = consultaActiva.alineacion || '';
    document.getElementById('exp-observaciones').value = consultaActiva.observaciones || '';
  }

  // Poblar antecedentes patológicos del paciente
  document.getElementById('ant-diabetico').checked = Boolean(pacienteActivo.es_diabetico);
  document.getElementById('ant-hipertenso').checked = Boolean(pacienteActivo.es_hipertenso);
  document.getElementById('ant-calzado').value = pacienteActivo.Calzado || '';
  document.getElementById('ant-patologicos').value = pacienteActivo.Antecedentes_patologicos || '';
  document.getElementById('ant-notas').value = pacienteActivo.Notas || '';

  const selectExp = document.getElementById('select-paciente-agenda-expediente');
  if (selectExp && expediente) {
    selectExp.value = String(expediente);
  }

  // Cargar tablas secundarias de la consulta activa
  if (consultaActiva) {
    await Promise.all([
      cargarDiagnosticosConsulta(consultaActiva.Consulta_id),
      cargarTratamientosConsulta(consultaActiva.Consulta_id),
      cargarRecetasConsulta(consultaActiva.Consulta_id)
    ]);
  }
}

function abrirModalInfoPacienteActivo() {
  const modal = document.getElementById('modal-info-paciente-hud');
  const body = document.getElementById('modal-info-paciente-body');
  if (!modal || !body || !pacienteActivo) return;

  const p = pacienteActivo;
  const consultasPrevias = (consultasPacienteCache || []).filter(
    (c) => !consultaActiva || c.Consulta_id !== consultaActiva.Consulta_id
  );
  const ultimaAtendida = consultasPrevias.find(
    (c) => c.estado === 'Completada' || c.estado === 'Finalizada'
  );
  const ultimaVisita = ultimaAtendida || (consultasPrevias.length > 0 ? consultasPrevias[0] : null);
  const fechaUltima = ultimaVisita?.fecha_hora
    ? new Date(ultimaVisita.fecha_hora).toLocaleString('es-MX', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

  const rawNac = p.fecha_nacimiento || p.Fecha_nacimiento || '';
  const fechaNacTxt = rawNac ? String(rawNac).split('T')[0] : 'N/D';
  const rawReg = p.Fecha_registro || p.fecha_registro || '';
  const fechaRegTxt = rawReg ? String(rawReg).split('T')[0] : 'N/D';
  const sexoTexto = p.Sexo === 'F' ? 'Femenino' : p.Sexo === 'M' ? 'Masculino' : (p.Sexo || 'No especificado');
  const direccionTexto = [p.calle_direccion || p.Calle_direccion, p.Municipio].filter(Boolean).join(', ') || 'No registrada';

  const diagPrevios = (diagnosticosPacienteCache || []).filter(
    (d) => !consultaActiva || d.fk_consulta_id !== consultaActiva.Consulta_id
  );
  const tratPrevios = (tratamientosPacienteCache || []).filter(
    (t) => !consultaActiva || t.fk_consulta_id !== consultaActiva.Consulta_id
  );
  const recetasPrevias = (recetasPacienteCache || []).filter(
    (r) => !consultaActiva || r.fk_consulta_id !== consultaActiva.Consulta_id
  );

  const renderLat = (izq, der) => {
    const l = [];
    if (izq) l.push('Pie Izq');
    if (der) l.push('Pie Der');
    return l.length > 0 ? l.join(' / ') : 'Bilateral';
  };

  body.innerHTML = `
    <div class="podo-info-3col">
      <div class="podo-info-card">
        <div style="font-size: 0.72rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 700;">Paciente</div>
        <div style="font-weight: 800; color: #0f172a; margin-top: 4px; font-size: 0.96rem;">${escapeHtml(p.nombre_completo || `${p.Nombres} ${p.ape_paterno}`)}</div>
        <div style="font-size: 0.82rem; color: #475569; margin-top: 4px;">Expediente: <strong>#${escapeHtml(p.No_expediente)}</strong></div>
        <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">Registro: ${escapeHtml(fechaRegTxt)}</div>
      </div>
      <div class="podo-info-card">
        <div style="font-size: 0.72rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 700;">Datos Demográficos</div>
        <div style="font-weight: 700; color: #0f172a; margin-top: 4px; font-size: 0.94rem;">${p.edad ? `${escapeHtml(p.edad)} años` : 'N/D'} · ${escapeHtml(sexoTexto)}</div>
        <div style="font-size: 0.8rem; color: #475569; margin-top: 3px;">Nacimiento: ${escapeHtml(fechaNacTxt)}</div>
        <div style="font-size: 0.82rem; color: #475569; margin-top: 2px;"><i class="fa-solid fa-phone" style="font-size: 0.75rem; color: #0d9488;"></i> ${escapeHtml(p.telefono || 'Sin teléfono')}</div>
      </div>
      <div class="podo-info-card">
        <div style="font-size: 0.72rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 700;">Domicilio y Calzado</div>
        <div style="font-weight: 700; color: #0f172a; margin-top: 4px; font-size: 0.92rem;">${escapeHtml(direccionTexto)}</div>
        <div style="font-size: 0.82rem; color: #475569; margin-top: 4px;">Calzado: <strong>${escapeHtml(p.calzado || p.Calzado || 'N/D')} cm</strong></div>
        <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">Ocupación: ${escapeHtml(p.ocupacion || p.Ocupacion || 'N/D')}</div>
      </div>
    </div>

    <div class="podo-info-card" style="margin-bottom: 14px;">
      <div style="font-size: 0.84rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
        <i class="fa-solid fa-clock-rotate-left" style="color: #0d9488;"></i>
        <span>${ultimaAtendida ? 'Última Visita Atendida' : 'Última Cita Registrada'}</span>
        <span style="margin-left: auto; font-size: 0.75rem; background: #f1f5f9; color: #0f172a; padding: 3px 10px; border-radius: 999px; font-weight: 700;">
          ${consultasPrevias.length} consulta${consultasPrevias.length === 1 ? '' : 's'} previa${consultasPrevias.length === 1 ? '' : 's'}
        </span>
      </div>
      ${
        ultimaVisita
          ? `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px 16px; font-size: 0.86rem; color: #334155;">
              <div><strong>Fecha:</strong> ${escapeHtml(fechaUltima)}</div>
              <div><strong>Estado:</strong> ${escapeHtml(ultimaVisita.estado || 'N/D')}</div>
              <div><strong>Especialista:</strong> ${escapeHtml(ultimaVisita.podologo_nombre || 'N/D')}</div>
              <div><strong>Sede:</strong> ${escapeHtml(ultimaVisita.clinica_nombre || 'N/D')}</div>
              <div><strong>Somatometría:</strong> ${ultimaVisita.Peso ? `${escapeHtml(ultimaVisita.Peso)} kg` : 'N/D'} · ${ultimaVisita.Altura ? `${escapeHtml(ultimaVisita.Altura)} m` : 'N/D'}</div>
              <div><strong>Pisada / Alineación:</strong> ${escapeHtml(ultimaVisita.tipo_pisada || 'N/D')} / ${escapeHtml(ultimaVisita.alineacion || 'N/D')}</div>
              <div style="grid-column: 1 / -1;"><strong>Motivo / Observaciones:</strong> ${escapeHtml(ultimaVisita.observaciones || ultimaVisita.motivo_o_notas || 'Sin observaciones')}</div>
            </div>
          `
          : `<div style="font-size: 0.88rem; color: #64748b;">Primera consulta registrada para este paciente.</div>`
      }
    </div>

    <div class="podo-info-card">
      <div style="font-size: 0.84rem; font-weight: 700; color: #0f172a; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-notes-medical" style="color: #dc2626;"></i>
        <span>Antecedentes y Notas Clínicas</span>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
        ${p.es_diabetico ? '<span class="badge-risk diabetic"><i class="fa-solid fa-triangle-exclamation"></i> Diabético</span>' : ''}
        ${p.es_hipertenso ? '<span class="badge-risk hypertensive"><i class="fa-solid fa-heart-pulse"></i> Hipertenso</span>' : ''}
        ${!p.es_diabetico && !p.es_hipertenso ? '<span style="font-size: 0.82rem; color: #059669; font-weight: 700; background: #ecfdf5; padding: 3px 10px; border-radius: 999px;">Sin alertas crónicas registradas</span>' : ''}
      </div>
      <div style="font-size: 0.86rem; color: #334155; line-height: 1.5;">
        <div><strong>Antecedentes patológicos:</strong> ${escapeHtml(p.Antecedentes_patologicos || 'Ninguno registrado')}</div>
        <div style="margin-top: 4px;"><strong>Notas:</strong> ${escapeHtml(p.Notas || 'Sin notas adicionales')}</div>
      </div>
    </div>

    <div class="podo-info-card" style="margin-top: 14px;">
      <div style="font-size: 0.84rem; font-weight: 700; color: #0f172a; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-file-medical" style="color: #7c3aed;"></i>
        <span>Diagnósticos y Tratamientos de Consultas Anteriores</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px;">
          <div style="font-size: 0.76rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px;">
            Diagnósticos (${diagPrevios.length})
          </div>
          ${
            diagPrevios.length > 0
              ? diagPrevios.slice(0, 6).map(d => {
                  const f = d.fecha_consulta ? String(d.fecha_consulta).split('T')[0] : '';
                  return `
                    <div style="font-size: 0.82rem; color: #1e293b; padding: 5px 0; border-bottom: 1px solid #e2e8f0;">
                      <strong>${escapeHtml(d.padecimiento)}</strong>
                      <span style="color: #64748b;"> · ${escapeHtml(renderLat(d.pie_izquierdo, d.pie_derecho))}</span>
                      ${d.tipo_diagnostico ? `<span style="background: #ede9fe; color: #6d28d9; font-size: 0.7rem; padding: 1px 6px; border-radius: 999px; margin-left: 4px;">${escapeHtml(d.tipo_diagnostico)}</span>` : ''}
                      ${f ? `<div style="font-size: 0.74rem; color: #64748b;">${escapeHtml(f)}${d.detalles_adicionales ? ' · ' + escapeHtml(d.detalles_adicionales) : ''}</div>` : ''}
                    </div>
                  `;
                }).join('')
              : '<div style="font-size: 0.82rem; color: #64748b;">Sin diagnósticos previos registrados.</div>'
          }
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px;">
          <div style="font-size: 0.76rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px;">
            Tratamientos (${tratPrevios.length})
          </div>
          ${
            tratPrevios.length > 0
              ? tratPrevios.slice(0, 6).map(t => {
                  const f = t.fecha_consulta ? String(t.fecha_consulta).split('T')[0] : '';
                  return `
                    <div style="font-size: 0.82rem; color: #1e293b; padding: 5px 0; border-bottom: 1px solid #e2e8f0;">
                      <strong>${escapeHtml(t.procedimiento_servicio)}</strong>
                      <span style="color: #64748b;"> · ${escapeHtml(renderLat(t.pie_izquierdo, t.pie_derecho))}</span>
                      ${t.tratamiento_aplicado ? `<div style="font-size: 0.76rem; color: #475569;">${escapeHtml(t.tratamiento_aplicado)}</div>` : ''}
                      ${f ? `<div style="font-size: 0.72rem; color: #64748b;">${escapeHtml(f)}</div>` : ''}
                    </div>
                  `;
                }).join('')
              : '<div style="font-size: 0.82rem; color: #64748b;">Sin tratamientos previos registrados.</div>'
          }
        </div>
      </div>
    </div>

    <div class="podo-info-card" style="margin-top: 14px;">
      <div style="font-size: 0.84rem; font-weight: 700; color: #0f172a; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-file-prescription" style="color: #2563eb;"></i>
        <span>Historial de Recetas Médicas (${recetasPrevias.length})</span>
      </div>
      ${
        recetasPrevias.length > 0
          ? recetasPrevias.slice(0, 5).map(r => {
              const folio = r.Receta_id || r.folio || 'RX-000';
              const fechaR = r.fecha_emision ? String(r.fecha_emision).split('T')[0] : '';
              const meds = Array.isArray(r.medicamentos) && r.medicamentos.length > 0 ? r.medicamentos : (r.detalles || []);
              return `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
                  <div style="flex: 1; min-width: 200px;">
                    <div style="font-size: 0.82rem; font-weight: 700; color: #1e293b;">
                      ${escapeHtml(folio)} ${fechaR ? `<span style="font-weight: 500; color: #64748b;">· ${escapeHtml(fechaR)}</span>` : ''}
                    </div>
                    <div style="font-size: 0.78rem; color: #475569; margin-top: 2px;">
                      ${meds.length > 0 ? meds.map(m => escapeHtml(m.medicamento)).join(', ') : escapeHtml(r.indicaciones_generales || 'Sin detalle')}
                    </div>
                  </div>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="descargarRecetaHistorial('${encodeURIComponent(String(folio))}')" style="border-radius: 999px; font-size: 0.76rem;">
                    <i class="fa-solid fa-file-pdf" style="color: #dc2626;"></i> PDF
                  </button>
                </div>
              `;
            }).join('')
          : '<div style="font-size: 0.82rem; color: #64748b;">Sin recetas emitidas en consultas anteriores.</div>'
      }
    </div>
  `;

  if (typeof modal.showModal === 'function') {
    modal.showModal();
  } else {
    modal.setAttribute('open', 'true');
  }
}
window.abrirModalInfoPacienteActivo = abrirModalInfoPacienteActivo;

window.toggleAcordeon = (headerEl) => {
  const bodyEl = headerEl.nextElementSibling;
  const iconEl = headerEl.querySelector('.fa-chevron-down, .fa-chevron-up');
  if (bodyEl.style.display === 'none') {
    bodyEl.style.display = 'block';
    if (iconEl) iconEl.className = 'fa-solid fa-chevron-up';
  } else {
    bodyEl.style.display = 'none';
    if (iconEl) iconEl.className = 'fa-solid fa-chevron-down';
  }
};

function configurarEventosExpediente() {
  // Selector rápido de paciente de mi agenda
  document.getElementById('select-paciente-agenda-expediente')?.addEventListener('change', async (e) => {
    const exp = e.target.value;
    if (exp) {
      const cita = misCitasCache.find(c => String(c.fk_no_expediente) === String(exp));
      if (cita) {
        consultaActiva = cita;
        const selectMap = document.getElementById('select-paciente-agenda-mapa');
        if (selectMap) selectMap.value = cita.Consulta_id;
        actualizarIndicadorMapa(cita);
        await cargarMapaConsulta(cita.Consulta_id);
      }
      await cargarExpedientePaciente(exp);
    }
  });

  // Selector en Mapa Podológico
  document.getElementById('select-paciente-agenda-mapa')?.addEventListener('change', async (e) => {
    const consultaId = e.target.value;
    if (consultaId) {
      const cita = misCitasCache.find(c => String(c.Consulta_id) === String(consultaId));
      if (cita) {
        consultaActiva = cita;
        actualizarIndicadorMapa(cita);
        const selectExp = document.getElementById('select-paciente-agenda-expediente');
        if (selectExp) selectExp.value = String(cita.fk_no_expediente);
        await cargarMapaConsulta(consultaId);
        await cargarExpedientePaciente(cita.fk_no_expediente);
      }
    }
  });

  // Búsqueda manual de expediente para atención sin cita previa
  document.getElementById('btn-cargar-expediente-manual')?.addEventListener('click', () => {
    const exp = document.getElementById('input-buscar-expediente').value.trim();
    if (exp) buscarPacientePorExpedienteParaAtender(exp);
  });

  document.getElementById('input-buscar-expediente')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const exp = document.getElementById('input-buscar-expediente').value.trim();
      if (exp) buscarPacientePorExpedienteParaAtender(exp);
    }
  });

  // Guardar Somatometría
  const formExploracion = document.getElementById('form-exploracion-fisica');
  formExploracion?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!consultaActiva) return;

    const payload = {
      Peso: document.getElementById('exp-peso').value || null,
      Altura: document.getElementById('exp-altura').value || null,
      tipo_pisada: document.getElementById('exp-tipo-pisada').value || null,
      alineacion: document.getElementById('exp-alineacion').value || null,
      observaciones: document.getElementById('exp-observaciones').value || null
    };

    const res = await AppAuth.fetchApi(`/api/medico/consultas/${consultaActiva.Consulta_id}/exploracion`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      AppAuth.showToast('¡Somatometría y exploración física guardadas!', 'success');
      consultaActiva.Peso = payload.Peso;
      consultaActiva.Altura = payload.Altura;
      calcularYActualizarIMC(payload.Peso, payload.Altura);
    }
  });

  // Guardar Antecedentes Médicos
  const formAntecedentes = document.getElementById('form-antecedentes-paciente');
  formAntecedentes?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pacienteActivo) return;

    const payload = {
      es_diabetico: document.getElementById('ant-diabetico').checked,
      es_hipertenso: document.getElementById('ant-hipertenso').checked,
      Calzado: document.getElementById('ant-calzado').value || null,
      Antecedentes_patologicos: document.getElementById('ant-patologicos').value || null,
      Notas: document.getElementById('ant-notas').value || null
    };

    const res = await AppAuth.fetchApi(`/api/medico/pacientes/${pacienteActivo.No_expediente}/clinico`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      AppAuth.showToast('¡Historial clínico del paciente actualizado!', 'success');
      pacienteActivo.es_diabetico = payload.es_diabetico;
      pacienteActivo.es_hipertenso = payload.es_hipertenso;
      actualizarHUDPaciente(pacienteActivo, consultaActiva);
    }
  });

  // Agregar Diagnóstico
  const formDiag = document.getElementById('form-nuevo-diagnostico');
  formDiag?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!consultaActiva) {
      AppAuth.showToast('Debes seleccionar una consulta activa primero', 'warning');
      return;
    }

    const payload = {
      padecimiento: document.getElementById('diag-padecimiento').value,
      pie_izquierdo: document.getElementById('diag-pie-izq').checked,
      pie_derecho: document.getElementById('diag-pie-der').checked,
      tipo_diagnostico: document.getElementById('diag-tipo').value,
      detalles_adicionales: document.getElementById('diag-detalles').value
    };

    const res = await AppAuth.fetchApi(`/api/medico/consultas/${consultaActiva.Consulta_id}/diagnosticos`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      AppAuth.showToast('Diagnóstico registrado', 'success');
      formDiag.reset();
      cargarDiagnosticosConsulta(consultaActiva.Consulta_id);
    }
  });

  // Agregar Tratamiento
  const formTrat = document.getElementById('form-nuevo-tratamiento');
  formTrat?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!consultaActiva) return;

    const payload = {
      procedimiento_servicio: document.getElementById('trat-procedimiento').value,
      pie_izquierdo: document.getElementById('trat-pie-izq').checked,
      pie_derecho: document.getElementById('trat-pie-der').checked,
      tratamiento_aplicado: document.getElementById('trat-aplicado').value,
      frecuencia: document.getElementById('trat-frecuencia').value
    };

    const res = await AppAuth.fetchApi(`/api/medico/consultas/${consultaActiva.Consulta_id}/tratamientos`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      AppAuth.showToast('Tratamiento registrado', 'success');
      formTrat.reset();
      cargarTratamientosConsulta(consultaActiva.Consulta_id);
    }
  });

  // Inicializar formulario dinámico de medicamentos
  inicializarFormularioRecetaDinamica();

  // Emitir Receta
  const formReceta = document.getElementById('form-nueva-receta');
  formReceta?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!consultaActiva) {
      AppAuth.showToast('Debes seleccionar o atender una consulta activa primero.', 'warning');
      return;
    }

    // Extraer medicamentos de las filas dinámicas
    const itemsRows = document.querySelectorAll('.item-medicamento-fila');
    const medicamentos = [];

    itemsRows.forEach(row => {
      const nombre = row.querySelector('.med-nombre')?.value.trim();
      const dosis = row.querySelector('.med-dosis')?.value.trim();
      const via = row.querySelector('.med-via')?.value;
      const frecuencia = row.querySelector('.med-frecuencia')?.value.trim();
      const duracion = row.querySelector('.med-duracion')?.value.trim();

      if (nombre) {
        medicamentos.push({
          medicamento: nombre,
          dosis: dosis || 'Dosis indicada',
          via_administracion: via || 'Tópica',
          frecuencia: frecuencia || 'Cada 12 horas',
          duracion: duracion || '7 días'
        });
      }
    });

    if (medicamentos.length === 0) {
      AppAuth.showToast('Por favor agrega al menos un medicamento con su nombre para emitir la receta.', 'warning');
      return;
    }

    const payload = {
      fk_consulta_id: consultaActiva.Consulta_id,
      fk_paciente_id: pacienteActivo?.No_expediente || consultaActiva.fk_no_expediente,
      indicaciones_generales: document.getElementById('receta-indicaciones')?.value.trim() || 'Seguir tratamiento e higiene según las indicaciones.',
      medicamentos
    };

    const submitBtn = document.getElementById('btn-emitir-receta-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Emitiendo Receta...';
    }

    try {
      const res = await AppAuth.fetchApi(`/api/medico/consultas/${consultaActiva.Consulta_id}/recetas`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.ok && res.data) {
        const folioGenerado = res.data.Receta_id || res.data.folio || `RX-${Date.now().toString().slice(-6)}`;
        AppAuth.showToast(`¡Receta médica emitida con éxito! Folio: ${folioGenerado}`, 'success');
        document.getElementById('receta-indicaciones').value = '';
        inicializarFormularioRecetaDinamica(); // Reiniciar a 1 fila vacía
        await cargarRecetasConsulta(consultaActiva.Consulta_id);

        // Generar y descargar PDF oficial de la receta
        await generarRecetaPDF({
          Receta_id: folioGenerado,
          indicaciones_generales: payload.indicaciones_generales,
          medicamentos: payload.medicamentos,
          fecha_emision: new Date().toISOString()
        });
      } else {
        const errorMsg = res.data?.error || res.error || 'No se pudo emitir la receta médica';
        AppAuth.showToast(errorMsg, 'error');
      }
    } catch (err) {
      console.error('Error al emitir receta:', err);
      AppAuth.showToast('Error de conexión al emitir la receta', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-file-circle-check"></i> Emitir Receta';
      }
    }
  });
}

/**
 * Gestor dinámico de filas de medicamentos para la receta
 */
function inicializarFormularioRecetaDinamica() {
  const contenedor = document.getElementById('contenedor-medicamentos-dinamicos');
  if (!contenedor) return;

  contenedor.innerHTML = '';
  agregarFilaMedicamento(); // Iniciar con 1 fila por defecto

  const btnAgregar = document.getElementById('btn-agregar-medicamento-dinamico');
  if (btnAgregar && !btnAgregar.dataset.bound) {
    btnAgregar.dataset.bound = 'true';
    btnAgregar.addEventListener('click', () => {
      agregarFilaMedicamento();
    });
  }
}

function agregarFilaMedicamento(item = {}) {
  const contenedor = document.getElementById('contenedor-medicamentos-dinamicos');
  if (!contenedor) return;

  const fila = document.createElement('div');
  fila.className = 'item-medicamento-fila';
  fila.style.cssText = `
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 16px 18px;
    position: relative;
    transition: all 0.2s ease;
  `;

  fila.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <span style="font-weight: 700; font-size: 0.85rem; color: #475569; display: flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-capsules" style="color: #f69251;"></i> Medicamento #${contenedor.children.length + 1}
      </span>
      <button type="button" class="btn-eliminar-fila-med" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.88rem; padding: 4px 8px; border-radius: 6px;" title="Eliminar este medicamento">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
    <div class="form-grid-2" style="margin-bottom: 10px;">
      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label" style="font-size: 0.8rem; margin-bottom: 4px;">Nombre / Sustancia Activa *</label>
        <input type="text" class="form-control med-nombre" placeholder="Ej. Terbinafina crema 1%, Ciclopirox laca 8%, Urea 40%" value="${item.medicamento || ''}" required>
      </div>
      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label" style="font-size: 0.8rem; margin-bottom: 4px;">Dosis / Concentración</label>
        <input type="text" class="form-control med-dosis" placeholder="Ej. Capa fina sobre la lesión, 1 tableta, 2 gotas" value="${item.dosis || ''}">
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1.2fr 1fr; gap: 12px;">
      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label" style="font-size: 0.8rem; margin-bottom: 4px;">Vía</label>
        <select class="form-select med-via">
          <option value="Tópica" ${item.via === 'Tópica' ? 'selected' : ''}>Tópica</option>
          <option value="Oral" ${item.via === 'Oral' ? 'selected' : ''}>Oral</option>
          <option value="Sublingual" ${item.via === 'Sublingual' ? 'selected' : ''}>Sublingual</option>
          <option value="Ótica" ${item.via === 'Ótica' ? 'selected' : ''}>Ótica</option>
          <option value="Inhalada" ${item.via === 'Inhalada' ? 'selected' : ''}>Inhalada</option>
        </select>
      </div>
      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label" style="font-size: 0.8rem; margin-bottom: 4px;">Frecuencia</label>
        <select class="form-select med-frecuencia">
          <option value="Cada 8 horas" ${item.frecuencia === 'Cada 8 horas' ? 'selected' : ''}>Cada 8 horas</option>
          <option value="Cada 12 horas" ${!item.frecuencia || item.frecuencia === 'Cada 12 horas' ? 'selected' : ''}>Cada 12 horas</option>
          <option value="Cada 24 horas (Diario)" ${item.frecuencia === 'Cada 24 horas (Diario)' ? 'selected' : ''}>Cada 24 horas (Diario)</option>
          <option value="Cada 3 días" ${item.frecuencia === 'Cada 3 días' ? 'selected' : ''}>Cada 3 días</option>
          <option value="Cada 7 días (Semanal)" ${item.frecuencia === 'Cada 7 días (Semanal)' ? 'selected' : ''}>Cada 7 días (Semanal)</option>
          <option value="Cada 15 días" ${item.frecuencia === 'Cada 15 días' ? 'selected' : ''}>Cada 15 días</option>
          <option value="Cada 30 días (Mensual)" ${item.frecuencia === 'Cada 30 días (Mensual)' ? 'selected' : ''}>Cada 30 días (Mensual)</option>
          <option value="Dosis única" ${item.frecuencia === 'Dosis única' ? 'selected' : ''}>Dosis única</option>
        </select>
      </div>
      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label" style="font-size: 0.8rem; margin-bottom: 4px;">Duración</label>
        <input type="text" class="form-control med-duracion" placeholder="Ej. 14 días, 1 mes" value="${item.duracion || ''}">
      </div>
    </div>
  `;

  // Botón eliminar fila
  const btnEliminar = fila.querySelector('.btn-eliminar-fila-med');
  btnEliminar.addEventListener('click', () => {
    if (contenedor.children.length > 1) {
      fila.remove();
      // Renumerar
      Array.from(contenedor.children).forEach((f, idx) => {
        const titleSpan = f.querySelector('span');
        if (titleSpan) titleSpan.innerHTML = `<i class="fa-solid fa-capsules" style="color: #f69251;"></i> Medicamento #${idx + 1}`;
      });
    } else {
      AppAuth.showToast('Debe existir al menos un campo de medicamento.', 'info');
    }
  });

  contenedor.appendChild(fila);
}

// Cargar diagnósticos de la consulta
async function cargarDiagnosticosConsulta(consultaId) {
  const tbody = document.getElementById('tabla-diagnosticos-body');
  if (!tbody) return;

  const res = await AppAuth.fetchApi(`/api/medico/consultas/${consultaId}/diagnosticos`);
  if (res.ok && Array.isArray(res.data)) {
    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Sin diagnósticos registrados en esta consulta.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(d => {
      let lat = [];
      if (d.pie_izquierdo) lat.push('<span class="status-badge badge-programada">Pie Izq</span>');
      if (d.pie_derecho) lat.push('<span class="status-badge badge-atencion">Pie Der</span>');

      const safeDiagId = encodeURIComponent(String(d.Diagnostico_id));

      return `
        <tr>
          <td><strong>${escapeHtml(d.padecimiento)}</strong></td>
          <td>${lat.join(' ') || 'Bilateral / No esp.'}</td>
          <td><span class="user-role-badge role-badge-recep">${escapeHtml(d.tipo_diagnostico || 'Clínico')}</span></td>
          <td>${escapeHtml(d.detalles_adicionales || '—')}</td>
          <td>
            <button class="btn btn-danger-outline btn-sm" onclick="eliminarDiagnostico('${safeDiagId}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
}

window.eliminarDiagnostico = async (diagId) => {
  const res = await AppAuth.fetchApi(`/api/medico/diagnosticos/${diagId}`, { method: 'DELETE' });
  if (res.ok) {
    AppAuth.showToast('Diagnóstico eliminado', 'info');
    if (consultaActiva) cargarDiagnosticosConsulta(consultaActiva.Consulta_id);
  }
};

// Cargar tratamientos de la consulta
async function cargarTratamientosConsulta(consultaId) {
  const tbody = document.getElementById('tabla-tratamientos-body');
  if (!tbody) return;

  const res = await AppAuth.fetchApi(`/api/medico/consultas/${consultaId}/tratamientos`);
  if (res.ok && Array.isArray(res.data)) {
    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Sin tratamientos registrados en esta consulta.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(t => {
      let lat = [];
      if (t.pie_izquierdo) lat.push('<span class="status-badge badge-programada">Pie Izq</span>');
      if (t.pie_derecho) lat.push('<span class="status-badge badge-atencion">Pie Der</span>');

      let frecuenciaTexto = t.frecuencia || '';
      let detalleTexto = t.tratamiento_aplicado || '';
      const matchFreq = detalleTexto.match(/\(?\s*Frecuencia:\s*([^)]+)\)?/i);
      if (!frecuenciaTexto && matchFreq) {
        frecuenciaTexto = matchFreq[1].trim();
        detalleTexto = detalleTexto.replace(matchFreq[0], '').trim();
      }

      const safeTratId = encodeURIComponent(String(t.Tratamiento_id));

      return `
        <tr>
          <td><strong>${escapeHtml(t.procedimiento_servicio)}</strong></td>
          <td>${lat.join(' ') || 'Bilateral'}</td>
          <td>${escapeHtml(detalleTexto || '—')}</td>
          <td>${escapeHtml(frecuenciaTexto || '—')}</td>
          <td>
            <button class="btn btn-danger-outline btn-sm" onclick="eliminarTratamiento('${safeTratId}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
}

window.eliminarTratamiento = async (tratId) => {
  const res = await AppAuth.fetchApi(`/api/medico/tratamientos/${tratId}`, { method: 'DELETE' });
  if (res.ok) {
    AppAuth.showToast('Tratamiento eliminado', 'info');
    if (consultaActiva) cargarTratamientosConsulta(consultaActiva.Consulta_id);
  }
};

// Cargar recetas emitidas para la consulta activa
async function cargarRecetasConsulta(consultaId) {
  const container = document.getElementById('lista-recetas-emitidas');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 20px; color: var(--color-stone);">
      <i class="fa-solid fa-spinner fa-spin"></i> Consultando recetas médicas...
    </div>
  `;

  const res = await AppAuth.fetchApi(`/api/medico/consultas/${consultaId}/recetas`);
  
  // La API puede retornar un objeto directo de la receta o un array
  let recetas = [];
  if (res.ok && res.data) {
    recetas = Array.isArray(res.data) ? res.data : [res.data];
  }
  recetasConsultaCache = recetas;

  if (recetas.length === 0) {
    container.innerHTML = `
      <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 14px; padding: 22px; text-align: center; color: var(--color-stone);">
        <i class="fa-solid fa-file-prescription" style="font-size: 1.6rem; color: #94a3b8; margin-bottom: 8px;"></i>
        <p style="margin: 0; font-size: 0.88rem;">No se han emitido recetas médicas aún para esta consulta.</p>
        <small style="color: #64748b;">Completa el formulario anterior para prescribir medicamentos y emitir el PDF.</small>
      </div>
    `;
    return;
  }

  container.innerHTML = recetas.map(r => {
    const folio = r.Receta_id || r.folio || 'RX-000';
    const fecha = r.fecha_emision || r.fecha;
    const fechaTexto = fecha ? new Date(fecha).toLocaleString('es-MX', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : 'Fecha actual';

    const meds = Array.isArray(r.medicamentos) && r.medicamentos.length > 0 ? r.medicamentos : (r.detalles || []);
    const safeFolio = encodeURIComponent(String(folio));

    return `
      <div class="tarjeta-receta-emitida" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px 22px; margin-bottom: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); transition: all 0.2s ease;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="background: #eff6ff; color: #1d4ed8; font-weight: 700; font-size: 0.88rem; padding: 4px 10px; border-radius: 9999px; border: 1px solid #bfdbfe; display: inline-flex; align-items: center; gap: 5px;">
                <i class="fa-solid fa-file-prescription"></i> ${escapeHtml(folio)}
              </span>
              <span style="color: #64748b; font-size: 0.82rem;">${escapeHtml(fechaTexto)}</span>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-sm" onclick="descargarRecetaPorId('${safeFolio}')" style="background: #0f172a; color: #ffffff; border: none; border-radius: 9999px; padding: 7px 15px; font-weight: 700; font-size: 0.8rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;" title="Descargar receta médica en PDF">
              <i class="fa-solid fa-file-pdf"></i> Descargar Receta (PDF)
            </button>
          </div>
        </div>

        <!-- Indicaciones -->
        <p style="font-size: 0.88rem; color: #334155; margin-bottom: 12px; line-height: 1.5; background: #f8fafc; padding: 10px 14px; border-radius: 10px; border-left: 3px solid #f69251;">
          <strong>Indicaciones:</strong> ${escapeHtml(r.indicaciones_generales || 'Ninguna especificada')}
        </p>

        <!-- Medicamentos -->
        ${meds.length > 0 ? `
          <div style="margin-top: 10px;">
            <span style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.5px;">Medicamentos Prescritos (${meds.length}):</span>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; margin-top: 6px;">
              ${meds.map(m => `
                <div style="background: #fafafa; border: 1px solid #ebebeb; border-radius: 10px; padding: 8px 12px; font-size: 0.83rem;">
                  <strong style="color: #0f172a;">${escapeHtml(m.medicamento)}</strong>
                  <div style="color: #64748b; margin-top: 2px;">
                    ${escapeHtml(m.dosis)} • ${escapeHtml(m.via_administracion || m.via || 'Tópica')} • ${escapeHtml(m.frecuencia || 'C/12h')} • ${escapeHtml(m.duracion || '7d')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

/**
 * =========================================================================
 * 3. MAPA PODOLÓGICO INTERACTIVO (Detalles_Mapa_Podologico)
 * =========================================================================
 */
function actualizarResumenZonasSeleccionadas() {
  const displayTitulo = document.getElementById('display-zona-seleccionada');
  const displayAyuda = document.getElementById('display-zona-ayuda');
  const inputValor = document.getElementById('mapa-zona-pie-valor');

  if (!displayTitulo || !displayAyuda || !inputValor) return;

  if (zonasSeleccionadasMapa.length === 0) {
    displayTitulo.textContent = 'Ninguna zona seleccionada';
    displayAyuda.textContent = 'Toca una o varias zonas anatómicas en los pies del diagrama';
    inputValor.value = '';
  } else if (zonasSeleccionadasMapa.length === 1) {
    displayTitulo.textContent = zonasSeleccionadasMapa[0];
    displayAyuda.innerHTML = 'Zona lista para asociar patología (puedes tocar más zonas) · <a href="#" onclick="limpiarSeleccionMapa(event)" style="color:#7c3aed;font-weight:700;">Limpiar</a>';
    inputValor.value = zonasSeleccionadasMapa[0];
  } else {
    displayTitulo.textContent = `${zonasSeleccionadasMapa.length} zonas seleccionadas`;
    displayAyuda.innerHTML = `${escapeHtml(zonasSeleccionadasMapa.join(' · '))} <a href="#" onclick="limpiarSeleccionMapa(event)" style="color:#7c3aed;font-weight:700;margin-left:6px;">Limpiar</a>`;
    inputValor.value = zonasSeleccionadasMapa.join(' | ');
  }
}

window.limpiarSeleccionMapa = (e) => {
  if (e) e.preventDefault();
  zonasSeleccionadasMapa = [];
  zonaSeleccionadaActual = null;
  document.querySelectorAll('.foot-zone').forEach(z => z.classList.remove('selected'));
  actualizarResumenZonasSeleccionadas();
};

function configurarMapaPodologicoInteractivo() {
  const zonas = document.querySelectorAll('.foot-zone');

  zonas.forEach(zona => {
    zona.addEventListener('click', (e) => {
      e.stopPropagation();

      const pie = zona.getAttribute('data-pie');
      const nombreZona = zona.getAttribute('data-zona');
      const etiqueta = `${pie} (${vistaPieActual.toUpperCase()}): ${nombreZona}`;

      if (zona.classList.contains('selected')) {
        zona.classList.remove('selected');
        zonasSeleccionadasMapa = zonasSeleccionadasMapa.filter(z => z !== etiqueta);
      } else {
        zona.classList.add('selected');
        if (!zonasSeleccionadasMapa.includes(etiqueta)) {
          zonasSeleccionadasMapa.push(etiqueta);
        }
      }

      zonaSeleccionadaActual = zonasSeleccionadasMapa[zonasSeleccionadasMapa.length - 1] || null;
      actualizarResumenZonasSeleccionadas();
    });
  });

  // Submit registro de lesión en mapa (soporta 1 o múltiples zonas seleccionadas)
  const formMapa = document.getElementById('form-registro-mapa');
  formMapa?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!consultaActiva) {
      AppAuth.showToast('Primero debes tener un paciente en atención para registrar hallazgos', 'warning');
      return;
    }

    const zonasARegistrar = zonasSeleccionadasMapa.length > 0
      ? [...zonasSeleccionadasMapa]
      : (document.getElementById('mapa-zona-pie-valor').value ? [document.getElementById('mapa-zona-pie-valor').value] : []);
    const tipoLesion = document.getElementById('mapa-tipo-lesion').value;
    const observaciones = document.getElementById('mapa-observaciones').value;

    if (zonasARegistrar.length === 0) {
      AppAuth.showToast('Por favor selecciona al menos una zona en el pie anatómico', 'warning');
      return;
    }

    const btnSubmit = document.getElementById('btn-guardar-lesion-mapa');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    }

    try {
      const resultados = await Promise.all(
        zonasARegistrar.map((zonaPie) =>
          AppAuth.fetchApi(`/api/medico/consultas/${consultaActiva.Consulta_id}/mapa`, {
            method: 'POST',
            body: JSON.stringify({
              zona_pie: zonaPie,
              tipo_lesion: tipoLesion,
              observaciones
            })
          })
        )
      );

      if (resultados.every(r => r.ok)) {
        AppAuth.showToast(
          zonasARegistrar.length > 1
            ? `¡${zonasARegistrar.length} hallazgos guardados en el Mapa Podológico!`
            : '¡Hallazgo guardado en el Mapa Podológico!',
          'success'
        );
        formMapa.reset();
        limpiarSeleccionMapa();
        await cargarMapaConsulta(consultaActiva.Consulta_id);
      } else {
        AppAuth.showToast('Algunos hallazgos no se pudieron guardar', 'error');
      }
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-map-pin"></i> Registrar en Mapa Podológico';
      }
    }
  });
}

window.cambiarVistaPie = (vista) => {
  vistaPieActual = vista;
  document.getElementById('btn-vista-plantar').classList.toggle('active', vista === 'plantar');
  document.getElementById('btn-vista-dorsal').classList.toggle('active', vista === 'dorsal');

  document.getElementById('label-pie-izq').textContent = `Pie Izquierdo (${vista.toUpperCase()})`;
  document.getElementById('label-pie-der').textContent = `Pie Derecho (${vista.toUpperCase()})`;

  if (consultaActiva) {
    dibujarPinesEnMapa(hallazgosMapaCache);
  }
};

async function cargarHistorialMapasPaciente(expediente) {
  if (!expediente) return;
  const res = await AppAuth.fetchApi(`/api/medico/pacientes/${encodeURIComponent(expediente)}/mapas`);
  if (res.ok && Array.isArray(res.data)) {
    mapaHallazgosPacienteCache = res.data;
    renderHistorialMapasAnteriores();
  }
}

async function cargarMapaConsulta(consultaId) {
  const banner = document.getElementById('mapa-modo-historial-banner');
  if (banner) banner.style.display = 'none';

  const res = await AppAuth.fetchApi(`/api/medico/consultas/${consultaId}/mapa`);
  if (res.ok && Array.isArray(res.data)) {
    hallazgosMapaCache = res.data;
    renderListaHallazgos(res.data, false);
    dibujarPinesEnMapa(res.data);
  }
  const exp = pacienteActivo?.No_expediente || consultaActiva?.fk_no_expediente;
  if (exp) {
    await cargarHistorialMapasPaciente(exp);
  } else {
    renderHistorialMapasAnteriores();
  }
}

function renderListaHallazgos(hallazgos, soloLectura = false) {
  const container = document.getElementById('lista-lesiones-registradas');
  const badgeTotal = document.getElementById('badge-total-lesiones');
  if (!container) return;

  if (badgeTotal) badgeTotal.textContent = `${hallazgos.length} hallazgos`;

  if (hallazgos.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1rem;">No hay hallazgos registrados para esta consulta aún.</p>`;
    return;
  }

  container.innerHTML = hallazgos.map(h => `
    <div class="lesion-item">
      <div class="lesion-item-info">
        <h5>
          <i class="fa-solid fa-circle-dot" style="color: #ec4899; font-size: 0.75rem;"></i>
          ${escapeHtml(h.tipo_lesion)}
        </h5>
        <p><i class="fa-solid fa-location-dot" style="color:#c084fc;"></i> ${escapeHtml(h.zona_pie)}</p>
        ${h.observaciones ? `<p style="color: #94a3b8; font-size: 0.78rem;">${escapeHtml(h.observaciones)}</p>` : ''}
      </div>
      ${
        soloLectura
          ? '<span style="font-size: 0.72rem; color: #64748b; background: #f1f5f9; padding: 3px 8px; border-radius: 999px;">Histórico</span>'
          : `<button class="btn btn-danger-outline btn-sm" onclick="eliminarHallazgoMapa('${encodeURIComponent(String(h.Mapa_id))}')" title="Eliminar hallazgo">
              <i class="fa-solid fa-trash"></i>
            </button>`
      }
    </div>
  `).join('');
}

function renderHistorialMapasAnteriores() {
  const container = document.getElementById('lista-historial-mapas');
  if (!container) return;

  const hallazgosPrevios = (mapaHallazgosPacienteCache || []).filter(
    (m) => !consultaActiva || String(m.fk_consulta_id) !== String(consultaActiva.Consulta_id)
  );

  if (hallazgosPrevios.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: #64748b; padding: 1.25rem; font-size: 0.88rem; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
        No hay mapas podológicos registrados en consultas anteriores de este paciente.
      </div>
    `;
    return;
  }

  const porConsulta = new Map();
  hallazgosPrevios.forEach((m) => {
    const cid = String(m.fk_consulta_id);
    if (!porConsulta.has(cid)) porConsulta.set(cid, []);
    porConsulta.get(cid).push(m);
  });

  container.innerHTML = Array.from(porConsulta.entries()).map(([cid, items]) => {
    const con = (consultasPacienteCache || []).find((c) => String(c.Consulta_id) === cid);
    const fechaTxt = con?.fecha_hora || items[0]?.fecha_consulta;
    const fechaFormat = fechaTxt
      ? new Date(fechaTxt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'Fecha previa';
    const podNombre = con?.podologo_nombre || 'Especialista';

    return `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="font-weight: 700; color: #0f172a; font-size: 0.88rem;">${escapeHtml(fechaFormat)}</span>
            <span style="background: #ede9fe; color: #6d28d9; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 999px;">${items.length} hallazgo${items.length === 1 ? '' : 's'}</span>
          </div>
          <div style="font-size: 0.78rem; color: #64748b; margin-bottom: 8px;">
            <code>${escapeHtml(cid)}</code> · ${escapeHtml(podNombre)}
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            ${items.slice(0, 4).map(it => `<span style="background: #ffffff; border: 1px solid #e2e8f0; color: #334155; font-size: 0.72rem; padding: 2px 7px; border-radius: 6px;">${escapeHtml(it.tipo_lesion)}</span>`).join('')}
          </div>
        </div>
        <button type="button" class="btn btn-sm" onclick="verMapaConsultaHistorica('${encodeURIComponent(cid)}')" style="background: #0f172a; color: #ffffff; border: none; border-radius: 999px; padding: 7px 12px; font-weight: 700; font-size: 0.78rem; cursor: pointer; width: 100%;">
          <i class="fa-solid fa-eye"></i> Ver en el Mapa
        </button>
      </div>
    `;
  }).join('');
}

window.verMapaConsultaHistorica = (cidEncoded) => {
  const cid = decodeURIComponent(cidEncoded);
  const items = (mapaHallazgosPacienteCache || []).filter(m => String(m.fk_consulta_id) === cid);
  const con = (consultasPacienteCache || []).find(c => String(c.Consulta_id) === cid);
  const fechaTxt = con?.fecha_hora || items[0]?.fecha_consulta;
  const fechaFormat = fechaTxt
    ? new Date(fechaTxt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  const banner = document.getElementById('mapa-modo-historial-banner');
  const bannerTxt = document.getElementById('mapa-historial-banner-texto');
  if (banner) banner.style.display = 'flex';
  if (bannerTxt) bannerTxt.textContent = `Mapa histórico: ${cid}${fechaFormat ? ' (' + fechaFormat + ')' : ''}`;

  renderListaHallazgos(items, true);
  dibujarPinesEnMapa(items);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.volverAMapaConsultaActual = async () => {
  if (!consultaActiva) return;
  await cargarMapaConsulta(consultaActiva.Consulta_id);
};
window.renderHistorialMapasAnteriores = renderHistorialMapasAnteriores;

function dibujarPinesEnMapa(hallazgos) {
  const containerIzq = document.getElementById('izq-pines-container');
  const containerDer = document.getElementById('der-pines-container');
  if (!containerIzq || !containerDer) return;

  containerIzq.innerHTML = '';
  containerDer.innerHTML = '';

  // Coordenadas anatómicas predeterminadas para los pines según la zona
  const mapaCoordenadas = {
    'talón': { x: 100, y: 255 },
    'calcáneo': { x: 100, y: 255 },
    'arco medial': { x: 115, y: 185 },
    'arco lateral': { x: 65, y: 185 },
    'antepié': { x: 100, y: 115 },
    'metatarso': { x: 100, y: 115 },
    'hallux': { x: 135, y: 40 },
    'dedo 1': { x: 135, y: 40 },
    'dedo 2': { x: 108, y: 48 },
    'dedo 3': { x: 90, y: 54 },
    'dedo 4': { x: 73, y: 62 },
    'dedo 5': { x: 57, y: 72 }
  };

  hallazgos.forEach(h => {
    const zonaLower = String(h.zona_pie || '').toLowerCase();
    const esPieIzquierdo = zonaLower.includes('izquierdo');
    const targetGroup = esPieIzquierdo ? containerIzq : containerDer;

    let coord = { x: 100, y: 150 };

    for (const [clave, c] of Object.entries(mapaCoordenadas)) {
      if (zonaLower.includes(clave)) {
        coord = { ...c };
        // Si es pie derecho, invertir la X para simetría
        if (!esPieIzquierdo) {
          coord.x = 200 - c.x;
        }
        break;
      }
    }

    // Agregar ligera variación para que varios hallazgos en la misma zona no se solapen exactamente
    const jitterX = (Math.random() - 0.5) * 12;
    const jitterY = (Math.random() - 0.5) * 12;
    const finalX = coord.x + jitterX;
    const finalY = coord.y + jitterY;

    // Crear elemento pin SVG con pulso
    const pinGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    pinGroup.setAttribute('class', 'lesion-pin');
    pinGroup.setAttribute('data-id', h.Mapa_id);

    pinGroup.innerHTML = `
      <circle cx="${finalX}" cy="${finalY}" r="12" fill="rgba(236, 72, 153, 0.25)" class="pin-pulse" />
      <circle cx="${finalX}" cy="${finalY}" r="5" fill="#f43f5e" stroke="#fff" stroke-width="1.5" />
      <title>${escapeHtml(h.tipo_lesion)} - ${escapeHtml(h.zona_pie)} (${escapeHtml(h.observaciones || '')})</title>
    `;

    pinGroup.addEventListener('click', () => {
      AppAuth.showToast(`Hallazgo: ${h.tipo_lesion} en ${h.zona_pie}`, 'info');
    });

    targetGroup.appendChild(pinGroup);
  });
}

window.eliminarHallazgoMapa = async (mapaId) => {
  const res = await AppAuth.fetchApi(`/api/medico/mapa/${mapaId}`, { method: 'DELETE' });
  if (res.ok) {
    AppAuth.showToast('Hallazgo eliminado del mapa', 'info');
    if (consultaActiva) cargarMapaConsulta(consultaActiva.Consulta_id);
  }
};

/**
 * =========================================================================
 * 4. COMPROBACIÓN DE AUDITORÍA Y SEGURIDAD RBAC EN VIVO (PODÓLOGO)
 * =========================================================================
 */
function configurarPruebasSeguridadRBAC() {
  const btnPagos = document.getElementById('btn-probar-bloqueo-pagos');
  const btnInv = document.getElementById('btn-probar-bloqueo-inventario');
  const box = document.getElementById('resultado-bloqueo-podo-box');
  const jsonPre = document.getElementById('resultado-bloqueo-podo-json');

  btnPagos?.addEventListener('click', async () => {
    btnPagos.disabled = true;
    const res = await AppAuth.fetchApi('/api/medico/prueba-bloqueo/pagos', {
      method: 'POST',
      body: JSON.stringify({ monto: 500, metodo_pago: 'Efectivo' })
    });
    btnPagos.disabled = false;

    if (box && jsonPre) {
      box.style.display = 'block';
      jsonPre.textContent = JSON.stringify({
        intento: 'Modificación de Pagos desde Podólogo (Rol 4)',
        http_status: res.status,
        estado: res.status === 403 ? '403 Forbidden (BLOQUEADO CORRECTAMENTE)' : res.status,
        middleware_activado: 'bloquearPagosInventarioParaPodologo',
        respuesta_servidor: res.data
      }, null, 2);
    }
  });

  btnInv?.addEventListener('click', async () => {
    btnInv.disabled = true;
    const res = await AppAuth.fetchApi('/api/medico/prueba-bloqueo/inventario', {
      method: 'POST',
      body: JSON.stringify({ nombre_articulo: 'Gasas estériles', cantidad_stock: 100 })
    });
    btnInv.disabled = false;

    if (box && jsonPre) {
      box.style.display = 'block';
      jsonPre.textContent = JSON.stringify({
        intento: 'Modificación de Inventario desde Podólogo (Rol 4)',
        http_status: res.status,
        estado: res.status === 403 ? '403 Forbidden (BLOQUEADO CORRECTAMENTE)' : res.status,
        middleware_activado: 'bloquearPagosInventarioParaPodologo',
        respuesta_servidor: res.data
      }, null, 2);
    }
  });
}

function cargarLogoPodologoDataURL(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 128;
        canvas.height = img.naturalHeight || 128;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

window.descargarRecetaPorId = async (folioEncoded) => {
  const folio = decodeURIComponent(folioEncoded);
  const receta = recetasConsultaCache.find(r => String(r.Receta_id || r.folio) === String(folio))
    || recetasPacienteCache.find(r => String(r.Receta_id || r.folio) === String(folio));
  if (!receta) {
    AppAuth.showToast('No se encontró la receta para descargar.', 'warning');
    return;
  }
  await generarRecetaPDF(receta);
};

window.descargarRecetaHistorial = window.descargarRecetaPorId;

/**
 * Genera y descarga el PDF oficial de la Receta Médica (doble talón con corte en hoja carta)
 */
async function generarRecetaPDF(receta) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    AppAuth.showToast('El generador de PDF aún está cargando, intenta nuevamente en un segundo.', 'warning');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth(); // 215.9 mm
  const pageH = doc.internal.pageSize.getHeight(); // 279.4 mm
  const halfH = pageH / 2; // 139.7 mm
  const margin = 16;
  const rightX = pageW - margin;

  const user = AppAuth.getCurrentUser() || {};
  const podNombre = user.nombre_completo || (user.nombre ? `${obtenerTituloProfesional(user.nombre)} ${user.nombre} ${user.ape_paterno || ''} ${user.ape_materno || ''}`.trim() : 'Especialista en Podología');
  const podCedula = user.cedula || user.Cedula_podologo || 'Registrada';
  const clinicaNombre = user.clinica_nombre || consultaActiva?.clinica_nombre || 'Elite Foot Care';
  const clinicaDir = user.clinica_direccion || 'Tecámac, Estado de México';
  const turnoCode = String(user.turno || 'C').toUpperCase();
  const horarioTexto = turnoCode === 'M'
    ? 'Horario de Lunes a Sábado: 9:00 a 14:00 hrs'
    : turnoCode === 'V'
      ? 'Horario de Lunes a Sábado: 14:00 a 19:00 hrs'
      : 'Horario de Lunes a Sábado: 9:00 a 19:00 hrs';

  const p = pacienteActivo || {};
  const pacNombre = p.nombre_completo || consultaActiva?.paciente_nombre || 'Paciente';
  const pacExp = p.No_expediente || consultaActiva?.fk_no_expediente || '—';
  const pacEdad = p.edad ? `${p.edad} años` : (consultaActiva?.paciente_edad ? `${consultaActiva.paciente_edad} años` : '—');
  const pesoVal = document.getElementById('exp-peso')?.value || consultaActiva?.Peso || '';
  const tallaVal = document.getElementById('exp-altura')?.value || consultaActiva?.Altura || '';
  const pesoTxt = pesoVal ? `${pesoVal} kg` : '—';
  const tallaTxt = tallaVal ? `${tallaVal} m` : '—';

  const fechaObj = receta.fecha_emision ? new Date(receta.fecha_emision) : new Date();
  const fechaTxt = fechaObj.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const folio = receta.Receta_id || receta.folio || 'RX-000';
  const meds = Array.isArray(receta.medicamentos) && receta.medicamentos.length > 0 ? receta.medicamentos : (receta.detalles || []);
  const logoData = await cargarLogoPodologoDataURL('/assets/icons/favicon-podologo.png?v=2');

  const dibujarTalon = (offsetY) => {
    // 1. Logo a la izquierda
    if (logoData) {
      doc.addImage(logoData, 'PNG', margin + 4, offsetY + 9, 19, 19);
    }

    // 2. Encabezado médico en azul institucional (#1e3a8a)
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(14);
    doc.text(podNombre, pageW / 2 + 4, offsetY + 13, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Especialista en Podología Clínica · Elite Foot Care', pageW / 2 + 4, offsetY + 18, { align: 'center' });
    doc.text(`Cédula Profesional: ${podCedula}`, pageW / 2 + 4, offsetY + 22, { align: 'center' });
    doc.text(`${clinicaNombre} · ${clinicaDir}`, pageW / 2 + 4, offsetY + 26, { align: 'center' });

    // Folio discreto arriba a la derecha
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Folio: ${folio}`, rightX, offsetY + 10, { align: 'right' });

    // 3. Líneas de datos del paciente
    let y = offsetY + 36;
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.45);
    doc.setFontSize(8.5);

    // Fila 1: NOMBRE y FECHA
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.text('NOMBRE:', margin, y);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(String(pacNombre).toUpperCase(), margin + 18, y);
    doc.line(margin + 17, y + 1.2, 146, y + 1.2);

    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.text('FECHA:', 150, y);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(fechaTxt, 165, y);
    doc.line(164, y + 1.2, rightX, y + 1.2);

    // Fila 2: PESO, TALLA, EDAD, EXP
    y += 7;
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.text('PESO:', margin, y);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(pesoTxt, margin + 12, y);
    doc.line(margin + 11, y + 1.2, 54, y + 1.2);

    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.text('TALLA:', 58, y);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(tallaTxt, 71, y);
    doc.line(70, y + 1.2, 98, y + 1.2);

    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.text('EDAD:', 102, y);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(pacEdad, 114, y);
    doc.line(113, y + 1.2, 146, y + 1.2);

    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.text('EXP.:', 150, y);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(`#${pacExp}`, 162, y);
    doc.line(161, y + 1.2, rightX, y + 1.2);

    // 4. Cuerpo RX:
    y += 9;
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('RX:', margin, y);

    y += 5.5;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8.5);
    meds.forEach((m, idx) => {
      if (y > offsetY + halfH - 30) return;
      doc.setFont('helvetica', 'bold');
      const lineaMed = `${idx + 1}. ${m.medicamento || ''} — ${m.dosis || ''}`;
      doc.text(lineaMed, margin + 4, y, { maxWidth: rightX - margin - 6 });
      y += 4;
      doc.setFont('helvetica', 'normal');
      const detalleMed = `   Vía: ${m.via_administracion || m.via || 'Tópica'}  |  Frecuencia: ${m.frecuencia || 'Cada 12 horas'}  |  Duración: ${m.duracion || '7 días'}`;
      doc.text(detalleMed, margin + 4, y, { maxWidth: rightX - margin - 6 });
      y += 5;
    });

    if (receta.indicaciones_generales && y <= offsetY + halfH - 24) {
      y += 1;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 58, 138);
      doc.text('Indicaciones:', margin + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const indWrapped = doc.splitTextToSize(String(receta.indicaciones_generales), rightX - margin - 28);
      doc.text(indWrapped.slice(0, 3), margin + 27, y);
    }

    // 5. Pie de receta
    const footY = offsetY + halfH - 18;
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.text(horarioTexto, margin + 4, footY);
    if (user.clinica_telefono) {
      doc.text(`Tel. Sede: ${user.clinica_telefono}`, margin + 4, footY + 4);
    }

    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.45);
    doc.line(138, footY - 1, rightX - 4, footY - 1);
    doc.setFont('helvetica', 'bold');
    doc.text('FIRMA DEL MÉDICO / PODÓLOGO', (138 + rightX - 4) / 2, footY + 3.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('FAVOR DE TRAER SU RECETA EN LA PRÓXIMA CITA', pageW / 2, offsetY + halfH - 6, { align: 'center' });
  };

  // Dibujar talón superior (Original Paciente)
  dibujarTalon(0);

  // Línea punteada de corte al centro de la hoja
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.35);
  doc.setLineDashPattern([3, 2], 0);
  doc.line(6, halfH, pageW - 6, halfH);
  doc.setLineDashPattern([], 0);

  // Dibujar talón inferior (Copia Clínica)
  dibujarTalon(halfH);

  doc.save(`Receta_${folio}_Exp_${pacExp}.pdf`);
}
window.generarRecetaPDF = generarRecetaPDF;

/**
 * Busca un paciente por No. de Expediente y muestra tarjeta profesional para atenderlo sin cita previa
 */
async function buscarPacientePorExpedienteParaAtender(expediente) {
  const box = document.getElementById('resultado-busqueda-paciente-box');
  if (!box) return;

  box.style.display = 'block';
  box.innerHTML = `
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px 20px; text-align: center; color: #64748b;">
      <i class="fa-solid fa-spinner fa-spin"></i> Buscando expediente #${escapeHtml(expediente)}...
    </div>
  `;

  const res = await AppAuth.fetchApi(`/api/medico/expediente/${encodeURIComponent(expediente)}`);
  if (!res.ok || !res.data?.paciente) {
    box.innerHTML = `
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 16px; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div style="color: #b91c1c; font-size: 0.9rem;">
          <i class="fa-solid fa-circle-xmark"></i> No se encontró ningún paciente registrado con el expediente <strong>#${escapeHtml(expediente)}</strong>.
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('resultado-busqueda-paciente-box').style.display='none'">Cerrar</button>
      </div>
    `;
    return;
  }

  const p = res.data.paciente;
  const consultas = res.data.consultas || [];
  const ultima = consultas.find(c => c.estado === 'Completada' || c.estado === 'Finalizada') || consultas[0];
  const ultimaFecha = ultima?.fecha_hora
    ? new Date(ultima.fecha_hora).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Sin visitas previas';
  const sexoTxt = p.Sexo === 'F' ? 'Femenino' : p.Sexo === 'M' ? 'Masculino' : (p.Sexo || 'N/D');

  const enCurso = obtenerConsultaEnAtencion();
  const bloqueadoPorConsulta = Boolean(enCurso);

  box.innerHTML = `
    <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 18px; padding: 20px 22px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
        <div style="display: flex; gap: 14px; align-items: center;">
          <div style="width: 48px; height: 48px; border-radius: 14px; background: #0f172a; color: #ffffff; display: grid; place-items: center; font-size: 1.2rem; flex-shrink: 0;">
            <i class="fa-solid fa-user-check"></i>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <h3 style="margin: 0; font-size: 1.08rem; font-weight: 800; color: #0f172a;">${escapeHtml(p.nombre_completo || `${p.Nombres} ${p.ape_paterno}`)}</h3>
              <span style="background: #f1f5f9; color: #0f172a; font-size: 0.76rem; font-weight: 700; padding: 3px 10px; border-radius: 999px;">Exp. #${escapeHtml(p.No_expediente)}</span>
              ${p.es_diabetico ? '<span class="badge-risk diabetic"><i class="fa-solid fa-triangle-exclamation"></i> Diabético</span>' : ''}
              ${p.es_hipertenso ? '<span class="badge-risk hypertensive"><i class="fa-solid fa-heart-pulse"></i> Hipertenso</span>' : ''}
            </div>
            <div style="font-size: 0.84rem; color: #475569; margin-top: 4px;">
              ${p.edad ? `${escapeHtml(p.edad)} años` : 'N/D'} · ${escapeHtml(sexoTxt)} · Tel: ${escapeHtml(p.telefono || 'Sin tel')} · Última visita: <strong>${escapeHtml(ultimaFecha)}</strong>
            </div>
          </div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('resultado-busqueda-paciente-box').style.display='none'" title="Cerrar búsqueda" style="border-radius: 999px;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      ${
        bloqueadoPorConsulta
          ? `
            <div style="margin-top: 14px; padding: 10px 14px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; color: #b45309; font-size: 0.84rem; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
              <span><i class="fa-solid fa-lock"></i> Ya tienes en atención a <strong>${escapeHtml(enCurso.paciente_nombre || 'un paciente')}</strong> (${escapeHtml(enCurso.Consulta_id)}). Finaliza la consulta actual para poder atender a otro paciente.</span>
            </div>
          `
          : `
            <div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid #f1f5f9; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
              <input type="text" id="input-motivo-sin-cita" class="form-control" style="flex: 1; min-width: 240px;" placeholder="Motivo de atención (opcional, ej. Quiropodía sin cita previa)">
              <button type="button" id="btn-atender-ahora-sin-cita" class="btn btn-success" onclick="atenderPacienteSinCita('${escapeHtml(String(p.No_expediente))}')" style="border-radius: 999px; padding: 0.6rem 1.35rem; font-weight: 700;">
                <i class="fa-solid fa-stethoscope"></i> Atender Ahora (Crear Consulta)
              </button>
            </div>
          `
      }
    </div>
  `;
}

window.atenderPacienteSinCita = async (expediente) => {
  const enCurso = obtenerConsultaEnAtencion();
  if (enCurso) {
    AppAuth.showToast(`Ya estás atendiendo a ${enCurso.paciente_nombre || 'un paciente'}. Finaliza la consulta actual primero.`, 'warning');
    return;
  }

  const btn = document.getElementById('btn-atender-ahora-sin-cita');
  const motivo = document.getElementById('input-motivo-sin-cita')?.value.trim() || '';

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Iniciando consulta...';
  }

  try {
    const res = await AppAuth.fetchApi('/api/medico/consultas/sin-cita', {
      method: 'POST',
      body: JSON.stringify({
        no_expediente: expediente,
        motivo_o_notas: motivo
      })
    });

    if (!res.ok || !res.data?.consulta) {
      AppAuth.showToast(res.data?.error || 'No se pudo iniciar la consulta sin cita', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-stethoscope"></i> Atender Ahora (Crear Consulta)';
      }
      return;
    }

    const nuevaConsulta = res.data.consulta;
    consultaActiva = nuevaConsulta;

    const box = document.getElementById('resultado-busqueda-paciente-box');
    if (box) box.style.display = 'none';

    await cargarExpedientePaciente(expediente);
    await cargarMapaConsulta(nuevaConsulta.Consulta_id);
    await cargarAgendaPersonal();
    actualizarIndicadorMapa(nuevaConsulta);

    AppAuth.showToast(`Consulta ${nuevaConsulta.Consulta_id} iniciada para ${nuevaConsulta.paciente_nombre}`, 'success');
  } catch (err) {
    AppAuth.showToast('Error de conexión al iniciar consulta', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-stethoscope"></i> Atender Ahora (Crear Consulta)';
    }
  }
};
