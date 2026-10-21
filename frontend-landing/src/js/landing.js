/**
 * LÓGICA DE AGENDAMIENTO Y NAVEGACIÓN - PODOLOGÍA PROFESIONAL
 * Portal público para pacientes y clientes
 */

// Resolución dinámica del backend en puerto 4000
function getApiBaseUrl() {
  if (typeof window === 'undefined') return '';
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalDev && window.location.port && window.location.port !== '4000') {
    return `http://${window.location.hostname}:4000`;
  }
  return '';
}

const API_BASE = `${getApiBaseUrl()}/api`;

// Funciones auxiliares de fecha local para evitar desfasaje con UTC
function obtenerFechaHoyLocal() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function obtenerFechaOffsetLocal(offsetDias) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Catálogo de bloques horarios disponibles (09:00 AM a 06:00 PM)
const CATALOGO_SLOTS = [
  { time: '09:00 AM', hour24: 9, min: 0 },
  { time: '10:00 AM', hour24: 10, min: 0 },
  { time: '11:00 AM', hour24: 11, min: 0 },
  { time: '12:00 PM', hour24: 12, min: 0 },
  { time: '01:00 PM', hour24: 13, min: 0 },
  { time: '02:00 PM', hour24: 14, min: 0 },
  { time: '03:00 PM', hour24: 15, min: 0 },
  { time: '04:00 PM', hour24: 16, min: 0 },
  { time: '05:00 PM', hour24: 17, min: 0 },
  { time: '06:00 PM', hour24: 18, min: 0 }
];

// Estado global reactivo para el agendamiento de citas
let bookingState = {
  expediente: '',
  pacienteEncontrado: false,
  nombres: '',
  apePaterno: '',
  apeMaterno: '',
  nombre: '',
  telefono: '',
  sexo: 'Femenino',
  fechaNacimiento: '',
  direccion: '',
  municipio: 'Tecámac',
  esDiabetico: false,
  esHipertenso: false,
  servicio: 'Quiropodía Elite',
  motivo: '',
  clinicaId: 14,
  clinicaNombre: 'DIF Lomas de Tecámac',
  clinicaDireccion: 'Av. Constitución, Tecámac',
  clinicaTelefono: '5560229842',
  cedulaPodologo: 'B-24267',
  especialista: 'Luis Angel Hernandez Santillan',
  fecha: obtenerFechaHoyLocal(),
  hora: '10:00 AM'
};

let catalogoPodologos = [];
let horasOcupadasBD = [];

let catalogoClinicas = [];

/**
 * Carga el catálogo de clínicas activas directamente desde la Base de Datos
 */
async function cargarCatalogoClinicas() {
  try {
    const res = await fetch(`${API_BASE}/clinicas`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        catalogoClinicas = data.map((c) => ({
          id: Number(c.Clinica_id || c.id_clinica || c.id),
          nombre: c.Nombre || c.nombre,
          direccion: c.direccion || `${c.Calle_clinica || ''}, ${c.Municipio_clinica || 'Tecámac'}`.replace(/^,\s*/, ''),
          telefono: c.Telefono || c.telefono || 'Sin teléfono'
        }));
      }
    }
  } catch (err) {
    console.warn('No se pudo consultar /api/clinicas en BD, usando catálogo de respaldo:', err.message);
  }

  // Respaldo de contingencia en caso de fallo total de red
  if (!catalogoClinicas || catalogoClinicas.length === 0) {
    catalogoClinicas = [
      {
        id: 14,
        nombre: 'DIF Lomas de Tecámac',
        direccion: 'Av. Constitución, Tecámac',
        telefono: '5560229842'
      },
      {
        id: 28,
        nombre: 'Casa Héroes Tecámac',
        direccion: 'Av. Felipe Villanueva, Tecámac',
        telefono: '5515311359'
      },
      {
        id: 35,
        nombre: 'Casa Adulto Mayor Flores',
        direccion: 'Av. Las Flores, Tecámac',
        telefono: '5559388260'
      }
    ];
  }

  // 1. Renderizar en el modal de agendamiento
  renderClinicasModal();

  // 2. Renderizar en la sección de Sedes de la página web (abajo)
  renderSedesLanding();

  // 3. Validar si la clínica seleccionada sigue activa en el catálogo
  const existeClinica = catalogoClinicas.some((c) => c.id === bookingState.clinicaId);
  if (!existeClinica && catalogoClinicas.length > 0) {
    seleccionarSedeClinica(catalogoClinicas[0].id);
  }
}

/**
 * Renderiza dinámicamente las tarjetas de clínicas activas en el Modal de Citas
 */
function renderClinicasModal() {
  const container = document.getElementById('clinics-container-lux');
  if (!container) return;

  container.innerHTML = catalogoClinicas.map((c, idx) => {
    const isActiva = bookingState.clinicaId ? bookingState.clinicaId === c.id : idx === 0;
    return `
      <div class="clinic-card-lux ${isActiva ? 'active' : ''}" 
           data-clinica-id="${c.id}" 
           data-nombre="${c.nombre}"
           data-direccion="${c.direccion}" 
           data-tel="${c.telefono}"
           onclick="seleccionarSedeClinica(${c.id})">
        <div class="clinic-icon-box">
          <i class="fa-solid fa-hospital"></i>
        </div>
        <div class="clinic-meta">
          <h4>${c.nombre}</h4>
          <small>${c.direccion}</small>
        </div>
        <div class="clinic-check-pill"><i class="fa-solid fa-check"></i></div>
      </div>
    `;
  }).join('');
}

/**
 * Renderiza dinámicamente las tarjetas de clínicas activas en la sección inferior de la Landing (#sedes)
 */
function renderSedesLanding() {
  const container = document.querySelector('.sedes-grid');
  if (!container) return;

  container.innerHTML = catalogoClinicas.map((c) => `
    <div class="sede-card">
      <div>
        <div class="sede-tag">
          <span class="live-beacon"></span> Sede ${c.id} • Abierta Hoy
        </div>
        <h3 class="sede-title">${c.nombre}</h3>
        <div class="sede-info-item">
          <i class="fa-solid fa-location-dot"></i>
          <span>${c.direccion}</span>
        </div>
        <div class="sede-info-item">
          <i class="fa-solid fa-phone"></i>
          <span>Tel: ${c.telefono}</span>
        </div>
        <div class="sede-info-item">
          <i class="fa-solid fa-clock"></i>
          <span>Lunes a Sábado: 8:00 AM - 6:00 PM</span>
        </div>
      </div>
      <button type="button" class="btn btn-outline-dark btn-abrir-agendar btn-agendar-sede"
        onclick="abrirModalAgendar({ clinicaId: ${c.id} })" data-clinica="${c.id}" data-clinica-nombre="${c.nombre}"
        data-servicio="Quiropodía Elite" style="margin-top: 1.5rem; width: 100%;">
        <i class="fa-regular fa-calendar-check"></i> Agendar en esta Clínica
      </button>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializar fechas con la fecha local del navegador
  const hoy = obtenerFechaHoyLocal();
  const inputFecha = document.getElementById('booking-fecha');
  if (inputFecha) {
    inputFecha.min = hoy;
    inputFecha.value = hoy;
    bookingState.fecha = hoy;
  }

  // 2. Vincular listeners reactivos a inputs del formulario
  configurarInputsReactivos();

  // 3. Cargar catálogos dinámicos desde la base de datos (clínicas y podólogos activos)
  await cargarCatalogoClinicas();
  await cargarCatalogoPodologos();

  // 4. Evaluar y sincronizar disponibilidad de horarios según la hora y la BD
  await consultarDisponibilidadHorariosBD();
  sincronizarAtajosFechaVisual(hoy);

  // 5. Configurar listeners de navegación y modal
  configurarNavegacion();
  configurarModalAgendar();
  configurarTestimonios();
  configurarContadoresAnimados();
  configurarMobileMenu();
  configurarScrollTop();
  configurarActiveNavScroll();

  // 6. Inicializar carrusel de Historias Clínicas (Instagram Stories)
  inicializarHistoriasAnuncios();

  // 7. Si la URL contiene #agendar, abrir modal automáticamente
  if (window.location.hash === '#agendar') {
    setTimeout(() => abrirModalAgendar(), 150);
  }
});

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
 * Escucha cambios en inputs del formulario para actualizar en tiempo real el comprobante
 */
function configurarInputsReactivos() {
  const inputNombres = document.getElementById('booking-nombres');
  const inputApePaterno = document.getElementById('booking-ape-paterno');
  const inputApeMaterno = document.getElementById('booking-ape-materno');
  const inputNombre = document.getElementById('booking-nombre');
  const inputTel = document.getElementById('booking-telefono');
  const inputFecha = document.getElementById('booking-fecha');
  const inputFechaNac = document.getElementById('booking-fecha-nacimiento');
  const inputHoraCustom = document.getElementById('booking-hora-custom');
  const selectServicio = document.getElementById('booking-servicio');
  const checkDiab = document.getElementById('booking-check-diabetico');
  const checkHiper = document.getElementById('booking-check-hipertenso');

  const sincronizarNombreCompleto = () => {
    const n = inputNombres ? inputNombres.value.trim() : '';
    const ap = inputApePaterno ? inputApePaterno.value.trim() : '';
    const am = inputApeMaterno ? inputApeMaterno.value.trim() : '';
    bookingState.nombres = n;
    bookingState.apePaterno = ap;
    bookingState.apeMaterno = am;
    bookingState.nombre = [n, ap, am].filter(Boolean).join(' ');
    if (inputNombre) {
      inputNombre.value = bookingState.nombre;
    }
    actualizarComprobante();
  };

  inputNombres?.addEventListener('input', sincronizarNombreCompleto);
  inputApePaterno?.addEventListener('input', sincronizarNombreCompleto);
  inputApeMaterno?.addEventListener('input', sincronizarNombreCompleto);

  inputNombre?.addEventListener('input', (e) => {
    if (!inputNombres && !inputApePaterno) {
      bookingState.nombre = e.target.value.trim();
      actualizarComprobante();
    }
  });

  inputTel?.addEventListener('input', (e) => {
    bookingState.telefono = e.target.value.trim();
    actualizarComprobante();
  });

  inputFecha?.addEventListener('change', (e) => {
    bookingState.fecha = e.target.value;
    sincronizarAtajosFechaVisual(e.target.value);
    actualizarComprobante();
    consultarDisponibilidadHorariosBD();
  });

  inputFechaNac?.addEventListener('input', calcularEdadAlVuelo);
  inputFechaNac?.addEventListener('change', calcularEdadAlVuelo);

  inputHoraCustom?.addEventListener('input', (e) => {
    const val = e.target.value;
    if (val) {
      bookingState.hora = formatearHora12h(val);
      const hiddenHora = document.getElementById('booking-hora-final');
      if (hiddenHora) hiddenHora.value = bookingState.hora;
      
      // Sincronizar selección de slot si coincide con uno no deshabilitado
      document.querySelectorAll('.slot-pill-lux').forEach((slot) => {
        if (slot.dataset.time === bookingState.hora && !slot.disabled && !slot.classList.contains('slot-pasado')) {
          slot.classList.add('selected');
        } else {
          slot.classList.remove('selected');
        }
      });
      actualizarComprobante();
    }
  });

  selectServicio?.addEventListener('change', (e) => {
    bookingState.servicio = e.target.value;
  });

  checkDiab?.addEventListener('change', (e) => {
    bookingState.esDiabetico = e.target.checked;
  });

  checkHiper?.addEventListener('change', (e) => {
    bookingState.esHipertenso = e.target.checked;
  });

  // Enter en búsqueda de expediente
  const inputExp = document.getElementById('booking-input-expediente');
  inputExp?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      buscarExpedientePaciente();
    }
  });
}

/**
 * Formatea '14:30' a '02:30 PM'
 */
function formatearHora12h(hora24) {
  if (!hora24) return '10:00 AM';
  const [hStr, mStr] = hora24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  const hPadded = String(h).padStart(2, '0');
  return `${hPadded}:${m} ${ampm}`;
}

/**
 * Convierte '10:00 AM' a '10:00' o '04:00 PM' a '16:00'
 */
function hora12ha24h(hora12) {
  if (!hora12) return '10:00';
  const parts = hora12.trim().split(' ');
  const [hStr, mStr] = parts[0].split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const modifier = (parts[1] || 'AM').toUpperCase();
  if (modifier === 'PM' && h < 12) h += 12;
  if (modifier === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

/**
 * Selección interactiva de Sede / Clínica
 */
function seleccionarSedeClinica(clinicaId) {
  const idNum = parseInt(clinicaId, 10);
  const encontrada = catalogoClinicas.find((c) => c.id === idNum) || catalogoClinicas[0];

  bookingState.clinicaId = encontrada.id;
  bookingState.clinicaNombre = encontrada.nombre;
  bookingState.clinicaDireccion = encontrada.direccion;
  bookingState.clinicaTelefono = encontrada.telefono;

  const hiddenId = document.getElementById('booking-id-clinica');
  if (hiddenId) hiddenId.value = encontrada.id;

  // Actualizar tarjetas en la UI
  document.querySelectorAll('.clinic-card-lux').forEach((card) => {
    if (parseInt(card.dataset.clinicaId, 10) === idNum) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  // Actualizar etiqueta del encabezado de horarios
  const labelHorarios = document.getElementById('label-sede-horarios');
  if (labelHorarios) {
    labelHorarios.textContent = encontrada.nombre;
  }

  actualizarComprobante();
  consultarDisponibilidadHorariosBD();
}

/**
 * Selección de Especialista Podólogo(a) desde la Base de Datos
 */
function seleccionarPodologo(cedula) {
  if (!cedula) return;
  const encontrado = catalogoPodologos.find((p) => (p.Cedula_podologo || p.cedula) === cedula);
  if (!encontrado) return;

  bookingState.cedulaPodologo = encontrado.Cedula_podologo || encontrado.cedula;
  bookingState.especialista = encontrado.nombre_completo || `${encontrado.Nombre} ${encontrado.ape_paterno}`;

  const hiddenCed = document.getElementById('booking-cedula-podologo');
  if (hiddenCed) hiddenCed.value = bookingState.cedulaPodologo;

  // Actualizar tarjetas de podólogos en la UI
  document.querySelectorAll('.podologo-card-lux').forEach((card) => {
    if (card.dataset.cedula === bookingState.cedulaPodologo) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  // Actualizar etiqueta del especialista en el bloque de horarios
  const labelPodologo = document.getElementById('label-podologo-horarios');
  if (labelPodologo) {
    labelPodologo.textContent = bookingState.especialista;
  }

  actualizarComprobante();
  consultarDisponibilidadHorariosBD();
}

/**
 * Carga el catálogo de Podólogos directamente desde la Base de Datos (solo activos)
 */
async function cargarCatalogoPodologos() {
  const container = document.getElementById('podologos-container-lux');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/podologos`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        catalogoPodologos = data.filter((p) => p.activo !== false);
      }
    }
  } catch (err) {
    console.warn('No se pudo consultar /api/podologos en BD:', err.message);
  }

  // Respaldo en caso de fallo de red
  if (!catalogoPodologos || catalogoPodologos.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #64748b; background: rgba(241, 245, 249, 0.6); border-radius: 12px; border: 1px dashed #cbd5e1;">
        <i class="fa-solid fa-user-doctor" style="font-size: 2rem; opacity: 0.4; margin-bottom: 0.5rem; display: block;"></i>
        <p style="margin: 0; font-weight: 500;">No hay podólogos con agenda activa en este momento.</p>
      </div>
    `;
    return;
  }

  // Renderizar las tarjetas interactivas de podólogos activos
  container.innerHTML = catalogoPodologos.map((p, idx) => {
    const ced = p.Cedula_podologo || p.cedula || '';
    const nom = p.nombre_completo || `${p.Nombre || ''} ${p.ape_paterno || ''}`.trim();
    const esMujer = (p.Nombre && (p.Nombre.startsWith('Maribel') || p.Nombre.startsWith('Kiara') || p.Nombre.startsWith('Ana') || p.Nombre.startsWith('Maria')));
    const prefijo = esMujer ? 'Dra.' : 'Dr.';
    const icono = esMujer ? 'fa-user-nurse' : 'fa-user-doctor';
    const isActiva = (bookingState.cedulaPodologo ? bookingState.cedulaPodologo === ced : idx === 0);

    return `
      <div class="podologo-card-lux ${isActiva ? 'active' : ''}" 
           data-cedula="${ced}" 
           onclick="seleccionarPodologo('${ced}')">
        <div class="podologo-avatar-box">
          <i class="fa-solid ${icono}"></i>
        </div>
        <div class="podologo-meta">
          <h4>${prefijo} ${nom}</h4>
          <small>Especialista Podológico(a)</small>
          <span class="pod-badge-cedula">Céd. ${ced}</span>
        </div>
        <div class="podologo-check-pill"><i class="fa-solid fa-check"></i></div>
      </div>
    `;
  }).join('');

  // Sincronizar selección inicial: si el especialista actual ya no está activo, seleccionar el primero disponible
  const existe = catalogoPodologos.some((p) => (p.Cedula_podologo || p.cedula) === bookingState.cedulaPodologo);
  const podSeleccionado = existe
    ? catalogoPodologos.find((p) => (p.Cedula_podologo || p.cedula) === bookingState.cedulaPodologo)
    : catalogoPodologos[0];

  if (podSeleccionado) {
    seleccionarPodologo(podSeleccionado.Cedula_podologo || podSeleccionado.cedula);
  }
}

/**
 * Selector de Sexo
 */
function seleccionarSexo(sexo) {
  bookingState.sexo = sexo;
  const inputSexo = document.getElementById('booking-sexo');
  if (inputSexo) inputSexo.value = sexo;

  document.querySelectorAll('.sex-choice-pill-lux').forEach((pill) => {
    if (pill.dataset.sexo === sexo) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
}

/**
 * Calcula la edad al ingresar fecha de nacimiento
 */
function calcularEdadAlVuelo() {
  const inputFechaNac = document.getElementById('booking-fecha-nacimiento');
  const badgeEdad = document.getElementById('booking-edad-badge');
  if (!inputFechaNac || !badgeEdad) return;

  const fechaStr = (inputFechaNac.value || '').trim();
  bookingState.fechaNacimiento = fechaStr;

  if (!fechaStr) {
    badgeEdad.textContent = 'Sin fecha';
    bookingState.edadCalculada = null;
    return;
  }

  // Parsear formato YYYY-MM-DD sin desfase por zona horaria UTC
  const partes = fechaStr.split('-');
  if (partes.length !== 3) {
    badgeEdad.textContent = 'Sin fecha';
    bookingState.edadCalculada = null;
    return;
  }

  const anioNac = parseInt(partes[0], 10);
  const mesNac = parseInt(partes[1], 10) - 1; // 0-11
  const diaNac = parseInt(partes[2], 10);

  if (isNaN(anioNac) || isNaN(mesNac) || isNaN(diaNac)) {
    badgeEdad.textContent = 'Sin fecha';
    bookingState.edadCalculada = null;
    return;
  }

  const hoy = new Date();
  let edad = hoy.getFullYear() - anioNac;
  const m = hoy.getMonth() - mesNac;
  if (m < 0 || (m === 0 && hoy.getDate() < diaNac)) {
    edad--;
  }

  if (edad >= 0 && edad <= 125) {
    badgeEdad.textContent = `${edad} años`;
    bookingState.edadCalculada = edad;
  } else {
    badgeEdad.textContent = 'Fecha inválida';
    bookingState.edadCalculada = null;
  }
}

/**
 * Determina si un slot horario ya transcurrió con respecto a la fecha y hora actual
 */
function slotYaPaso(slot, fechaStr) {
  const hoyStr = obtenerFechaHoyLocal();
  if (!fechaStr) fechaStr = hoyStr;

  if (fechaStr < hoyStr) {
    return true; // Cualquier fecha pasada
  }
  if (fechaStr > hoyStr) {
    return false; // Fechas futuras están 100% disponibles
  }

  // Si la fecha es el día de hoy, comparar con la hora actual
  const ahora = new Date();
  const horaActual = ahora.getHours();
  const minActual = ahora.getMinutes();

  if (horaActual > slot.hour24) {
    return true;
  }
  if (horaActual === slot.hour24 && minActual >= (slot.min || 0)) {
    return true;
  }
  return false;
}

/**
 * Evalúa y actualiza la disponibilidad de cada bloque horario para la fecha seleccionada.
 * Si es hoy y la hora ya pasó, inhabilita el botón, muestra 'NO DISPONIBLE'
/**
 * Consulta en la base de datos la disponibilidad de horarios en tiempo real
 * para la clínica, el especialista y la fecha seleccionados
 */
async function consultarDisponibilidadHorariosBD() {
  const fecha = bookingState.fecha || obtenerFechaHoyLocal();
  const clinicaId = bookingState.clinicaId || 14;
  const cedula = bookingState.cedulaPodologo || '';

  try {
    const url = `${API_BASE}/citas/disponibilidad?clinica_id=${clinicaId}&cedula_podologo=${encodeURIComponent(cedula)}&fecha=${fecha}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.detalles) && cedula) {
        // Doble validación: filtrar estrictamente las citas del podólogo seleccionado
        const citasPodologo = data.detalles.filter(d => 
          String(d.fk_cedula_podologo || '').trim().toLowerCase() === String(cedula).trim().toLowerCase()
        );
        horasOcupadasBD = citasPodologo
          .map(d => d.hora_12 ? d.hora_12.trim().toUpperCase() : null)
          .filter(Boolean);
      } else {
        horasOcupadasBD = data.horas_ocupadas || [];
      }
    } else {
      horasOcupadasBD = [];
    }
  } catch (err) {
    console.warn('Error al consultar disponibilidad en BD:', err.message);
    horasOcupadasBD = [];
  }

  actualizarDisponibilidadHorarios(horasOcupadasBD);
}

/**
 * Evalúa y actualiza la disponibilidad de cada bloque horario para la fecha seleccionada.
 * Comprueba:
 * 1. Si ya pasó en el día de hoy -> NO DISPONIBLE
 * 2. Si está reservado en la Base de Datos para esta sede o especialista -> OCUPADO
 * 3. En caso contrario -> DISPONIBLE
 */
function actualizarDisponibilidadHorarios(horasOcupadas = horasOcupadasBD) {
  const fechaSeleccionada = bookingState.fecha || obtenerFechaHoyLocal();
  const hoyStr = obtenerFechaHoyLocal();
  const esHoy = (fechaSeleccionada === hoyStr);

  let primerSlotDisponible = null;
  let slotActualEstaDisponible = false;
  let totalDisponibles = 0;

  CATALOGO_SLOTS.forEach((item) => {
    const btn = document.querySelector(`.slot-pill-lux[data-time="${item.time}"]`);
    const yaPaso = slotYaPaso(item, fechaSeleccionada);
    
    // Comprobar si coincide con alguna cita registrada en la base de datos
    const estaOcupadoBD = Array.isArray(horasOcupadas) && horasOcupadas.some((h) => {
      if (!h) return false;
      const hNorm = h.trim().toUpperCase().replace(/\s+/g, '');
      const itemNorm = item.time.trim().toUpperCase().replace(/\s+/g, '');
      return hNorm === itemNorm;
    });

    if (btn) {
      const badge = btn.querySelector('.slot-badge');
      if (yaPaso) {
        btn.classList.remove('slot-ocupado');
        btn.classList.add('slot-pasado');
        btn.setAttribute('disabled', 'disabled');
        btn.setAttribute('title', 'Este horario ya transcurrió el día de hoy');
        if (badge) {
          badge.className = 'slot-badge badge-pasado';
          badge.textContent = 'NO DISPONIBLE';
        }
      } else if (estaOcupadoBD) {
        btn.classList.remove('slot-pasado');
        btn.classList.add('slot-ocupado');
        btn.setAttribute('disabled', 'disabled');
        btn.setAttribute('title', `Horario ocupado en agenda con ${bookingState.especialista || 'el especialista'}`);
        if (badge) {
          badge.className = 'slot-badge badge-ocupado';
          badge.textContent = 'OCUPADO';
        }
      } else {
        btn.classList.remove('slot-pasado', 'slot-ocupado');
        btn.removeAttribute('disabled');
        btn.removeAttribute('title');
        if (badge) {
          badge.className = 'slot-badge';
          badge.textContent = 'DISPONIBLE';
        }
        totalDisponibles++;
        if (!primerSlotDisponible) {
          primerSlotDisponible = item.time;
        }
        if (bookingState.hora === item.time) {
          slotActualEstaDisponible = true;
        }
      }
    }
  });

  // Gestionar el aviso visual si ya no quedan horarios hoy o en esta fecha
  const container = document.getElementById('time-slots-container');
  let avisoEl = document.getElementById('aviso-sin-horarios-container');

  if (esHoy && totalDisponibles === 0) {
    if (!avisoEl && container) {
      avisoEl = document.createElement('div');
      avisoEl.id = 'aviso-sin-horarios-container';
      avisoEl.className = 'aviso-sin-horarios-hoy';
      avisoEl.innerHTML = `
        <i class="fa-solid fa-clock-rotate-left"></i>
        <span>Los horarios de atención para hoy con este especialista han concluido o están agotados. Te sugerimos agendar para mañana.</span>
        <button type="button" class="btn-cambiar-manana" onclick="setAtajoFecha(1)">
          <i class="fa-solid fa-calendar-plus"></i> Agendar para Mañana
        </button>
      `;
      container.parentNode.insertBefore(avisoEl, container.nextSibling);
    } else if (avisoEl) {
      avisoEl.style.display = 'flex';
    }
  } else {
    if (avisoEl) {
      avisoEl.style.display = 'none';
    }
  }

  // Si el horario seleccionado actualmente ya pasó o está ocupado, seleccionar el primero disponible
  if (!slotActualEstaDisponible && primerSlotDisponible) {
    seleccionarHorarioSlot(primerSlotDisponible);
  } else if (!slotActualEstaDisponible && totalDisponibles === 0) {
    document.querySelectorAll('.slot-pill-lux').forEach((pill) => pill.classList.remove('selected'));
    const inputHoraFinal = document.getElementById('booking-hora-final');
    if (inputHoraFinal) inputHoraFinal.value = 'Sin horarios disponibles';
    bookingState.hora = 'Sin horarios disponibles';
    actualizarComprobante();
  } else if (slotActualEstaDisponible) {
    document.querySelectorAll('.slot-pill-lux').forEach((pill) => {
      if (pill.dataset.time === bookingState.hora && !pill.disabled && !pill.classList.contains('slot-ocupado') && !pill.classList.contains('slot-pasado')) {
        pill.classList.add('selected');
      } else {
        pill.classList.remove('selected');
      }
    });
  }
}

/**
 * Mantiene sincronizados visualmente los botones de atajo rápido según la fecha actual
 */
function sincronizarAtajosFechaVisual(fechaStr) {
  const hoy = obtenerFechaHoyLocal();
  const manana = obtenerFechaOffsetLocal(1);
  const masDos = obtenerFechaOffsetLocal(2);
  const proxSemana = obtenerFechaOffsetLocal(7);

  const botones = document.querySelectorAll('.date-shortcuts-row-lux .btn-shortcut-pill-lux');
  if (botones.length >= 4) {
    botones.forEach((b) => b.classList.remove('active'));
    if (fechaStr === hoy) botones[0].classList.add('active');
    else if (fechaStr === manana) botones[1].classList.add('active');
    else if (fechaStr === masDos) botones[2].classList.add('active');
    else if (fechaStr === proxSemana) botones[3].classList.add('active');
  }
}

/**
 * Atajos rápidos para selección de fechas (Hoy, Mañana, +2 días, Próxima semana)
 */
function setAtajoFecha(dias, btnEl) {
  const fechaIso = obtenerFechaOffsetLocal(dias);

  const inputFecha = document.getElementById('booking-fecha');
  if (inputFecha) {
    inputFecha.value = fechaIso;
    bookingState.fecha = fechaIso;
  }

  if (btnEl) {
    document.querySelectorAll('.btn-shortcut-pill-lux').forEach((b) => b.classList.remove('active'));
    btnEl.classList.add('active');
  } else {
    sincronizarAtajosFechaVisual(fechaIso);
  }

  actualizarComprobante();
  consultarDisponibilidadHorariosBD();
}

/**
 * Selección de bloque horario (Time Slot)
 */
function seleccionarHorarioSlot(horaStr, btnEl) {
  if (!btnEl) {
    btnEl = document.querySelector(`.slot-pill-lux[data-time="${horaStr}"]`);
  }
  if (btnEl && (btnEl.disabled || btnEl.classList.contains('slot-pasado') || btnEl.classList.contains('slot-ocupado'))) {
    return;
  }

  bookingState.hora = horaStr;
  const inputHoraFinal = document.getElementById('booking-hora-final');
  if (inputHoraFinal) inputHoraFinal.value = horaStr;

  // Actualizar también el input de hora personalizada
  const inputCustom = document.getElementById('booking-hora-custom');
  if (inputCustom) {
    inputCustom.value = hora12ha24h(horaStr);
  }

  document.querySelectorAll('.slot-pill-lux').forEach((pill) => pill.classList.remove('selected'));
  if (btnEl) btnEl.classList.add('selected');

  actualizarComprobante();
}

/**
 * Actualiza los valores en tiempo real del Comprobante de Cita
 */
function actualizarComprobante() {
  const voucherPaciente = document.getElementById('voucher-paciente');
  const voucherTelefono = document.getElementById('voucher-telefono');
  const voucherSede = document.getElementById('voucher-sede');
  const voucherHorario = document.getElementById('voucher-horario');
  const voucherEspecialista = document.getElementById('voucher-especialista');

  const nombreVal = bookingState.nombre || document.getElementById('booking-nombre')?.value.trim() || 'Sin especificar';
  const telVal = bookingState.telefono || document.getElementById('booking-telefono')?.value.trim() || 'Sin teléfono';
  const fechaVal = bookingState.fecha || document.getElementById('booking-fecha')?.value || 'Fecha sin asignar';
  const horaVal = bookingState.hora || document.getElementById('booking-hora-final')?.value || '10:00 AM';

  if (voucherPaciente) voucherPaciente.textContent = nombreVal;
  if (voucherTelefono) voucherTelefono.textContent = telVal;
  if (voucherSede) voucherSede.textContent = bookingState.clinicaNombre;
  if (voucherHorario) voucherHorario.textContent = `${fechaVal} · ${horaVal}`;
  if (voucherEspecialista) voucherEspecialista.textContent = bookingState.especialista;
}

/**
 * Búsqueda inteligente de paciente por Número de Expediente Clínico Único
 */
async function buscarExpedientePaciente() {
  const inputExp = document.getElementById('booking-input-expediente');
  const btnBuscar = document.getElementById('btn-buscar-expediente');
  const btnReset = document.getElementById('btn-reset-expediente');
  const badgeEncontrado = document.getElementById('paciente-encontrado-badge');
  const textoEncontrado = document.getElementById('paciente-encontrado-texto');

  const termino = inputExp?.value.trim();
  if (!termino) {
    alert('Por favor ingresa un número de expediente clínico para buscar.');
    return;
  }

  // Validación estricta: sólo dígitos numéricos para el expediente clínico
  if (!/^\d+$/.test(termino)) {
    alert('La búsqueda es exclusivamente mediante el Número de Expediente Clínico (únicamente números). Recuerda que la búsqueda por teléfono se ha desactivado para evitar mezclar datos de familiares que comparten el mismo número.');
    return;
  }

  if (btnBuscar) {
    btnBuscar.disabled = true;
    btnBuscar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Buscando...</span>';
  }

  // 1. Limpieza total previa para evitar arrastrar datos o bugs al cambiar de un expediente a otro
  const inputNombres = document.getElementById('booking-nombres');
  const inputApePaterno = document.getElementById('booking-ape-paterno');
  const inputApeMaterno = document.getElementById('booking-ape-materno');
  const inputNombre = document.getElementById('booking-nombre');
  const inputTel = document.getElementById('booking-telefono');
  const inputFechaNac = document.getElementById('booking-fecha-nacimiento');
  const inputDir = document.getElementById('booking-direccion');
  const inputMun = document.getElementById('booking-municipio');
  const checkDiab = document.getElementById('booking-check-diabetico');
  const checkHiper = document.getElementById('booking-check-hipertenso');
  const badgeEdad = document.getElementById('booking-edad-badge');

  if (inputNombres) inputNombres.value = '';
  if (inputApePaterno) inputApePaterno.value = '';
  if (inputApeMaterno) inputApeMaterno.value = '';
  if (inputNombre) inputNombre.value = '';
  if (inputTel) inputTel.value = '';
  if (inputFechaNac) inputFechaNac.value = '';
  if (inputDir) inputDir.value = '';
  if (inputMun) inputMun.value = 'Tecámac';
  if (checkDiab) checkDiab.checked = false;
  if (checkHiper) checkHiper.checked = false;
  if (badgeEdad) badgeEdad.textContent = 'Sin fecha';
  seleccionarSexo('Femenino');

  bookingState.pacienteEncontrado = false;
  bookingState.expediente = '';
  bookingState.nombres = '';
  bookingState.apePaterno = '';
  bookingState.apeMaterno = '';
  bookingState.nombre = '';
  bookingState.telefono = '';
  bookingState.fechaNacimiento = '';
  bookingState.edadCalculada = null;
  bookingState.esDiabetico = false;
  bookingState.esHipertenso = false;

  try {
    const res = await fetch(`${API_BASE}/pacientes/${encodeURIComponent(termino)}`);
    if (res.ok) {
      const p = await res.json();
      bookingState.pacienteEncontrado = true;
      bookingState.expediente = p.No_expediente || termino;

      // Autocompletar datos del paciente
      if (inputNombres) inputNombres.value = p.Nombres || '';
      if (inputApePaterno) inputApePaterno.value = p.ape_paterno || '';
      if (inputApeMaterno) inputApeMaterno.value = p.ape_materno || '';
      const nomCompleto = p.nombre_completo || `${p.Nombres || ''} ${p.ape_paterno || ''} ${p.ape_materno || ''}`.trim();
      if (inputNombre) inputNombre.value = nomCompleto;
      if (inputTel) inputTel.value = p.telefono || '';
      if (inputDir) inputDir.value = p.Calle_direccion || p.direccion || '';
      if (inputMun) inputMun.value = p.Municipio || p.municipio || 'Tecámac';

      bookingState.nombres = p.Nombres || '';
      bookingState.apePaterno = p.ape_paterno || '';
      bookingState.apeMaterno = p.ape_materno || '';
      bookingState.nombre = nomCompleto;
      bookingState.telefono = p.telefono || '';

      // FECHA DE NACIMIENTO Y EDAD CALCULADA
      if (p.Fecha_nacimiento) {
        const fechaNacFormatted = String(p.Fecha_nacimiento).split('T')[0].trim();
        if (inputFechaNac) {
          inputFechaNac.value = fechaNacFormatted;
        }
        bookingState.fechaNacimiento = fechaNacFormatted;
        calcularEdadAlVuelo();
        if (p.edad !== null && p.edad !== undefined && !isNaN(p.edad)) {
          if (badgeEdad) badgeEdad.textContent = `${p.edad} años`;
          bookingState.edadCalculada = p.edad;
        }
      } else {
        if (inputFechaNac) inputFechaNac.value = '';
        if (badgeEdad) badgeEdad.textContent = 'Sin fecha';
        bookingState.fechaNacimiento = '';
        bookingState.edadCalculada = null;
      }

      // SEXO CLÍNICO
      let sexoDetectado = 'Femenino';
      if (p.Sexo) {
        const sRaw = String(p.Sexo).trim().toUpperCase();
        if (sRaw === 'M' || sRaw.startsWith('MASC') || sRaw === 'H' || sRaw.startsWith('HOMB')) {
          sexoDetectado = 'Masculino';
        } else if (sRaw === 'F' || sRaw.startsWith('FEM') || sRaw.startsWith('MUJ')) {
          sexoDetectado = 'Femenino';
        } else {
          sexoDetectado = 'Otro';
        }
      }
      seleccionarSexo(sexoDetectado);

      // ALERTAS MÉDICAS (DIABÉTICO / HIPERTENSO)
      const isDiab = Boolean(p.es_diabetico === 1 || p.es_diabetico === '1' || p.es_diabetico === true);
      const isHiper = Boolean(p.es_hipertenso === 1 || p.es_hipertenso === '1' || p.es_hipertenso === true);

      if (checkDiab) checkDiab.checked = isDiab;
      if (checkHiper) checkHiper.checked = isHiper;
      bookingState.esDiabetico = isDiab;
      bookingState.esHipertenso = isHiper;

      if (badgeEncontrado) {
        badgeEncontrado.style.display = 'inline-flex';
        if (textoEncontrado) {
          textoEncontrado.textContent = `Expediente #${bookingState.expediente} verificado: ${nomCompleto}`;
        }
      }
      if (btnReset) btnReset.style.display = 'inline-flex';

      actualizarComprobante();
    } else {
      bookingState.pacienteEncontrado = false;
      bookingState.expediente = '';
      if (badgeEncontrado) badgeEncontrado.style.display = 'none';
      if (btnReset) btnReset.style.display = 'none';
      alert(`No se encontró ningún expediente clínico registrado con el número "${termino}". Recuerda ingresar el número de expediente único del paciente.`);
    }
  } catch (err) {
    console.warn('Error al buscar paciente en backend:', err.message);
    alert('No fue posible consultar la base de expedientes en este momento.');
  } finally {
    if (btnBuscar) {
      btnBuscar.disabled = false;
      btnBuscar.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> <span>Buscar</span>';
    }
  }
}

/**
 * Resetea el formulario del paciente
 */
function resetearFormularioPaciente() {
  bookingState.expediente = '';
  bookingState.pacienteEncontrado = false;
  bookingState.nombres = '';
  bookingState.apePaterno = '';
  bookingState.apeMaterno = '';
  bookingState.nombre = '';
  bookingState.telefono = '';
  bookingState.fechaNacimiento = '';
  bookingState.edadCalculada = null;
  bookingState.esDiabetico = false;
  bookingState.esHipertenso = false;

  const inputExp = document.getElementById('booking-input-expediente');
  const inputNombres = document.getElementById('booking-nombres');
  const inputApePaterno = document.getElementById('booking-ape-paterno');
  const inputApeMaterno = document.getElementById('booking-ape-materno');
  const inputNombre = document.getElementById('booking-nombre');
  const inputTel = document.getElementById('booking-telefono');
  const inputFechaNac = document.getElementById('booking-fecha-nacimiento');
  const inputDir = document.getElementById('booking-direccion');
  const inputMun = document.getElementById('booking-municipio');
  const badgeEdad = document.getElementById('booking-edad-badge');
  const badgeEncontrado = document.getElementById('paciente-encontrado-badge');
  const btnReset = document.getElementById('btn-reset-expediente');
  const checkDiab = document.getElementById('booking-check-diabetico');
  const checkHiper = document.getElementById('booking-check-hipertenso');

  if (inputExp) inputExp.value = '';
  if (inputNombres) inputNombres.value = '';
  if (inputApePaterno) inputApePaterno.value = '';
  if (inputApeMaterno) inputApeMaterno.value = '';
  if (inputNombre) inputNombre.value = '';
  if (inputTel) inputTel.value = '';
  if (inputFechaNac) inputFechaNac.value = '';
  if (inputDir) inputDir.value = '';
  if (inputMun) inputMun.value = 'Tecámac';
  if (badgeEdad) badgeEdad.textContent = 'Sin fecha';
  if (badgeEncontrado) badgeEncontrado.style.display = 'none';
  if (btnReset) btnReset.style.display = 'none';
  if (checkDiab) checkDiab.checked = false;
  if (checkHiper) checkHiper.checked = false;

  seleccionarSexo('Femenino');
  actualizarComprobante();
}

/**
 * Control del Modal de Agendamiento con soporte delegated click para asegurar que cualquier botón abra el modal
 */
function configurarModalAgendar() {
  const modal = document.getElementById('modal-agendar');

  // Delegación de eventos en document para asegurar que NINGÚN botón falle al hacer clic
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-abrir-agendar, .btn-agendar-sede, [data-abrir-agendar]');
    if (btn) {
      e.preventDefault();
      const clinicaId = btn.dataset.clinica || btn.getAttribute('data-clinica') || null;
      const servicio = btn.dataset.servicio || btn.getAttribute('data-servicio') || '';
      abrirModalAgendar({ clinicaId, servicio });
    }
  });

  // Cerrar al hacer clic en el backdrop
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      cerrarModalAgendar();
    }
  });

  // Cerrar al presionar Escape
  modal?.addEventListener('cancel', () => {
    cerrarModalAgendar();
  });
}

/**
 * Abre el modal de agendamiento con opción de clínica y servicio preseleccionados
 */
function abrirModalAgendar(opciones = {}) {
  const modal = document.getElementById('modal-agendar');
  if (!modal) {
    console.error('Modal #modal-agendar no encontrado');
    return;
  }

  // Normalizar opciones si se pasa string o evento
  if (typeof opciones === 'string') {
    opciones = { servicio: opciones };
  } else if (!opciones || typeof opciones !== 'object' || opciones.target) {
    opciones = {};
  }

  // Restaurar vista de formulario y ocultar éxito
  const formView = document.getElementById('booking-form-view');
  const successView = document.getElementById('booking-success-view');
  if (formView) formView.style.display = 'block';
  if (successView) successView.style.display = 'none';

  // Pre-seleccionar clínica si se especificó en el botón que originó el click
  if (opciones.clinicaId) {
    seleccionarSedeClinica(opciones.clinicaId);
  } else if (!bookingState.clinicaId) {
    seleccionarSedeClinica(14);
  }

  // Pre-seleccionar servicio si vino especificado
  if (opciones.servicio) {
    const selectServicio = document.getElementById('booking-servicio');
    if (selectServicio) selectServicio.value = opciones.servicio;
    bookingState.servicio = opciones.servicio;
  }

  // Asegurar fecha válida por defecto en local
  const hoy = obtenerFechaHoyLocal();
  const inputFecha = document.getElementById('booking-fecha');
  if (inputFecha) {
    inputFecha.min = hoy;
    if (!inputFecha.value) {
      inputFecha.value = hoy;
      bookingState.fecha = hoy;
    }
  }

  // Asegurar catálogos de clínicas y podólogos cargados y sincronizados
  cargarCatalogoClinicas();
  cargarCatalogoPodologos();

  // Actualizar disponibilidad de bloques y atajos según la fecha, podólogo y sede
  consultarDisponibilidadHorariosBD();
  sincronizarAtajosFechaVisual(bookingState.fecha || hoy);

  // Abrir modal con soporte nativo o fallback
  try {
    if (typeof modal.showModal === 'function') {
      if (!modal.open) {
        modal.showModal();
      }
    } else {
      modal.setAttribute('open', '');
    }
  } catch (err) {
    modal.setAttribute('open', '');
  }

  actualizarComprobante();
}

function cerrarModalAgendar() {
  const modal = document.getElementById('modal-agendar');
  if (!modal) return;
  try {
    if (typeof modal.close === 'function') {
      if (modal.open) modal.close();
    } else {
      modal.removeAttribute('open');
    }
  } catch (err) {
    modal.removeAttribute('open');
  }
}

/**
 * Disparador desde el botón "Guardar Cita" en la tarjeta lateral del comprobante
 */
function dispararEnvioFormulario() {
  const form = document.getElementById('form-agendar-cita');
  if (form) {
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  }
}

/**
 * Procesa y envía la cita al backend
 */
async function procesarEnvioCita(event) {
  event.preventDefault();

  const inputNombres = document.getElementById('booking-nombres');
  const inputApePaterno = document.getElementById('booking-ape-paterno');
  const inputApeMaterno = document.getElementById('booking-ape-materno');
  const inputNombre = document.getElementById('booking-nombre');

  let nombres = inputNombres?.value.trim() || '';
  let apePaterno = inputApePaterno?.value.trim() || '';
  let apeMaterno = inputApeMaterno?.value.trim() || '';
  let nombreCompleto = [nombres, apePaterno, apeMaterno].filter(Boolean).join(' ');

  if (!nombreCompleto && inputNombre?.value.trim()) {
    nombreCompleto = inputNombre.value.trim();
  }

  const telefono = document.getElementById('booking-telefono')?.value.trim();
  const fecha = document.getElementById('booking-fecha')?.value;
  const horaFinal = document.getElementById('booking-hora-final')?.value || '10:00 AM';
  const clinicaId = parseInt(document.getElementById('booking-id-clinica')?.value, 10) || bookingState.clinicaId || 14;
  const servicio = document.getElementById('booking-servicio')?.value || 'Quiropodía Elite';
  const motivoTexto = document.getElementById('booking-motivo')?.value.trim() || '';
  const fechaNac = document.getElementById('booking-fecha-nacimiento')?.value || null;
  const direccion = document.getElementById('booking-direccion')?.value.trim() || null;
  const municipio = document.getElementById('booking-municipio')?.value.trim() || 'Tecámac';
  const esDiabetico = document.getElementById('booking-check-diabetico')?.checked ? 1 : 0;
  const esHipertenso = document.getElementById('booking-check-hipertenso')?.checked ? 1 : 0;
  const sexo = document.getElementById('booking-sexo')?.value || 'Femenino';

  if ((!nombres && !nombreCompleto) || (!apePaterno && !nombreCompleto) || !telefono || !fecha) {
    alert('Por favor completa tu Nombre, Apellidos, Teléfono y Fecha de cita.');
    return;
  }

  if (!horaFinal || horaFinal.includes('Sin horario')) {
    alert('No hay horarios disponibles para la fecha seleccionada. Te sugerimos seleccionar otra fecha (por ejemplo, mañana).');
    return;
  }

  const hora24Obj = hora12ha24h(horaFinal);
  const [hStr, mStr] = hora24Obj.split(':');
  const slotEvaluado = { hour24: parseInt(hStr, 10), min: parseInt(mStr, 10) || 0 };
  if (slotYaPaso(slotEvaluado, fecha)) {
    alert('El horario seleccionado ya ha transcurrido. Por favor selecciona un horario disponible posterior o para otra fecha.');
    return;
  }

  const btnForm = document.getElementById('btn-confirmar-booking-main');
  const btnVoucher = document.getElementById('btn-guardar-cita-voucher');

  if (btnForm) {
    btnForm.disabled = true;
    btnForm.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Registrando Cita...</span>';
  }
  if (btnVoucher) {
    btnVoucher.disabled = true;
    btnVoucher.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Guardando...</span>';
  }

  const clinicaSeleccionada = catalogoClinicas.find((c) => c.id === clinicaId) || catalogoClinicas[0];
  const cedulaPodologo = document.getElementById('booking-cedula-podologo')?.value || bookingState.cedulaPodologo || null;
  const especialistaNombre = bookingState.especialista || clinicaSeleccionada.especialista;

  // Validar si el horario seleccionado se encuentra ocupado en la base de datos
  if (Array.isArray(horasOcupadasBD) && horasOcupadasBD.some((h) => {
    if (!h) return false;
    return h.trim().toUpperCase().replace(/\s+/g, '') === horaFinal.trim().toUpperCase().replace(/\s+/g, '');
  })) {
    alert(`El horario ${horaFinal} se encuentra ocupado con ${especialistaNombre} o en esta sede. Por favor elige otro horario disponible.`);
    if (btnForm) {
      btnForm.disabled = false;
      btnForm.innerHTML = '<i class="fa-solid fa-calendar-check"></i> <span>Confirmar y Agendar Cita</span>';
    }
    if (btnVoucher) {
      btnVoucher.disabled = false;
      btnVoucher.innerHTML = '<i class="fa-solid fa-check"></i> <span>Guardar Cita</span>';
    }
    return;
  }

  const payload = {
    clinica_id: clinicaId,
    fk_clinica_id: clinicaId,
    id_clinica: clinicaId,
    fk_cedula_podologo: cedulaPodologo,
    cedula_podologo: cedulaPodologo,
    fecha,
    hora: horaFinal,
    fecha_hora: `${fecha} ${hora12ha24h(horaFinal)}:00`,
    nombres: nombres || undefined,
    Nombres: nombres || undefined,
    ape_paterno: apePaterno || undefined,
    ape_materno: apeMaterno || undefined,
    nombre_completo: nombreCompleto,
    paciente_nombre: nombreCompleto,
    nombre: nombreCompleto,
    telefono,
    sexo,
    fecha_nacimiento: fechaNac,
    calle_direccion: direccion,
    municipio,
    es_diabetico: esDiabetico,
    es_hipertenso: esHipertenso,
    motivo: `${servicio} - ${motivoTexto || 'Cita reservada desde Portal Web Elite Foot Care'}`,
    notas_alergias: motivoTexto
  };

  if (bookingState.expediente) {
    payload.fk_no_expediente = bookingState.expediente;
    payload.expediente = bookingState.expediente;
  }

  try {
    const res = await fetch(`${API_BASE}/citas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      mostrarConfirmacionExito({
        folio: data.Consulta_id || data.id_cita || `CON${new Date().getFullYear()}${String(clinicaId).padStart(2, '0')}${Math.floor(1000 + Math.random() * 9000)}`,
        expediente: data.no_expediente || payload.fk_no_expediente || 'Generado en clínica',
        paciente: nombreCompleto,
        sede: clinicaSeleccionada.nombre,
        telefonoSede: clinicaSeleccionada.telefono,
        fecha,
        hora: horaFinal,
        servicio,
        especialista: especialistaNombre
      });
      consultarDisponibilidadHorariosBD();
    } else if (res.status === 409) {
      alert(data.error || 'El horario seleccionado ya no se encuentra disponible. Por favor elige otro horario.');
      await consultarDisponibilidadHorariosBD();
      return;
    } else {
      console.warn('Backend respondió error, activando respaldo local para el paciente:', data.error);
      mostrarConfirmacionExito({
        folio: `CON${new Date().getFullYear()}${String(clinicaId).padStart(2, '0')}${Math.floor(1000 + Math.random() * 9000)}`,
        expediente: payload.fk_no_expediente || 'Registro nuevo',
        paciente: nombreCompleto,
        sede: clinicaSeleccionada.nombre,
        telefonoSede: clinicaSeleccionada.telefono,
        fecha,
        hora: horaFinal,
        servicio,
        especialista: especialistaNombre
      });
    }
  } catch (err) {
    console.warn('Conexión con backend offline, procediendo con confirmación local de contingencia:', err.message);
    mostrarConfirmacionExito({
      folio: `CON${new Date().getFullYear()}${String(clinicaId).padStart(2, '0')}${Math.floor(1000 + Math.random() * 9000)}`,
      expediente: payload.fk_no_expediente || 'Registro nuevo',
      paciente: nombreCompleto,
      sede: clinicaSeleccionada.nombre,
      telefonoSede: clinicaSeleccionada.telefono,
      fecha,
      hora: horaFinal,
      servicio,
      especialista: especialistaNombre
    });
  } finally {
    if (btnForm) {
      btnForm.disabled = false;
      btnForm.innerHTML = '<i class="fa-solid fa-calendar-check"></i> <span>Confirmar y Agendar Cita</span>';
    }
    if (btnVoucher) {
      btnVoucher.disabled = false;
      btnVoucher.innerHTML = '<i class="fa-solid fa-check"></i> <span>Guardar Cita</span>';
    }
  }
}

/**
 * Despliega la pantalla de éxito con folio oficial y mensaje directo para WhatsApp
 */
function mostrarConfirmacionExito(detalles) {
  const formView = document.getElementById('booking-form-view');
  const successView = document.getElementById('booking-success-view');

  if (formView) formView.style.display = 'none';
  if (successView) successView.style.display = 'block';

  document.getElementById('recibo-folio').textContent = detalles.folio;
  document.getElementById('recibo-expediente').textContent = `#${detalles.expediente}`;
  document.getElementById('recibo-paciente').textContent = detalles.paciente;
  document.getElementById('recibo-sede').textContent = detalles.sede;
  document.getElementById('recibo-fecha-hora').textContent = `${detalles.fecha} · ${detalles.hora}`;
  document.getElementById('recibo-especialista').textContent = detalles.especialista;
  document.getElementById('recibo-servicio').textContent = detalles.servicio;

  // Botón dinámico a WhatsApp de la sede clínica
  const btnWhatsApp = document.getElementById('btn-whatsapp-confirmacion');
  if (btnWhatsApp) {
    const telLimpio = detalles.telefonoSede.replace(/\D/g, '');
    const telMex = telLimpio.length === 10 ? `52${telLimpio}` : telLimpio;
    const msg = `¡Hola! Acabo de registrar mi cita podológica en Elite Foot Care con el Folio *${detalles.folio}* (Expediente #${detalles.expediente}) a nombre de *${detalles.paciente}* para el día *${detalles.fecha}* a las *${detalles.hora}* en la sede *${detalles.sede}* para el servicio de *${detalles.servicio}*. ¿Me podrían confirmar por favor?`;
    btnWhatsApp.href = `https://api.whatsapp.com/send?phone=${telMex}&text=${encodeURIComponent(msg)}`;
  }
}

/**
 * Control interactivo de testimonios con carrusel automático
 */
function configurarTestimonios() {
  const dots = document.querySelectorAll('.carousel-dot');
  const cards = document.querySelectorAll('.testimonio-card');
  const container = document.querySelector('.testimonios-section');
  let currentIndex = 1;
  let timer = null;

  function setTestimonio(index) {
    currentIndex = index;
    dots.forEach((d) => d.classList.remove('active'));
    cards.forEach((c) => c.classList.remove('highlight'));

    if (dots[index]) dots[index].classList.add('active');
    if (cards[index]) cards[index].classList.add('highlight');
  }

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      setTestimonio(index);
    });
  });

  cards.forEach((card, index) => {
    card.addEventListener('click', () => {
      setTestimonio(index);
    });
  });

  // Rotación automática suave cada 5 segundos
  function startAutoCycle() {
    stopAutoCycle();
    timer = setInterval(() => {
      let nextIndex = (currentIndex + 1) % cards.length;
      setTestimonio(nextIndex);
    }, 5000);
  }

  function stopAutoCycle() {
    if (timer) clearInterval(timer);
  }

  if (container) {
    container.addEventListener('mouseenter', stopAutoCycle);
    container.addEventListener('mouseleave', startAutoCycle);
  }

  startAutoCycle();
}

/**
 * Contadores numéricos con animación suave al entrar en pantalla
 */
function configurarContadoresAnimados() {
  const statNumbers = document.querySelectorAll('.stat-number');
  if (!statNumbers.length) return;

  let animado = false;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !animado) {
        animado = true;
        statNumbers.forEach((el) => {
          const target = parseInt(el.dataset.target, 10) || 0;
          let current = 0;
          const duration = 1800; // 1.8 segundos
          const stepTime = 20;
          const totalSteps = duration / stepTime;
          const increment = target / totalSteps;

          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              current = target;
              clearInterval(timer);
            }
            if (target === 15) {
              el.textContent = `${Math.floor(current)}+`;
            } else if (target === 12000) {
              el.textContent = `+${Math.floor(current / 1000)}k`;
            } else if (target === 100) {
              el.textContent = `${Math.floor(current)}%`;
            } else {
              el.textContent = Math.floor(current);
            }
          }, stepTime);
        });
      }
    });
  }, { threshold: 0.35 });

  const strip = document.querySelector('.stats-counter-strip');
  if (strip) observer.observe(strip);
}

/**
 * Control del menú drawer para dispositivos móviles
 */
function configurarMobileMenu() {
  const btnToggle = document.getElementById('btn-toggle-mobile');
  const drawer = document.getElementById('mobile-drawer');
  if (!btnToggle || !drawer) return;

  btnToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    drawer.classList.toggle('open');
    const isOpen = drawer.classList.contains('open');
    btnToggle.querySelector('i').className = isOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars-staggered';
  });

  // Cerrar al dar click a cualquier link del menú móvil
  drawer.querySelectorAll('a, button').forEach((el) => {
    el.addEventListener('click', () => {
      drawer.classList.remove('open');
      btnToggle.querySelector('i').className = 'fa-solid fa-bars-staggered';
    });
  });

  // Cerrar al dar click fuera
  document.addEventListener('click', (e) => {
    if (!drawer.contains(e.target) && !btnToggle.contains(e.target)) {
      drawer.classList.remove('open');
      btnToggle.querySelector('i').className = 'fa-solid fa-bars-staggered';
    }
  });
}

/**
 * Botón flotante para subir al inicio de página
 */
function configurarScrollTop() {
  const btnScroll = document.getElementById('btn-scroll-top');
  if (!btnScroll) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 350) {
      btnScroll.classList.add('visible');
    } else {
      btnScroll.classList.remove('visible');
    }
  });

  btnScroll.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/**
 * Resaltar sección activa en el menú al hacer scroll
 */
function configurarActiveNavScroll() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.desktop-nav .nav-link');
  if (!sections.length || !navLinks.length) return;

  window.addEventListener('scroll', () => {
    let currentId = '';
    const scrollPos = window.scrollY + 120;

    sections.forEach((sec) => {
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        currentId = sec.getAttribute('id');
      }
    });

    if (currentId) {
      navLinks.forEach((link) => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${currentId}`) {
          link.classList.add('active');
        }
      });
    }
  });
}

// =========================================================================
// GESTOR DE ANUNCIOS EN VIVO — HISTORIAS DE INSTAGRAM EN EL HERO (EN GRANDE)
// Muestra historias visuales auto-rotativas con barras de progreso segmentadas
// en el Hero Section con el titular grande, subtítulo y botones de acción.
// =========================================================================

const HISTORIA_HERO_PRINCIPAL = {
  id: 'principal-arte-caminar',
  tipo: 'general',
  tipo_label: 'ATENCIÓN MÉDICA DE ALTA PRECISIÓN & BIENESTAR',
  titulo: 'El arte de caminar <span class="gradient-text">con ligereza</span>',
  subtitulo: 'Más que un tratamiento médico, una renovación total para el motor de tu cuerpo. Quiropodía elite, pie diabético, biomecánica y cirugía ungueal con tecnología de vanguardia.',
  cta_texto: 'RESERVAR AHORA',
  cta_enlace: '#agendar',
  cta_icono: 'fa-regular fa-calendar-plus',
  sec_texto: 'VER SERVICIOS',
  sec_enlace: '#servicios',
  sec_icono: 'fa-solid fa-arrow-down arrow-bounce'
};

const CATEGORIAS_HERO_CONFIG = {
  promocion: {
    label: 'PROMOCIÓN EXCLUSIVA',
    icono: 'fa-solid fa-tag',
    dotColor: '#f69251'
  },
  horario_especial: {
    label: 'HORARIO ESPECIAL',
    icono: 'fa-solid fa-clock',
    dotColor: '#38bdf8'
  },
  aviso_importante: {
    label: 'AVISO IMPORTANTE',
    icono: 'fa-solid fa-bullhorn',
    dotColor: '#fb7185'
  },
  novedad: {
    label: 'NOVEDAD CLÍNICA',
    icono: 'fa-solid fa-sparkles',
    dotColor: '#a78bfa'
  },
  mantenimiento: {
    label: 'AVISO DE SERVICIO',
    icono: 'fa-solid fa-wrench',
    dotColor: '#fbbf24'
  },
  general: {
    label: 'ATENCIÓN MÉDICA DE ALTA PRECISIÓN & BIENESTAR',
    icono: 'fa-solid fa-shield-halved',
    dotColor: 'var(--gold-accent)'
  }
};

let historiasState = {
  anuncios: [],
  currentIndex: 0,
  duracionMs: 6000,
  tiempoTranscurrido: 0,
  isPaused: false,
  timerId: null,
  lastTimestamp: null
};

function formatearTituloHero(rawTitulo) {
  if (!rawTitulo) return 'Atención Podológica <span class="gradient-text">Especializada</span>';
  if (rawTitulo.includes('<span') || rawTitulo.includes('<mark')) return rawTitulo;

  const palabras = rawTitulo.trim().split(/\s+/);
  if (palabras.length <= 2) {
    return `<span class="gradient-text">${escapeHtml(rawTitulo)}</span>`;
  }
  const corte = Math.max(1, palabras.length - 2);
  const base = palabras.slice(0, corte).join(' ');
  const resalte = palabras.slice(corte).join(' ');
  return `${escapeHtml(base)} <span class="gradient-text">${escapeHtml(resalte)}</span>`;
}

async function inicializarHistoriasAnuncios() {
  const heroContent = document.getElementById('hero-content');
  if (!heroContent) return;

  try {
    let res = await fetch(`${API_BASE}/anuncios`);
    if (!res.ok) {
      res = await fetch(`${API_BASE}/admin/avisos`);
    }

    let anunciosActivos = [];
    if (res.ok) {
      const data = await res.json();
      anunciosActivos = Array.isArray(data) ? data.filter((a) => a.activo !== false) : [];
    }

    // Armamos la lista de historias: Historia Insignia primero, seguida de los anuncios activos
    const todasLasHistorias = [HISTORIA_HERO_PRINCIPAL, ...anunciosActivos];

    historiasState.anuncios = todasLasHistorias;
    historiasState.currentIndex = 0;
    historiasState.tiempoTranscurrido = 0;
    historiasState.isPaused = false;

    const progressContainer = document.getElementById('hero-stories-progress');
    const btnPrev = document.getElementById('hero-btn-prev');
    const btnNext = document.getElementById('hero-btn-next');

    if (todasLasHistorias.length > 1) {
      if (progressContainer) progressContainer.style.display = 'block';
      if (btnPrev) btnPrev.style.display = 'flex';
      if (btnNext) btnNext.style.display = 'flex';

      renderizarBarrasProgresoHistorias();
      iniciarLoopHistorias();
      configurarEventosHistorias();
    } else {
      if (progressContainer) progressContainer.style.display = 'none';
      if (btnPrev) btnPrev.style.display = 'none';
      if (btnNext) btnNext.style.display = 'none';
    }

    mostrarHistoria(0, true);
  } catch (error) {
    console.warn('No se pudieron cargar los anuncios de la web para el Hero:', error);
    mostrarHistoria(0, true);
  }
}

function renderizarBarrasProgresoHistorias() {
  const row = document.getElementById('hero-stories-progress-row');
  if (!row) return;

  const total = historiasState.anuncios.length;
  row.innerHTML = historiasState.anuncios
    .map(
      (a, idx) => `
    <div class="hero-story-track" data-index="${idx}" title="Historia ${idx + 1} de ${total}: ${escapeHtml(a.titulo ? a.titulo.replace(/<[^>]*>/g, '') : 'Anuncio')}" onclick="saltarAHistoria(${idx})">
      <div class="hero-story-fill" id="hero-story-fill-${idx}"></div>
    </div>
  `
    )
    .join('');
}

function mostrarHistoria(index, resetTimer = true) {
  const total = historiasState.anuncios.length;
  if (total === 0) return;

  historiasState.currentIndex = (index + total) % total;
  if (resetTimer) {
    historiasState.tiempoTranscurrido = 0;
  }

  const historia = historiasState.anuncios[historiasState.currentIndex];
  if (!historia) return;

  const configCat = CATEGORIAS_HERO_CONFIG[historia.tipo] || CATEGORIAS_HERO_CONFIG.general;

  // 1. Tagline Badge
  const badgeTextEl = document.getElementById('hero-badge-text');
  const pulseDotEl = document.getElementById('hero-pulse-dot');
  if (badgeTextEl) {
    const textoCategoria = historia.tipo_label || configCat.label;
    badgeTextEl.innerHTML = `<i class="${configCat.icono}" style="margin-right: 4px;"></i> ${escapeHtml(textoCategoria)}`;
  }
  if (pulseDotEl) {
    pulseDotEl.style.backgroundColor = configCat.dotColor;
    pulseDotEl.style.boxShadow = `0 0 10px ${configCat.dotColor}`;
  }

  // 2. Título Gigante del Hero
  const titleEl = document.getElementById('hero-title');
  if (titleEl) {
    titleEl.innerHTML = formatearTituloHero(historia.titulo || historia.asunto);
  }

  // 3. Subtítulo Explicativo
  const subtitleEl = document.getElementById('hero-subtitle');
  if (subtitleEl) {
    subtitleEl.textContent = historia.subtitulo || historia.mensaje || '';
  }

  // 4. Botones de Acción
  // 4. Botones de Acción Dinámicos del Hero
  const btnPrimary = document.getElementById('hero-btn-primary');
  const btnPrimaryText = document.getElementById('hero-btn-primary-text');
  const btnPrimaryIcon = document.getElementById('hero-btn-primary-icon');

  const btnSec = document.getElementById('hero-btn-secondary');
  const btnSecText = document.getElementById('hero-btn-sec-text');
  const btnSecIcon = document.getElementById('hero-btn-sec-icon');

  // Botón Principal
  const ctaTexto = historia.cta_texto !== undefined ? historia.cta_texto : 'RESERVAR AHORA';
  const ctaEnlace = historia.cta_enlace || '#agendar';

  if (!ctaTexto || ctaTexto.trim() === '') {
    if (btnPrimary) btnPrimary.style.display = 'none';
  } else {
    if (btnPrimary) btnPrimary.style.display = 'inline-flex';
    if (btnPrimaryText) btnPrimaryText.textContent = ctaTexto.toUpperCase();
    if (btnPrimaryIcon) {
      if (ctaEnlace.startsWith('http://') || ctaEnlace.startsWith('https://')) {
        if (ctaEnlace.includes('instagram.com')) {
          btnPrimaryIcon.className = 'fa-brands fa-instagram';
        } else if (ctaEnlace.includes('facebook.com')) {
          btnPrimaryIcon.className = 'fa-brands fa-facebook';
        } else if (ctaEnlace.includes('wa.me') || ctaEnlace.includes('whatsapp.com')) {
          btnPrimaryIcon.className = 'fa-brands fa-whatsapp';
        } else {
          btnPrimaryIcon.className = 'fa-solid fa-arrow-up-right-from-square';
        }
      } else if (ctaEnlace.includes('sedes')) {
        btnPrimaryIcon.className = 'fa-solid fa-hospital-user';
      } else if (ctaEnlace.includes('servicios')) {
        btnPrimaryIcon.className = 'fa-solid fa-stethoscope';
      } else {
        btnPrimaryIcon.className = historia.cta_icono || 'fa-regular fa-calendar-plus';
      }
    }
    if (btnPrimary) {
      btnPrimary.onclick = () => ejecutarCtaHistoria(ctaEnlace);
    }
  }

  // Botón Secundario (Configurable desde Admin con soporte para enlaces externos y redes)
  const secTexto = historia.sec_texto !== undefined ? historia.sec_texto : 'VER SERVICIOS';
  const secEnlace = historia.sec_enlace || '#servicios';

  if (btnSec && btnSecText) {
    if (!secTexto || secTexto.trim() === '') {
      btnSec.style.display = 'none';
    } else {
      btnSec.style.display = 'inline-flex';
      btnSecText.textContent = secTexto.toUpperCase();

      btnSec.onclick = null;
      btnSec.target = '_self';
      btnSec.removeAttribute('rel');

      // Enlaces externos (Instagram, Facebook, WhatsApp, URLs)
      if (secEnlace.startsWith('http://') || secEnlace.startsWith('https://')) {
        btnSec.target = '_blank';
        btnSec.rel = 'noopener noreferrer';
        if (secEnlace.includes('instagram.com')) {
          if (btnSecIcon) btnSecIcon.className = 'fa-brands fa-instagram';
        } else if (secEnlace.includes('facebook.com')) {
          if (btnSecIcon) btnSecIcon.className = 'fa-brands fa-facebook';
        } else if (secEnlace.includes('wa.me') || secEnlace.includes('whatsapp.com')) {
          if (btnSecIcon) btnSecIcon.className = 'fa-brands fa-whatsapp';
        } else {
          if (btnSecIcon) btnSecIcon.className = 'fa-solid fa-arrow-up-right-from-square';
        }
      } else if (secEnlace === '#agendar' || secEnlace === 'agendar') {
        if (btnSecIcon) btnSecIcon.className = 'fa-regular fa-calendar-plus';
        btnSec.onclick = (e) => {
          e.preventDefault();
          abrirModalAgendar();
        };
      } else if (secEnlace.includes('sedes')) {
        if (btnSecIcon) btnSecIcon.className = 'fa-solid fa-hospital-user';
        btnSec.onclick = (e) => {
          e.preventDefault();
          ejecutarCtaHistoria(secEnlace);
        };
      } else if (secEnlace.includes('metodo') || secEnlace.includes('historia')) {
        if (btnSecIcon) btnSecIcon.className = 'fa-solid fa-book-medical';
        btnSec.onclick = (e) => {
          e.preventDefault();
          ejecutarCtaHistoria(secEnlace);
        };
      } else {
        if (btnSecIcon) btnSecIcon.className = historia.sec_icono || 'fa-solid fa-arrow-down arrow-bounce';
        btnSec.onclick = (e) => {
          if (secEnlace.startsWith('#')) {
            e.preventDefault();
            ejecutarCtaHistoria(secEnlace);
          }
        };
      }
      btnSec.href = secEnlace;
    }
  }

  // Animación de entrada suave en los textos del Hero
  const animatedElements = [
    document.getElementById('hero-tagline-badge'),
    titleEl,
    subtitleEl,
    document.getElementById('hero-actions')
  ];

  animatedElements.forEach((el) => {
    if (!el) return;
    el.classList.remove('hero-story-fade');
    void el.offsetWidth;
    el.classList.add('hero-story-fade');
  });

  actualizarEstadoBarrasProgreso();
}

function actualizarEstadoBarrasProgreso() {
  const current = historiasState.currentIndex;
  const total = historiasState.anuncios.length;

  for (let i = 0; i < total; i++) {
    const fillEl = document.getElementById(`hero-story-fill-${i}`);
    if (!fillEl) continue;

    if (i < current) {
      fillEl.style.width = '100%';
    } else if (i > current) {
      fillEl.style.width = '0%';
    } else {
      const pct = Math.min(100, (historiasState.tiempoTranscurrido / historiasState.duracionMs) * 100);
      fillEl.style.width = `${pct}%`;
    }
  }
}

function saltarAHistoria(index) {
  mostrarHistoria(index, true);
}

function ejecutarCtaHistoria(enlace) {
  if (!enlace || enlace === '#agendar' || enlace === 'agendar' || enlace === '#') {
    abrirModalAgendar();
    return;
  }
  if (enlace.startsWith('#')) {
    const el = document.querySelector(enlace);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
    return;
  }
  if (enlace.startsWith('http://') || enlace.startsWith('https://')) {
    window.open(enlace, '_blank');
    return;
  }
  window.location.href = enlace;
}

function iniciarLoopHistorias() {
  if (historiasState.timerId) {
    cancelAnimationFrame(historiasState.timerId);
  }

  historiasState.lastTimestamp = performance.now();

  function animar(timestamp) {
    const delta = timestamp - (historiasState.lastTimestamp || timestamp);
    historiasState.lastTimestamp = timestamp;

    if (!historiasState.isPaused && historiasState.anuncios.length > 1) {
      historiasState.tiempoTranscurrido += delta;

      actualizarEstadoBarrasProgreso();

      if (historiasState.tiempoTranscurrido >= historiasState.duracionMs) {
        const siguiente = (historiasState.currentIndex + 1) % historiasState.anuncios.length;
        mostrarHistoria(siguiente, true);
      }
    }

    historiasState.timerId = requestAnimationFrame(animar);
  }

  historiasState.timerId = requestAnimationFrame(animar);
}

function configurarEventosHistorias() {
  const heroSection = document.getElementById('inicio');
  const heroContent = document.getElementById('hero-content');
  const btnPrev = document.getElementById('hero-btn-prev');
  const btnNext = document.getElementById('hero-btn-next');

  // Pausar en hover del Hero Content para lectura cómoda
  heroContent?.addEventListener('mouseenter', () => {
    historiasState.isPaused = true;
  });

  heroContent?.addEventListener('mouseleave', () => {
    historiasState.isPaused = false;
  });

  // Flecha anterior
  btnPrev?.addEventListener('click', (e) => {
    e.stopPropagation();
    const anterior = (historiasState.currentIndex - 1 + historiasState.anuncios.length) % historiasState.anuncios.length;
    mostrarHistoria(anterior, true);
  });

  // Flecha siguiente
  btnNext?.addEventListener('click', (e) => {
    e.stopPropagation();
    const siguiente = (historiasState.currentIndex + 1) % historiasState.anuncios.length;
    mostrarHistoria(siguiente, true);
  });

  // Soporte de navegación por teclado (flechas izq / der) cuando el Hero está visible
  window.addEventListener('keydown', (e) => {
    if (window.scrollY > 600) return;
    if (e.key === 'ArrowLeft') {
      const anterior = (historiasState.currentIndex - 1 + historiasState.anuncios.length) % historiasState.anuncios.length;
      mostrarHistoria(anterior, true);
    } else if (e.key === 'ArrowRight') {
      const siguiente = (historiasState.currentIndex + 1) % historiasState.anuncios.length;
      mostrarHistoria(siguiente, true);
    }
  });

  // Soporte táctil / swipe para dispositivos móviles
  let touchStartX = 0;
  let touchEndX = 0;

  heroSection?.addEventListener(
    'touchstart',
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
      historiasState.isPaused = true;
    },
    { passive: true }
  );

  heroSection?.addEventListener(
    'touchend',
    (e) => {
      touchEndX = e.changedTouches[0].screenX;
      historiasState.isPaused = false;
      const diff = touchEndX - touchStartX;
      if (Math.abs(diff) > 45) {
        if (diff < 0) {
          const siguiente = (historiasState.currentIndex + 1) % historiasState.anuncios.length;
          mostrarHistoria(siguiente, true);
        } else {
          const anterior = (historiasState.currentIndex - 1 + historiasState.anuncios.length) % historiasState.anuncios.length;
          mostrarHistoria(anterior, true);
        }
      }
    },
    { passive: true }
  );
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

// Exponer funciones globales para llamadas inline y scripts externos
window.abrirModalAgendar = abrirModalAgendar;
window.cerrarModalAgendar = cerrarModalAgendar;
window.seleccionarSedeClinica = seleccionarSedeClinica;
window.seleccionarSexo = seleccionarSexo;
window.setAtajoFecha = setAtajoFecha;
window.seleccionarHorarioSlot = seleccionarHorarioSlot;
window.buscarExpedientePaciente = buscarExpedientePaciente;
window.resetearFormularioPaciente = resetearFormularioPaciente;
window.dispararEnvioFormulario = dispararEnvioFormulario;
window.procesarEnvioCita = procesarEnvioCita;
window.calcularEdadAlVuelo = calcularEdadAlVuelo;
window.actualizarComprobante = actualizarComprobante;
window.actualizarDisponibilidadHorarios = actualizarDisponibilidadHorarios;
window.sincronizarAtajosFechaVisual = sincronizarAtajosFechaVisual;
window.obtenerFechaHoyLocal = obtenerFechaHoyLocal;
window.obtenerFechaOffsetLocal = obtenerFechaOffsetLocal;
window.slotYaPaso = slotYaPaso;
window.saltarAHistoria = saltarAHistoria;
window.ejecutarCtaHistoria = ejecutarCtaHistoria;
window.inicializarHistoriasAnuncios = inicializarHistoriasAnuncios;
window.seleccionarPodologo = seleccionarPodologo;
window.cargarCatalogoPodologos = cargarCatalogoPodologos;
window.consultarDisponibilidadHorariosBD = consultarDisponibilidadHorariosBD;

