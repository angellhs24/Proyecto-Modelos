/**
 * LÓGICA DE AGENDAMIENTO Y NAVEGACIÓN - PODOLOGÍA PROFESIONAL
 * Portal público para pacientes y clientes
 */

// Resolución dinámica del backend en puerto 4000
function getApiBaseUrl() {
  if (typeof window === 'undefined') return 'http://localhost:4000';
  if (window.location.port === '4000') return '';
  const hostname = window.location.hostname || 'localhost';
  return `http://${hostname}:4000`;
}

const API_BASE = `${getApiBaseUrl()}/api`;

// Estado global de la cita en curso
let estadoBooking = {
  esPacienteRegistrado: false,
  pacienteVerificado: null,
  clinicas: [],
  servicioSeleccionado: ''
};

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializar fecha mínima en el selector (hoy)
  const hoy = new Date().toISOString().split('T')[0];
  const inputFecha = document.getElementById('booking-fecha');
  if (inputFecha) {
    inputFecha.min = hoy;
    inputFecha.value = hoy;
  }

  // 2. Cargar lista de sedes clínicas activas desde el backend
  await cargarSedesClinicas();

  // 3. Configurar listeners de navegación y botones
  configurarNavegacion();
  configurarModalAgendar();
  configurarTabsTipoPaciente();
  configurarBusquedaExpediente();
  configurarFormularioCita();
  configurarTestimonios();

  // 4. Si la URL contiene #agendar, abrir modal automáticamente
  if (window.location.hash === '#agendar') {
    setTimeout(() => abrirModalAgendar(), 150);
  }
});

/**
 * Carga las sedes clínicas desde la base de datos MySQL
 */
async function cargarSedesClinicas() {
  try {
    const res = await fetch(`${API_BASE}/clinicas`);
    if (res.ok) {
      const data = await res.json();
      estadoBooking.clinicas = data || [];
      poblarSelectSedes(estadoBooking.clinicas);
    }
  } catch (error) {
    console.warn('Usando catálogo local de sedes clínicas:', error.message);
    estadoBooking.clinicas = [
      { Clinica_id: 14, Nombre: 'DIF Lomas de Tecámac', Telefono: '5560229842', Calle_clinica: 'Av. Constitución' },
      { Clinica_id: 28, Nombre: 'Casa Héroes Tecámac', Telefono: '5515311359', Calle_clinica: 'Av. Felipe Villanueva' },
      { Clinica_id: 35, Nombre: 'Casa Adulto Mayor Flores', Telefono: '5559388260', Calle_clinica: 'Av. Las Flores' }
    ];
    poblarSelectSedes(estadoBooking.clinicas);
  }
}

function poblarSelectSedes(clinicas) {
  const select = document.getElementById('booking-sede');
  if (!select) return;

  select.innerHTML = '<option value="">-- Selecciona una Sede Clínica --</option>';
  clinicas.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.Clinica_id || c.id_clinica;
    opt.textContent = `${c.Nombre || c.nombre} (${c.Calle_clinica || c.direccion || 'Tecámac'})`;
    opt.dataset.telefono = c.Telefono || c.telefono || '5560229842';
    select.appendChild(opt);
  });

  // Seleccionar la primera por defecto
  if (clinicas.length > 0) {
    select.value = clinicas[0].Clinica_id || clinicas[0].id_clinica;
  }
}

/**
 * Navegación suave y scroll
 */
function configurarNavegacion() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId && targetId !== '#') {
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

  // Sombra en navbar al hacer scroll
  const header = document.querySelector('.navbar-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  });
}

/**
 * Control del Modal de Agendamiento
 */
function configurarModalAgendar() {
  const modal = document.getElementById('modal-agendar');

  // Botones para abrir modal
  document.querySelectorAll('.btn-abrir-agendar').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const servicio = btn.dataset.servicio || '';
      abrirModalAgendar(servicio);
    });
  });

  // Cerrar al hacer clic en el backdrop
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      cerrarModalAgendar();
    }
  });
}

function abrirModalAgendar(servicioDefault = '') {
  const modal = document.getElementById('modal-agendar');
  if (!modal) return;

  // Reset de vistas
  document.getElementById('booking-form-view').style.display = 'block';
  document.getElementById('booking-success-view').classList.remove('active');

  // Pre-seleccionar servicio si viene indicado
  if (servicioDefault) {
    const selectServicio = document.getElementById('booking-servicio');
    if (selectServicio) selectServicio.value = servicioDefault;
  }

  // Abrir modal nativo
  if (typeof modal.showModal === 'function') {
    modal.showModal();
  }
}

function cerrarModalAgendar() {
  const modal = document.getElementById('modal-agendar');
  if (modal && typeof modal.close === 'function') {
    modal.close();
  }
}

/**
 * Alternar entre modo "Expediente Existente" y "Paciente Nuevo"
 */
function configurarTabsTipoPaciente() {
  const tabExp = document.getElementById('tab-modo-expediente');
  const tabNuevo = document.getElementById('tab-modo-nuevo');
  const grupoExpediente = document.getElementById('seccion-expediente-input');
  const grupoDatosNuevos = document.getElementById('seccion-datos-nuevos');
  const bannerVerificado = document.getElementById('banner-paciente-verificado');

  tabExp?.addEventListener('click', () => {
    tabExp.classList.add('active');
    tabNuevo.classList.remove('active');
    estadoBooking.esPacienteRegistrado = true;

    grupoExpediente.style.display = 'block';
    grupoDatosNuevos.style.display = 'none';

    // Desactivar required en campos de nuevo paciente
    document.getElementById('booking-nombre').removeAttribute('required');
    document.getElementById('booking-paterno').removeAttribute('required');
    document.getElementById('booking-telefono-nuevo').removeAttribute('required');

    // Activar required en expediente
    document.getElementById('booking-expediente-input').setAttribute('required', 'true');
  });

  tabNuevo?.addEventListener('click', () => {
    tabNuevo.classList.add('active');
    tabExp.classList.remove('active');
    estadoBooking.esPacienteRegistrado = false;
    estadoBooking.pacienteVerificado = null;

    grupoExpediente.style.display = 'none';
    grupoDatosNuevos.style.display = 'block';
    bannerVerificado.classList.remove('active');

    // Desactivar required en expediente
    document.getElementById('booking-expediente-input').removeAttribute('required');

    // Activar required en campos nuevos
    document.getElementById('booking-nombre').setAttribute('required', 'true');
    document.getElementById('booking-paterno').setAttribute('required', 'true');
    document.getElementById('booking-telefono-nuevo').setAttribute('required', 'true');
  });
}

/**
 * Búsqueda y validación de expediente
 */
function configurarBusquedaExpediente() {
  const btnBuscar = document.getElementById('btn-buscar-expediente');
  const inputExp = document.getElementById('booking-expediente-input');
  const bannerVerificado = document.getElementById('banner-paciente-verificado');
  const labelNombreVerificado = document.getElementById('verificado-nombre-paciente');
  const labelDetalleVerificado = document.getElementById('verificado-detalle-paciente');

  async function buscarExpediente() {
    const exp = inputExp.value.trim();
    if (!exp) {
      alert('Por favor ingresa tu número de expediente.');
      return;
    }

    btnBuscar.disabled = true;
    btnBuscar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Buscando...';

    try {
      const res = await fetch(`${API_BASE}/pacientes/${exp}`);
      if (res.ok) {
        const paciente = await res.json();
        estadoBooking.pacienteVerificado = paciente;

        labelNombreVerificado.textContent = paciente.nombre_completo || `${paciente.Nombres} ${paciente.ape_paterno}`;
        labelDetalleVerificado.textContent = `Expediente #${paciente.No_expediente || exp} • Teléfono: ${paciente.telefono || 'Sin teléfono'}`;
        bannerVerificado.classList.add('active');
      } else {
        estadoBooking.pacienteVerificado = null;
        bannerVerificado.classList.remove('active');
        if (confirm(`No encontramos el expediente #${exp}. ¿Deseas registrarte como paciente nuevo para apartar tu cita?`)) {
          document.getElementById('tab-modo-nuevo').click();
        }
      }
    } catch (err) {
      alert('Hubo un inconveniente al conectar con la base clínica: ' + err.message);
    } finally {
      btnBuscar.disabled = false;
      btnBuscar.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Validar';
    }
  }

  btnBuscar?.addEventListener('click', buscarExpediente);
  inputExp?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      buscarExpediente();
    }
  });
}

/**
 * Procesar envío del formulario de reserva
 */
function configurarFormularioCita() {
  const form = document.getElementById('form-agendar-cita');
  const btnConfirmar = document.getElementById('btn-confirmar-booking');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const sedeSelect = document.getElementById('booking-sede');
    const clinicaId = parseInt(sedeSelect.value, 10) || 14;
    const clinicaNombre = sedeSelect.selectedOptions[0]?.text.split('(')[0].trim() || 'DIF Lomas de Tecámac';
    const clinicaTel = sedeSelect.selectedOptions[0]?.dataset.telefono || '5560229842';

    const servicio = document.getElementById('booking-servicio').value;
    const fecha = document.getElementById('booking-fecha').value;
    const hora = document.getElementById('booking-hora').value;
    const notas = document.getElementById('booking-motivo').value.trim();

    let payload = {
      clinica_id: clinicaId,
      fk_clinica_id: clinicaId,
      fecha,
      hora,
      motivo: `${servicio} - ${notas || 'Consulta agendada desde web pública'}`
    };

    if (estadoBooking.esPacienteRegistrado) {
      const exp = document.getElementById('booking-expediente-input').value.trim();
      if (!exp) {
        alert('Por favor ingresa tu número de expediente.');
        return;
      }
      payload.fk_no_expediente = exp;
      payload.expediente = exp;
    } else {
      // Paciente nuevo
      const nombres = document.getElementById('booking-nombre').value.trim();
      const paterno = document.getElementById('booking-paterno').value.trim();
      const materno = document.getElementById('booking-materno').value.trim();
      const telefono = document.getElementById('booking-telefono-nuevo').value.trim();
      const esDiabetico = document.getElementById('booking-check-diabetico').checked;
      const esHipertenso = document.getElementById('booking-check-hipertenso').checked;

      payload.nombres = nombres;
      payload.ape_paterno = paterno;
      payload.ape_materno = materno;
      payload.nombre_completo = `${nombres} ${paterno} ${materno}`.trim();
      payload.telefono = telefono;
      payload.es_diabetico = esDiabetico ? 1 : 0;
      payload.es_hipertenso = esHipertenso ? 1 : 0;
    }

    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando Cita...';

    try {
      const res = await fetch(`${API_BASE}/citas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        mostrarConfirmacionExito({
          folio: data.Consulta_id || data.id_cita || 'CON-' + Math.floor(1000 + Math.random() * 9000),
          expediente: data.no_expediente || payload.fk_no_expediente || 'Nuevo',
          paciente: data.paciente?.nombre || payload.nombre_completo || 'Paciente',
          sede: clinicaNombre,
          telefonoSede: clinicaTel,
          fecha,
          hora,
          servicio
        });
      } else {
        alert(data.error || 'No se pudo registrar la cita. Por favor verifica tus datos.');
      }
    } catch (err) {
      alert('Error al comunicarse con la clínica: ' + err.message);
    } finally {
      btnConfirmar.disabled = false;
      btnConfirmar.innerHTML = '<i class="fa-solid fa-calendar-check"></i> Confirmar Reservación de Cita';
    }
  });
}

/**
 * Despliega la pantalla de éxito con folio y enlace directo a WhatsApp
 */
function mostrarConfirmacionExito(detalles) {
  document.getElementById('booking-form-view').style.display = 'none';
  const successView = document.getElementById('booking-success-view');
  successView.classList.add('active');

  document.getElementById('recibo-folio').textContent = detalles.folio;
  document.getElementById('recibo-expediente').textContent = `#${detalles.expediente}`;
  document.getElementById('recibo-paciente').textContent = detalles.paciente;
  document.getElementById('recibo-sede').textContent = detalles.sede;
  document.getElementById('recibo-fecha-hora').textContent = `${detalles.fecha} a las ${detalles.hora}`;
  document.getElementById('recibo-servicio').textContent = detalles.servicio;

  // Botón directo a WhatsApp de la clínica
  const btnWhatsApp = document.getElementById('btn-whatsapp-confirmacion');
  if (btnWhatsApp) {
    const telLimpio = detalles.telefonoSede.replace(/\D/g, '');
    const telMex = telLimpio.length === 10 ? `52${telLimpio}` : telLimpio;
    const msg = `¡Hola! Acabo de reservar mi cita en Podología Profesional con el folio *${detalles.folio}* (Expediente #${detalles.expediente}) a nombre de *${detalles.paciente}* para el día *${detalles.fecha}* a las *${detalles.hora}* en la sede *${detalles.sede}* para el servicio de *${detalles.servicio}*. ¿Me podrían confirmar por favor?`;
    btnWhatsApp.href = `https://api.whatsapp.com/send?phone=${telMex}&text=${encodeURIComponent(msg)}`;
  }
}

/**
 * Control interactivo de testimonios y dots
 */
function configurarTestimonios() {
  const dots = document.querySelectorAll('.carousel-dot');
  const cards = document.querySelectorAll('.testimonio-card');

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      dots.forEach((d) => d.classList.remove('active'));
      dot.classList.add('active');

      cards.forEach((card, i) => {
        if (i === index) {
          card.classList.add('highlight');
        } else {
          card.classList.remove('highlight');
        }
      });
    });
  });
}

// Exponer funciones globales
window.abrirModalAgendar = abrirModalAgendar;
window.cerrarModalAgendar = cerrarModalAgendar;
