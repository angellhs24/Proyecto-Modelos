/**
 * LÓGICA DE VANILLA JS: CONSULTORIO PODOLÓGICO (ROL ID: 4)
 * Elite Foot Care - Agenda Personal, Expediente Clínico y Mapa Podológico Interactivo
 */
const escapeHtml = window.escapeHtml || ((str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
});

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

  // 2. Control de Pestañas Material 3
  inicializarNavegacionTabs();

  // 3. Cargar Agenda Personal
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
let hallazgosMapaCache = [];
let vistaPieActual = 'plantar'; // 'plantar' | 'dorsal'
let zonaSeleccionadaActual = null;

/**
 * Actualiza el chip de perfil del médico
 */
function actualizarUIPodologo(user) {
  if (!user) return;
  const nameEl = document.getElementById('podo-display-name');
  const roleEl = document.getElementById('podo-role-text');
  const cedulaIndicador = document.getElementById('cedula-sesion-indicador');
  const avatarEl = document.getElementById('podo-avatar-initials');

  const nombre = user.nombre || user.perfil?.Nombre || 'Carlos';
  const ape = user.ape_paterno || user.perfil?.ape_paterno || 'Pérez';
  const cedula = user.cedula || user.Cedula_podologo || user.perfil?.Cedula_podologo || 'CED12345678';

  if (nameEl) nameEl.textContent = `Dr. ${nombre} ${ape}`.trim();
  if (roleEl) roleEl.textContent = `Cédula: ${cedula} • Rol ID: 4`;
  if (cedulaIndicador) cedulaIndicador.textContent = cedula;
  if (avatarEl) avatarEl.textContent = `${nombre[0] || 'C'}${ape[0] || 'P'}`;
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

function cambiarPestana(tabId) {
  const btn = document.querySelector(`.nav-tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.click();
}

/**
 * =========================================================================
 * 1. AGENDA PERSONAL (SOLO SUS CONSULTAS ASIGNADAS)
 * =========================================================================
 */
async function cargarAgendaPersonal() {
  const tbody = document.getElementById('tabla-agenda-personal-body');
  if (!tbody) return;

  const fecha = document.getElementById('podo-filtro-fecha')?.value || '';
  const estado = document.getElementById('podo-filtro-estado')?.value || '';

  const params = new URLSearchParams();
  if (fecha) params.append('fecha', fecha);
  if (estado) params.append('estado', estado);

  const res = await AppAuth.fetchApi(`/api/medico/agenda?${params.toString()}`);

  if (res.ok && Array.isArray(res.data)) {
    misCitasCache = res.data;
    renderTablaAgendaPersonal(res.data);
    actualizarKPIsAgendaPersonal(res.data);
  } else {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--color-danger); padding: 1.5rem;">Error al cargar la agenda personal del podólogo</td></tr>`;
  }
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
      'Programada': 'badge-programada',
      'En espera': 'badge-atencion',
      'En atención': 'badge-atencion',
      'Finalizada': 'badge-finalizada',
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
        <td>
          <button class="btn btn-accent btn-sm" onclick="iniciarAtencionConsulta('${safeConsultaId}')">
            <i class="fa-solid fa-notes-medical"></i> Atender Paciente
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function actualizarKPIsAgendaPersonal(citas) {
  const kpiTotal = document.getElementById('kpi-mis-citas-total');
  const kpiEspera = document.getElementById('kpi-mis-citas-espera');
  const kpiAtencion = document.getElementById('kpi-mis-citas-atencion');
  const kpiFin = document.getElementById('kpi-mis-citas-finalizadas');

  if (kpiTotal) kpiTotal.textContent = citas.length;
  if (kpiEspera) kpiEspera.textContent = citas.filter(c => c.estado === 'Programada' || c.estado === 'En espera').length;
  if (kpiAtencion) kpiAtencion.textContent = citas.filter(c => c.estado === 'En atención').length;
  if (kpiFin) kpiFin.textContent = citas.filter(c => c.estado === 'Finalizada').length;
}

function configurarEventosAgendaPersonal() {
  document.getElementById('podo-filtro-fecha')?.addEventListener('change', cargarAgendaPersonal);
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
      consultaActiva.estado = 'Finalizada';
      actualizarHUDPaciente(pacienteActivo, consultaActiva);
      cargarAgendaPersonal();
    }
  });
}

/**
 * Atender Paciente: Carga la consulta y paciente en turnos
 */
window.iniciarAtencionConsulta = async (consultaId) => {
  const cita = misCitasCache.find(c => c.Consulta_id === consultaId);
  if (!cita) return;

  consultaActiva = cita;

  // Cambiar estado a 'En atención' si estaba programada
  if (cita.estado === 'Programada' || cita.estado === 'En espera') {
    await AppAuth.fetchApi(`/api/medico/consultas/${consultaId}/estado`, {
      method: 'PUT',
      body: JSON.stringify({ estado: 'En atención' })
    });
    cita.estado = 'En atención';
  }

  // Cargar expediente completo del paciente
  await cargarExpedientePaciente(cita.fk_no_expediente);

  // Cargar mapa podológico de esta consulta
  await cargarMapaConsulta(consultaId);

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

  if (!paciente || !consulta) {
    hud.style.display = 'none';
    return;
  }

  hud.style.display = 'flex';
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

  document.getElementById('sin-paciente-alerta').style.display = 'none';
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

  // Cargar tablas secundarias de la consulta activa
  if (consultaActiva) {
    await Promise.all([
      cargarDiagnosticosConsulta(consultaActiva.Consulta_id),
      cargarTratamientosConsulta(consultaActiva.Consulta_id),
      cargarRecetasConsulta(consultaActiva.Consulta_id)
    ]);
  }
}

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
  // Búsqueda manual de expediente
  document.getElementById('btn-cargar-expediente-manual')?.addEventListener('click', () => {
    const exp = document.getElementById('input-buscar-expediente').value;
    if (exp) cargarExpedientePaciente(exp);
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
      const res = await AppAuth.fetchApi('/api/recetas', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.ok && res.data) {
        AppAuth.showToast(`¡Receta médica emitida con éxito! Folio: ${res.data.folio || res.data.Receta_id}`, 'success');
        document.getElementById('receta-indicaciones').value = '';
        inicializarFormularioRecetaDinamica(); // Reiniciar a 1 fila vacía
        cargarRecetasConsulta(consultaActiva.Consulta_id);

        // Ofrecer apertura directa del PDF
        const pdfUrl = res.data.url_pdf || `/api/recetas/${res.data.folio || res.data.Receta_id}/pdf`;
        window.open(pdfUrl, '_blank');
      } else {
        const errorMsg = res.error || 'No se pudo emitir la receta médica';
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
        <input type="text" class="form-control med-frecuencia" placeholder="Ej. Cada 12 horas, Cada noche" value="${item.frecuencia || ''}">
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

      const safeTratId = encodeURIComponent(String(t.Tratamiento_id));

      return `
        <tr>
          <td><strong>${escapeHtml(t.procedimiento_servicio)}</strong></td>
          <td>${lat.join(' ') || 'Bilateral'}</td>
          <td>${escapeHtml(t.tratamiento_aplicado || '—')}</td>
          <td>${escapeHtml(t.frecuencia || '—')}</td>
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

  const res = await AppAuth.fetchApi(`/api/recetas/consulta/${consultaId}`);
  
  // La API puede retornar un objeto directo de la receta o un array
  let recetas = [];
  if (res.ok && res.data) {
    recetas = Array.isArray(res.data) ? res.data : [res.data];
  }

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
    const pdfUrl = r.url_pdf || `/api/recetas/${encodeURIComponent(folio)}/pdf`;

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
            <button class="btn btn-sm" onclick="window.open('${encodeURI(pdfUrl)}', '_blank')" style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 9999px; padding: 6px 14px; font-weight: 600; font-size: 0.8rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;" title="Ver receta membretada">
              <i class="fa-solid fa-eye"></i> Ver PDF
            </button>
            <button class="btn btn-sm" onclick="window.open('${encodeURI(pdfUrl)}?autoprint=true', '_blank')" style="background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; border-radius: 9999px; padding: 6px 14px; font-weight: 600; font-size: 0.8rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;" title="Imprimir o guardar PDF directamente">
              <i class="fa-solid fa-print"></i> Imprimir / Guardar PDF
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
function configurarMapaPodologicoInteractivo() {
  const zonas = document.querySelectorAll('.foot-zone');

  zonas.forEach(zona => {
    zona.addEventListener('click', (e) => {
      e.stopPropagation();

      // Remover selección previa
      zonas.forEach(z => z.classList.remove('selected'));

      // Activar zona seleccionada
      zona.classList.add('selected');

      const pie = zona.getAttribute('data-pie');
      const nombreZona = zona.getAttribute('data-zona');
      zonaSeleccionadaActual = `${pie} (${vistaPieActual.toUpperCase()}): ${nombreZona}`;

      document.getElementById('display-zona-seleccionada').textContent = zonaSeleccionadaActual;
      document.getElementById('display-zona-ayuda').textContent = 'Zona lista para asociar patología';
      document.getElementById('mapa-zona-pie-valor').value = zonaSeleccionadaActual;

      AppAuth.showToast(`Zona seleccionada: ${nombreZona}`, 'info');
    });
  });

  // Submit registro de lesión en mapa
  const formMapa = document.getElementById('form-registro-mapa');
  formMapa?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!consultaActiva) {
      AppAuth.showToast('Primero debes iniciar o seleccionar una consulta activa en la Agenda', 'warning');
      return;
    }

    const zonaPie = document.getElementById('mapa-zona-pie-valor').value;
    const tipoLesion = document.getElementById('mapa-tipo-lesion').value;
    const observaciones = document.getElementById('mapa-observaciones').value;

    if (!zonaPie) {
      AppAuth.showToast('Por favor selecciona primero una zona en el pie anatómico', 'warning');
      return;
    }

    const payload = {
      zona_pie: zonaPie,
      tipo_lesion: tipoLesion,
      observaciones
    };

    const res = await AppAuth.fetchApi(`/api/medico/consultas/${consultaActiva.Consulta_id}/mapa`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      AppAuth.showToast('¡Hallazgo guardado en el Mapa Podológico!', 'success');
      formMapa.reset();
      document.getElementById('display-zona-seleccionada').textContent = 'Ninguna zona seleccionada';
      document.getElementById('mapa-zona-pie-valor').value = '';
      zonas.forEach(z => z.classList.remove('selected'));

      await cargarMapaConsulta(consultaActiva.Consulta_id);
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

async function cargarMapaConsulta(consultaId) {
  const res = await AppAuth.fetchApi(`/api/medico/consultas/${consultaId}/mapa`);
  if (res.ok && Array.isArray(res.data)) {
    hallazgosMapaCache = res.data;
    renderListaHallazgos(res.data);
    dibujarPinesEnMapa(res.data);
  }
}

function renderListaHallazgos(hallazgos) {
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
      <button class="btn btn-danger-outline btn-sm" onclick="eliminarHallazgoMapa(${encodeURIComponent(String(h.Mapa_id))})" title="Eliminar hallazgo">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
  `).join('');
}

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
