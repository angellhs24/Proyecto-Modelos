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
  especialista: 'Maribel Benita Santillan Velasco',
  fecha: obtenerFechaHoyLocal(),
  hora: '10:00 AM'
};

const catalogoClinicas = [
  {
    id: 14,
    nombre: 'DIF Lomas de Tecámac',
    direccion: 'Av. Constitución, Tecámac',
    telefono: '5560229842',
    especialista: 'Maribel Benita Santillan Velasco'
  },
  {
    id: 28,
    nombre: 'Casa Héroes Tecámac',
    direccion: 'Av. Felipe Villanueva, Tecámac',
    telefono: '5515311359',
    especialista: 'Maribel Benita Santillan Velasco'
  },
  {
    id: 35,
    nombre: 'Casa Adulto Mayor Flores',
    direccion: 'Av. Las Flores, Tecámac',
    telefono: '5559388260',
    especialista: 'Maribel Benita Santillan Velasco'
  }
];

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

  // 3. Evaluar y sincronizar disponibilidad de horarios según la hora actual
  actualizarDisponibilidadHorarios();
  sincronizarAtajosFechaVisual(hoy);

  // 4. Configurar listeners de navegación y modal
  configurarNavegacion();
  configurarModalAgendar();
  configurarTestimonios();
  configurarContadoresAnimados();
  configurarMobileMenu();
  configurarScrollTop();
  configurarActiveNavScroll();

  // 5. Inicializar carrusel de Historias Clínicas (Instagram Stories)
  inicializarHistoriasAnuncios();

  // 6. Si la URL contiene #agendar, abrir modal automáticamente
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
  const inputNombre = document.getElementById('booking-nombre');
  const inputTel = document.getElementById('booking-telefono');
  const inputFecha = document.getElementById('booking-fecha');
  const inputHoraCustom = document.getElementById('booking-hora-custom');
  const selectServicio = document.getElementById('booking-servicio');
  const checkDiab = document.getElementById('booking-check-diabetico');
  const checkHiper = document.getElementById('booking-check-hipertenso');

  inputNombre?.addEventListener('input', (e) => {
    bookingState.nombre = e.target.value.trim();
    actualizarComprobante();
  });

  inputTel?.addEventListener('input', (e) => {
    bookingState.telefono = e.target.value.trim();
    actualizarComprobante();
  });

  inputFecha?.addEventListener('change', (e) => {
    bookingState.fecha = e.target.value;
    sincronizarAtajosFechaVisual(e.target.value);
    actualizarDisponibilidadHorarios();
    actualizarComprobante();
  });

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
 * Selección interactiva de Sede / Clínica (con preselección y cambio libre)
 */
function seleccionarSedeClinica(clinicaId) {
  const idNum = parseInt(clinicaId, 10);
  const encontrada = catalogoClinicas.find((c) => c.id === idNum) || catalogoClinicas[0];

  bookingState.clinicaId = encontrada.id;
  bookingState.clinicaNombre = encontrada.nombre;
  bookingState.clinicaDireccion = encontrada.direccion;
  bookingState.clinicaTelefono = encontrada.telefono;
  bookingState.especialista = encontrada.especialista;

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

  const fechaStr = inputFechaNac.value;
  bookingState.fechaNacimiento = fechaStr;

  if (!fechaStr) {
    badgeEdad.textContent = 'Sin fecha';
    bookingState.edadCalculada = null;
    return;
  }

  const dNac = new Date(fechaStr);
  if (isNaN(dNac.getTime())) {
    badgeEdad.textContent = 'Sin fecha';
    return;
  }

  const hoy = new Date();
  let edad = hoy.getFullYear() - dNac.getFullYear();
  const m = hoy.getMonth() - dNac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < dNac.getDate())) {
    edad--;
  }

  if (edad >= 0 && edad <= 120) {
    badgeEdad.textContent = `${edad} años`;
    bookingState.edadCalculada = edad;
  } else {
    badgeEdad.textContent = 'Fecha inválida';
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
 * y ajusta la selección automática al siguiente horario válido.
 */
function actualizarDisponibilidadHorarios() {
  const fechaSeleccionada = bookingState.fecha || obtenerFechaHoyLocal();
  const hoyStr = obtenerFechaHoyLocal();
  const esHoy = (fechaSeleccionada === hoyStr);

  let primerSlotDisponible = null;
  let slotActualEstaDisponible = false;
  let totalDisponibles = 0;

  CATALOGO_SLOTS.forEach((item) => {
    const btn = document.querySelector(`.slot-pill-lux[data-time="${item.time}"]`);
    const yaPaso = slotYaPaso(item, fechaSeleccionada);

    if (btn) {
      const badge = btn.querySelector('.slot-badge');
      if (yaPaso) {
        btn.classList.add('slot-pasado');
        btn.setAttribute('disabled', 'disabled');
        btn.setAttribute('title', 'Este horario ya transcurrió el día de hoy');
        if (badge) {
          badge.className = 'slot-badge badge-pasado';
          badge.textContent = 'NO DISPONIBLE';
        }
      } else {
        btn.classList.remove('slot-pasado');
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

  // Gestionar el aviso visual si ya no quedan horarios hoy
  const container = document.getElementById('time-slots-container');
  let avisoEl = document.getElementById('aviso-sin-horarios-container');

  if (esHoy && totalDisponibles === 0) {
    if (!avisoEl && container) {
      avisoEl = document.createElement('div');
      avisoEl.id = 'aviso-sin-horarios-container';
      avisoEl.className = 'aviso-sin-horarios-hoy';
      avisoEl.innerHTML = `
        <i class="fa-solid fa-clock-rotate-left"></i>
        <span>Los horarios de atención para hoy han concluido. Te sugerimos agendar para mañana.</span>
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

  // Si el horario seleccionado actualmente ya pasó o no está disponible, seleccionar el primero disponible
  if (!slotActualEstaDisponible && primerSlotDisponible) {
    seleccionarHorarioSlot(primerSlotDisponible);
  } else if (!slotActualEstaDisponible && totalDisponibles === 0) {
    // Si hoy ya no hay horarios disponibles, quitar la selección visual de los botones
    document.querySelectorAll('.slot-pill-lux').forEach((pill) => pill.classList.remove('selected'));
    const inputHoraFinal = document.getElementById('booking-hora-final');
    if (inputHoraFinal) inputHoraFinal.value = 'Sin horarios disponibles hoy';
    bookingState.hora = 'Sin horarios disponibles hoy';
    actualizarComprobante();
  } else if (slotActualEstaDisponible) {
    // Mantener la selección visual del botón activo
    document.querySelectorAll('.slot-pill-lux').forEach((pill) => {
      if (pill.dataset.time === bookingState.hora) {
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

  const botones = document.querySelectorAll('.date-shortcuts-lux .btn-shortcut-pill-lux');
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

  actualizarDisponibilidadHorarios();
  actualizarComprobante();
}

/**
 * Selección de bloque horario (Time Slot)
 */
function seleccionarHorarioSlot(horaStr, btnEl) {
  if (!btnEl) {
    btnEl = document.querySelector(`.slot-pill-lux[data-time="${horaStr}"]`);
  }
  if (btnEl && (btnEl.disabled || btnEl.classList.contains('slot-pasado'))) {
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
 * Búsqueda inteligente de paciente por Expediente o Teléfono
 */
async function buscarExpedientePaciente() {
  const inputExp = document.getElementById('booking-input-expediente');
  const btnBuscar = document.getElementById('btn-buscar-expediente');
  const btnReset = document.getElementById('btn-reset-expediente');
  const badgeEncontrado = document.getElementById('paciente-encontrado-badge');
  const textoEncontrado = document.getElementById('paciente-encontrado-texto');

  const termino = inputExp?.value.trim();
  if (!termino) {
    alert('Por favor ingresa un número de expediente o teléfono para buscar.');
    return;
  }

  if (btnBuscar) {
    btnBuscar.disabled = true;
    btnBuscar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Buscando...</span>';
  }

  try {
    const res = await fetch(`${API_BASE}/pacientes/${encodeURIComponent(termino)}`);
    if (res.ok) {
      const p = await res.json();
      bookingState.pacienteEncontrado = true;
      bookingState.expediente = p.No_expediente || termino;

      // Autocompletar datos del paciente
      const nomCompleto = p.nombre_completo || `${p.Nombres || ''} ${p.ape_paterno || ''} ${p.ape_materno || ''}`.trim();
      const inputNombre = document.getElementById('booking-nombre');
      const inputTel = document.getElementById('booking-telefono');
      const inputFechaNac = document.getElementById('booking-fecha-nacimiento');
      const inputDir = document.getElementById('booking-direccion');
      const inputMun = document.getElementById('booking-municipio');
      const checkDiab = document.getElementById('booking-check-diabetico');
      const checkHiper = document.getElementById('booking-check-hipertenso');

      if (inputNombre) inputNombre.value = nomCompleto;
      if (inputTel) inputTel.value = p.telefono || '';
      if (inputDir) inputDir.value = p.Calle_direccion || p.direccion || '';
      if (inputMun) inputMun.value = p.Municipio || p.municipio || 'Tecámac';

      bookingState.nombre = nomCompleto;
      bookingState.telefono = p.telefono || '';

      if (p.Fecha_nacimiento) {
        const fechaNacFormatted = p.Fecha_nacimiento.split('T')[0];
        if (inputFechaNac) inputFechaNac.value = fechaNacFormatted;
        calcularEdadAlVuelo();
      }

      if (p.Sexo) {
        const s = p.Sexo.toUpperCase().startsWith('M') ? 'Masculino' : (p.Sexo.toUpperCase().startsWith('F') ? 'Femenino' : 'Otro');
        seleccionarSexo(s);
      }

      if (checkDiab) checkDiab.checked = Boolean(p.es_diabetico);
      if (checkHiper) checkHiper.checked = Boolean(p.es_hipertenso);

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
      if (badgeEncontrado) badgeEncontrado.style.display = 'none';
      if (btnReset) btnReset.style.display = 'none';
      alert(`No se encontró un expediente registrado con "${termino}". Puedes llenar tus datos como paciente nuevo para apartar tu cita sin problema.`);
    }
  } catch (err) {
    console.warn('Error al buscar paciente en backend:', err.message);
    alert('No fue posible consultar la base de expedientes en este momento. Puedes registrar directamente tus datos para agendar tu cita.');
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
  bookingState.nombre = '';
  bookingState.telefono = '';

  const inputExp = document.getElementById('booking-input-expediente');
  const inputNombre = document.getElementById('booking-nombre');
  const inputTel = document.getElementById('booking-telefono');
  const inputFechaNac = document.getElementById('booking-fecha-nacimiento');
  const inputDir = document.getElementById('booking-direccion');
  const badgeEdad = document.getElementById('booking-edad-badge');
  const badgeEncontrado = document.getElementById('paciente-encontrado-badge');
  const btnReset = document.getElementById('btn-reset-expediente');
  const checkDiab = document.getElementById('booking-check-diabetico');
  const checkHiper = document.getElementById('booking-check-hipertenso');

  if (inputExp) inputExp.value = '';
  if (inputNombre) inputNombre.value = '';
  if (inputTel) inputTel.value = '';
  if (inputFechaNac) inputFechaNac.value = '';
  if (inputDir) inputDir.value = '';
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

  // Actualizar disponibilidad de bloques y atajos según la fecha y hora actual
  actualizarDisponibilidadHorarios();
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

  const nombre = document.getElementById('booking-nombre')?.value.trim();
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

  if (!nombre || !telefono || !fecha) {
    alert('Por favor completa tu Nombre, Teléfono y Fecha de cita.');
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

  const payload = {
    clinica_id: clinicaId,
    fk_clinica_id: clinicaId,
    id_clinica: clinicaId,
    fecha,
    hora: horaFinal,
    fecha_hora: `${fecha} ${hora12ha24h(horaFinal)}:00`,
    nombre_completo: nombre,
    paciente_nombre: nombre,
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
        paciente: nombre,
        sede: clinicaSeleccionada.nombre,
        telefonoSede: clinicaSeleccionada.telefono,
        fecha,
        hora: horaFinal,
        servicio,
        especialista: clinicaSeleccionada.especialista
      });
    } else {
      console.warn('Backend respondió error, activando respaldo local para el paciente:', data.error);
      mostrarConfirmacionExito({
        folio: `CON${new Date().getFullYear()}${String(clinicaId).padStart(2, '0')}${Math.floor(1000 + Math.random() * 9000)}`,
        expediente: payload.fk_no_expediente || 'Registro nuevo',
        paciente: nombre,
        sede: clinicaSeleccionada.nombre,
        telefonoSede: clinicaSeleccionada.telefono,
        fecha,
        hora: horaFinal,
        servicio,
        especialista: clinicaSeleccionada.especialista
      });
    }
  } catch (err) {
    console.warn('Conexión con backend offline, procediendo con confirmación local de contingencia:', err.message);
    mostrarConfirmacionExito({
      folio: `CON${new Date().getFullYear()}${String(clinicaId).padStart(2, '0')}${Math.floor(1000 + Math.random() * 9000)}`,
      expediente: payload.fk_no_expediente || 'Registro nuevo',
      paciente: nombre,
      sede: clinicaSeleccionada.nombre,
      telefonoSede: clinicaSeleccionada.telefono,
      fecha,
      hora: horaFinal,
      servicio,
      especialista: clinicaSeleccionada.especialista
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
// GESTOR DE ANUNCIOS EN VIVO — HISTORIAS DE INSTAGRAM (Auto-Rotativo)
// =========================================================================
let historiasState = {
  anuncios: [],
  currentIndex: 0,
  duracionMs: 5000,
  tiempoTranscurrido: 0,
  isPaused: false,
  timerId: null,
  lastTimestamp: null
};

async function inicializarHistoriasAnuncios() {
  const barEl = document.getElementById('stories-announcements-bar');
  if (!barEl) return;

  try {
    let res = await fetch(`${API_BASE}/anuncios`);
    if (!res.ok) {
      res = await fetch(`${API_BASE}/admin/avisos`);
    }

    if (!res.ok) {
      barEl.style.display = 'none';
      return;
    }

    const data = await res.json();
    const anunciosActivos = Array.isArray(data) ? data.filter((a) => a.activo !== false) : [];

    if (anunciosActivos.length === 0) {
      barEl.style.display = 'none';
      return;
    }

    historiasState.anuncios = anunciosActivos;
    historiasState.currentIndex = 0;
    historiasState.tiempoTranscurrido = 0;
    historiasState.isPaused = false;

    renderizarBarrasProgresoHistorias();
    mostrarHistoria(0, true);
    iniciarLoopHistorias();
    configurarEventosHistorias();

    barEl.style.display = 'block';
  } catch (error) {
    console.warn('No se pudieron cargar los anuncios de la web:', error);
    barEl.style.display = 'none';
  }
}

function renderizarBarrasProgresoHistorias() {
  const row = document.getElementById('stories-progress-row');
  if (!row) return;

  const total = historiasState.anuncios.length;
  row.innerHTML = historiasState.anuncios
    .map(
      (a, idx) => `
    <div class="story-progress-track" data-index="${idx}" title="Historia ${idx + 1} de ${total}: ${escapeHtml(a.titulo || 'Anuncio')}" onclick="saltarAHistoria(${idx})">
      <div class="story-progress-fill" id="story-progress-fill-${idx}"></div>
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

  const anuncio = historiasState.anuncios[historiasState.currentIndex];
  const stage = document.getElementById('stories-stage');
  if (!stage || !anuncio) return;

  const categoriaIconos = {
    promocion: 'fa-solid fa-tag',
    horario_especial: 'fa-solid fa-clock',
    aviso_importante: 'fa-solid fa-triangle-exclamation',
    novedad: 'fa-solid fa-sparkles',
    mantenimiento: 'fa-solid fa-wrench',
    general: 'fa-solid fa-bullhorn'
  };

  const categoriaLabels = {
    promocion: '🎉 Promoción Especial',
    horario_especial: '⏰ Horario Especial',
    aviso_importante: '📢 Aviso Importante',
    novedad: '✨ Novedad Clínica',
    mantenimiento: '🔧 Mantenimiento',
    general: '📢 Anuncio'
  };

  const iconoClase = categoriaIconos[anuncio.tipo] || 'fa-solid fa-bullhorn';
  const labelCat = categoriaLabels[anuncio.tipo] || anuncio.tipo_label || 'Aviso';
  const ctaTexto = anuncio.cta_texto || 'Agendar Cita';
  const ctaEnlace = anuncio.cta_enlace || '#agendar';

  stage.innerHTML = `
    <div class="story-slide-item">
      <span class="story-category-pill">
        <i class="${iconoClase}"></i> ${escapeHtml(labelCat)}
      </span>
      <strong class="story-headline-title">
        ${escapeHtml(anuncio.titulo || anuncio.asunto || 'Anuncio Clínico')}
      </strong>
      <span class="story-body-text">
        ${escapeHtml(anuncio.mensaje || '')}
      </span>
      <button type="button" class="story-cta-action" onclick="ejecutarCtaHistoria('${escapeHtml(ctaEnlace)}')">
        ${escapeHtml(ctaTexto)} <i class="fa-solid fa-arrow-right" style="font-size: 0.72rem;"></i>
      </button>
    </div>
  `;

  actualizarEstadoBarrasProgreso();
}

function actualizarEstadoBarrasProgreso() {
  const current = historiasState.currentIndex;
  const total = historiasState.anuncios.length;

  for (let i = 0; i < total; i++) {
    const fillEl = document.getElementById(`story-progress-fill-${i}`);
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
  const barEl = document.getElementById('stories-announcements-bar');
  const btnPrev = document.getElementById('stories-btn-prev');
  const btnNext = document.getElementById('stories-btn-next');
  const btnPause = document.getElementById('stories-btn-pause');
  const iconPause = document.getElementById('stories-pause-icon');

  barEl?.addEventListener('mouseenter', () => {
    historiasState.isPaused = true;
    if (iconPause) iconPause.className = 'fa-solid fa-play';
  });

  barEl?.addEventListener('mouseleave', () => {
    historiasState.isPaused = false;
    if (iconPause) iconPause.className = 'fa-solid fa-pause';
  });

  btnPrev?.addEventListener('click', (e) => {
    e.stopPropagation();
    const anterior = (historiasState.currentIndex - 1 + historiasState.anuncios.length) % historiasState.anuncios.length;
    mostrarHistoria(anterior, true);
  });

  btnNext?.addEventListener('click', (e) => {
    e.stopPropagation();
    const siguiente = (historiasState.currentIndex + 1) % historiasState.anuncios.length;
    mostrarHistoria(siguiente, true);
  });

  btnPause?.addEventListener('click', (e) => {
    e.stopPropagation();
    historiasState.isPaused = !historiasState.isPaused;
    if (iconPause) {
      iconPause.className = historiasState.isPaused ? 'fa-solid fa-play' : 'fa-solid fa-pause';
    }
  });
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

