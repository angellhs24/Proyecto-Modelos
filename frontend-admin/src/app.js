/**
 * ==========================================================================
 * ELITE FOOT CARE - SISTEMA DE GESTIÓN PODOLÓGICA CLÍNICA
 * Look & Feel Boutique Editorial (Inspirado en la estética mobile moderna)
 * Conexión con PostgreSQL / API Backend y Modo Autónomo
 * ==========================================================================
 */

const API_BASE_URL = 'http://localhost:4000/api';

// Constantes y formateadores de fechas
const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function getFechaActualFormateada() {
  const hoy = new Date();
  const diaSemana = DIAS_SEMANA[hoy.getDay()];
  const dia = hoy.getDate();
  const mes = NOMBRES_MESES[hoy.getMonth()];
  const anio = hoy.getFullYear();
  return `${diaSemana}, ${dia} de ${mes} de ${anio}`;
}

function getFechaCortaHoy() {
  const hoy = new Date();
  const dia = hoy.getDate();
  const mes = NOMBRES_MESES[hoy.getMonth()];
  const anio = hoy.getFullYear();
  return `${dia} de ${mes} ${anio}`;
}

// Estado global de la aplicación
const state = {
  user: 'Angel Hdez Santillan',
  userRole: 'Podólogo Titular',
  userCedula: 'Céd. Prof. 000001',
  page: 'inicio', // 'inicio' | 'agenda' | 'pacientes' | 'consulta' | 'agendar' | 'reportes' | 'login'
  currentClinicId: 14,
  homeCategoryFilter: 'todos', // 'todos' | 'diabeticos' | 'hipertensos' | 'confirmadas'
  clinics: [
    { id_clinica: 14, Clinica_id: 14, nombre: 'DIF Lomas de Tecámac', direccion: 'Av. Constitución, Tecámac', telefono: '5560229842' },
    { id_clinica: 28, Clinica_id: 28, nombre: 'Casa Héroes Tecámac', direccion: 'Av. Felipe Villanueva, Tecámac', telefono: '5515311359' },
    { id_clinica: 35, Clinica_id: 35, nombre: 'Casa Adulto Mayor Flores', direccion: 'Av. Las Flores, Tecámac', telefono: '5559388260' }
  ],
  patients: [],
  appointments: [],
  selectedDayData: null,
  selectedPatientDetail: null,
  isPasswordVisible: false,
  searchTerm: '',

  // Control del calendario interactivo con límite de ±3 meses respecto a la fecha actual
  calendar: {
    month: new Date().getMonth(), // 0 - 11
    year: new Date().getFullYear(),
    baseMonth: new Date().getMonth(),
    baseYear: new Date().getFullYear()
  },

  // Estado del formulario de nueva cita (Agendar)
  bookingForm: {
    expediente: '',
    paciente_encontrado: false,
    isLocked: false,
    nombre_completo: '',
    telefono: '',
    fecha_nacimiento: '',
    edad: '',
    sexo: '',
    calle_direccion: '',
    municipio: '',
    ocupacion: '',
    antecedentes_patologicos: '',
    calzado: '',
    es_diabetico: false,
    es_hipertenso: false,
    notas_alergias: '',
    id_clinica: 14,
    fecha: new Date().toISOString().split('T')[0],
    hora: '10:00 AM',
    motivo: 'Quiropodia Clínica General'
  },

  // Estado del formulario de Consulta Podológica (Directa Walk-in o Cita Previa Convertida)
  consultaForm: {
    tipo_origen: 'directa', // 'directa' (Sin Cita / Walk-in) | 'cita_previa' (Confirmar Asistencia Cita)
    cita_seleccionada_id: '',
    expediente: '',
    paciente_encontrado: false,
    isLocked: false,
    nombre_completo: '',
    telefono: '',
    fecha_nacimiento: '',
    edad: '',
    sexo: '',
    calle_direccion: '',
    municipio: '',
    ocupacion: '',
    antecedentes_patologicos: '',
    calzado: '',
    es_diabetico: false,
    es_hipertenso: false,
    notas_alergias: '',
    id_clinica: 14,
    fecha_hora: new Date().toISOString().slice(0, 16),
    motivo: 'Atención Podológica Directa (Sin Cita Previa)',
    peso: '',
    altura: '',
    tipo_pisada: 'Neutra',
    alineacion: 'Neutra',
    observaciones: '',
    estado: 'Completada',
    diagnosticos: [
      {
        padecimiento: 'Hiperqueratosis plantar',
        pie_izquierdo: true,
        pie_derecho: true,
        tipo_diagnostico: 'Correctivo',
        detalles_adicionales: ''
      }
    ],
    tratamientos: [
      {
        procedimiento_servicio: 'Quiropodia Clínica',
        pie_izquierdo: true,
        pie_derecho: true,
        tratamiento_aplicado: 'Desbridamiento de durezas e hidratación profunda con urea',
        frecuencia: 'Control en 30 días'
      }
    ]
  }
};


// ==========================================
// 1. PETICIONES A LA API (BACKEND / POSTGRESQL)
// ==========================================

async function fetchClinicas() {
  try {
    const res = await fetch(`${API_BASE_URL}/clinicas`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        state.clinics = data;
        if (!state.bookingForm.id_clinica) {
          state.bookingForm.id_clinica = data[0].id_clinica;
        }
        if (!state.consultaForm.id_clinica) {
          state.consultaForm.id_clinica = data[0].id_clinica;
        }
      }
    }
  } catch (error) {
    console.warn('Servidor backend no disponible para clínicas, usando sedes locales:', error);
  }
}

async function fetchPacientes() {
  try {
    const res = await fetch(`${API_BASE_URL}/pacientes`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        state.patients = data;
      }
    }
  } catch (error) {
    console.warn('No se pudieron cargar pacientes desde la API:', error);
  }
}

async function fetchCitas() {
  try {
    const clinicId = state.currentClinicId || 14;
    const res = await fetch(`${API_BASE_URL}/citas/clinica/${clinicId}`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        state.appointments = data;
        verificarCitasVencidas(state.appointments);
        extraerPacientesDeCitas(data);
      } else {
        cargarCitasDemoSiVacio();
      }
    } else {
      cargarCitasDemoSiVacio();
    }
  } catch (error) {
    console.warn('Cargando modo seguro con datos de prueba:', error);
    cargarCitasDemoSiVacio();
  }
  render();
}


function extraerPacientesDeCitas(citas) {
  const pacientesMap = new Map();
  
  state.patients.forEach(p => {
    if (p.telefono) pacientesMap.set(p.telefono, p);
  });

  citas.forEach(c => {
    if (c.paciente_nombre) {
      const key = c.paciente_telefono || c.paciente_nombre;
      const patientId = c.id_paciente || Math.floor(Math.random() * 1000);
      pacientesMap.set(key, {
        id_paciente: patientId,
        expediente: c.expediente || `2026${String(patientId).padStart(6, '0')}`,
        nombre_completo: c.paciente_nombre,
        telefono: c.paciente_telefono || '55 0000 0000',
        es_diabetico: !!c.es_diabetico,
        es_hipertenso: !!c.es_hipertenso,
        notas_alergias: c.notas_alergias || 'Atención en quiropodia regular',
        edad: 58,
        sexo: 'Femenino',
        ultima_cita: c.fecha_hora_inicio || '2026-08-18'
      });
    }
  });

  state.patients = Array.from(pacientesMap.values());
  if (state.patients.length === 0) {
    cargarPacientesDemo();
  }
}

function cargarPacientesDemo() {
  state.patients = [
    { id_paciente: 101, expediente: '2026140001', nombre_completo: 'Rosa María Martínez', telefono: '55 4123 8970', edad: 62, sexo: 'Femenino', es_diabetico: true, es_hipertenso: true, notas_alergias: 'Pie diabético preventivo, hiperqueratosis moderada.', ultima_cita: '2026-08-18 10:00' },
    { id_paciente: 102, expediente: '2026140002', nombre_completo: 'Carlos Eduardo Mendoza', telefono: '55 7890 1234', edad: 45, sexo: 'Masculino', es_diabetico: false, es_hipertenso: false, notas_alergias: 'Onicocriptosis en primer dedo pie derecho.', ultima_cita: '2026-08-18 11:30' },
    { id_paciente: 103, expediente: '2026140003', nombre_completo: 'Guadalupe Hernández', telefono: '55 3322 1144', edad: 70, sexo: 'Femenino', es_diabetico: true, es_hipertenso: false, notas_alergias: 'Sensibilidad reducida en talones.', ultima_cita: '2026-08-18 13:00' },
    { id_paciente: 104, expediente: '2026140004', nombre_completo: 'Fernando Gómez Cruz', telefono: '55 9988 7766', edad: 53, sexo: 'Masculino', es_diabetico: false, es_hipertenso: true, notas_alergias: 'Fascitis plantar bilateral y helomas.', ultima_cita: '2026-08-18 16:00' },
    { id_paciente: 105, expediente: '2026140005', nombre_completo: 'Elena Valenzuela', telefono: '55 6677 8899', edad: 39, sexo: 'Femenino', es_diabetico: false, es_hipertenso: false, notas_alergias: 'Revisión preventiva de uñas encarnadas.', ultima_cita: '2026-08-19 11:00' }
  ];
}

function cargarCitasDemoSiVacio() {
  if (state.appointments.length === 0) {
    state.appointments = [
      {
        id_cita: 1,
        fecha_hora_inicio: '2026-08-18 10:00',
        hora: '10:00',
        ampm: 'AM',
        paciente_nombre: 'Rosa María Martínez',
        paciente_telefono: '55 4123 8970',
        es_diabetico: true,
        es_hipertenso: true,
        estado: 'Confirmada',
        motivo: 'Control de Pie Diabético y Deslaminado',
        id_clinica: 1
      },
      {
        id_cita: 2,
        fecha_hora_inicio: '2026-08-18 11:30',
        hora: '11:30',
        ampm: 'AM',
        paciente_nombre: 'Carlos Eduardo Mendoza',
        paciente_telefono: '55 7890 1234',
        es_diabetico: false,
        es_hipertenso: false,
        estado: 'Confirmada',
        motivo: 'Tratamiento de Onicocriptosis',
        id_clinica: 1
      },
      {
        id_cita: 3,
        fecha_hora_inicio: '2026-08-18 13:00',
        hora: '01:00',
        ampm: 'PM',
        paciente_nombre: 'Guadalupe Hernández',
        paciente_telefono: '55 3322 1144',
        es_diabetico: true,
        es_hipertenso: false,
        estado: 'Pendiente',
        motivo: 'Quiropodia Completa y Valoración',
        id_clinica: 1
      },
      {
        id_cita: 4,
        fecha_hora_inicio: '2026-08-18 16:00',
        hora: '04:00',
        ampm: 'PM',
        paciente_nombre: 'Fernando Gómez Cruz',
        paciente_telefono: '55 9988 7766',
        es_diabetico: false,
        es_hipertenso: true,
        estado: 'Confirmada',
        motivo: 'Revisión y Tratamiento de Helomas',
        id_clinica: 1
      }
    ];
  }
  extraerPacientesDeCitas(state.appointments);
}

async function guardarCitaEnBackend(e) {
  if (e) e.preventDefault();

  const form = state.bookingForm;
  if (!form.nombre_completo.trim() || !form.telefono.trim()) {
    toast('Por favor completa el nombre y teléfono del paciente');
    return;
  }

  try {
    toast('Guardando cita...');
    
    let id_paciente = null;
    try {
      const resPaciente = await fetch(`${API_BASE_URL}/pacientes/expres`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_completo: form.nombre_completo.trim(),
          telefono: form.telefono.trim(),
          Fecha_nacimiento: form.fecha_nacimiento || null,
          Calle_direccion: form.calle_direccion || null,
          Municipio: form.municipio || null,
          Ocupacion: form.ocupacion || null,
          Calzado: form.calzado || null,
          Antecedentes_patologicos: form.antecedentes_patologicos || null,
          es_diabetico: !!form.es_diabetico,
          es_hipertenso: !!form.es_hipertenso,
          Notas: form.notas_alergias.trim(),
          notas_alergias: form.notas_alergias.trim(),
          clinica_id: parseInt(form.id_clinica) || state.currentClinicId || 14
        })
      });

      if (resPaciente.ok) {
        const pacienteData = await resPaciente.json();
        id_paciente = pacienteData.paciente?.No_expediente || pacienteData.paciente?.id_paciente || pacienteData.paciente?.id;
      }
    } catch (err) {
      console.warn('Conexión con endpoint de pacientes omitida:', err);
    }

    const fechaHoraCompleta = `${form.fecha} ${form.hora}`;
    const payloadCita = {
      fk_no_expediente: id_paciente,
      id_paciente: id_paciente,
      nombre_completo: form.nombre_completo.trim(),
      telefono: form.telefono.trim(),
      Fecha_nacimiento: form.fecha_nacimiento || null,
      Calle_direccion: form.calle_direccion || null,
      Municipio: form.municipio || null,
      Ocupacion: form.ocupacion || null,
      Calzado: form.calzado || null,
      Antecedentes_patologicos: form.antecedentes_patologicos || null,
      es_diabetico: form.es_diabetico,
      es_hipertenso: form.es_hipertenso,
      notas_alergias: form.notas_alergias,
      fk_clinica_id: parseInt(form.id_clinica) || state.currentClinicId || 14,
      id_clinica: parseInt(form.id_clinica) || state.currentClinicId || 14,
      fecha_hora_inicio: fechaHoraCompleta,
      motivo_o_notas: form.motivo || 'Quiropodia Clínica General',
      estado: 'Confirmada'
    };


    try {
      const resCita = await fetch(`${API_BASE_URL}/citas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadCita)
      });
      if (resCita.ok) {
        await fetchCitas();
      }
    } catch (err) {
      console.warn('Guardado en API remota omitido:', err);
    }

    const nuevaCitaLocal = {
      id_cita: Math.floor(Math.random() * 10000),
      fecha_hora_inicio: fechaHoraCompleta,
      hora: form.hora.replace(' AM', '').replace(' PM', ''),
      ampm: form.hora.includes('PM') ? 'PM' : 'AM',
      paciente_nombre: form.nombre_completo,
      paciente_telefono: form.telefono,
      es_diabetico: form.es_diabetico,
      es_hipertenso: form.es_hipertenso,
      estado: 'Confirmada',
      motivo: form.motivo || 'Consulta Podológica',
      id_clinica: parseInt(form.id_clinica)
    };

    if (!state.appointments.some(c => c.paciente_telefono === form.telefono && c.fecha_hora_inicio === fechaHoraCompleta)) {
      state.appointments.unshift(nuevaCitaLocal);
    }
    
    const existePaciente = state.patients.some(p => p.telefono === form.telefono);
    if (!existePaciente) {
      state.patients.unshift({
        id_paciente: id_paciente || nuevaCitaLocal.id_cita,
        expediente: form.expediente || `2026${String(Math.floor(Math.random() * 9000)).padStart(6, '0')}`,
        nombre_completo: form.nombre_completo,
        telefono: form.telefono,
        edad: form.edad || 50,
        sexo: form.sexo || 'Femenino',
        es_diabetico: form.es_diabetico,
        es_hipertenso: form.es_hipertenso,
        notas_alergias: form.notas_alergias,
        ultima_cita: fechaHoraCompleta
      });
    }

    toast('¡Cita agendada y registrada exitosamente!');

    state.bookingForm = {
      expediente: '',
      paciente_encontrado: false,
      isLocked: false,
      nombre_completo: '',
      telefono: '',
      edad: '',
      sexo: 'Femenino',
      es_diabetico: false,
      es_hipertenso: false,
      notas_alergias: '',
      id_clinica: state.currentClinicId,
      fecha: new Date().toISOString().split('T')[0],
      hora: '10:00 AM',
      motivo: 'Quiropodia Clínica General'
    };

    state.page = 'inicio';
    render();
  } catch (error) {
    console.error('Error al registrar la cita:', error);
    toast('Hubo un inconveniente al guardar la cita');
  }
}

// ==========================================
// 2. UTILIDADES Y NAVEGACIÓN
// ==========================================

async function buscarExpediente(expedienteDirecto) {
  const inputEl = document.getElementById('input-expediente');
  const query = (expedienteDirecto || (inputEl ? inputEl.value : '') || state.bookingForm.expediente || '').trim();

  if (!query) {
    toast('Ingresa un No. de Expediente o Teléfono para buscar');
    return;
  }

  let paciente = state.patients.find(p => 
    (p.expediente && p.expediente.toString().toLowerCase() === query.toLowerCase()) ||
    (p.id_paciente && p.id_paciente.toString() === query) ||
    (p.No_expediente && p.No_expediente.toString().toLowerCase() === query.toLowerCase()) ||
    (p.telefono && p.telefono.replace(/\D/g, '') === query.replace(/\D/g, '')) ||
    (p.nombre_completo && p.nombre_completo.toLowerCase().includes(query.toLowerCase()))
  );

  // Si no está en memoria local o faltan datos, consultar directamente al backend MySQL
  if (!paciente || (!paciente.Calle_direccion && !paciente.calle_direccion)) {
    try {
      let res = await fetch(`${API_BASE_URL}/pacientes/${encodeURIComponent(query)}`);
      if (res.ok) {
        paciente = await res.json();
      } else {
        res = await fetch(`${API_BASE_URL}/pacientes?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const encontrados = await res.json();
          if (Array.isArray(encontrados) && encontrados.length > 0) {
            paciente = encontrados[0];
          }
        }
      }
      if (paciente && !state.patients.some(p => (p.expediente || p.No_expediente) === (paciente.expediente || paciente.No_expediente))) {
        state.patients.unshift(paciente);
      }
    } catch (err) {
      console.warn('Búsqueda remota omitida:', err);
    }
  }

  if (paciente) {
    const fNac = (paciente.Fecha_nacimiento || paciente.fecha_nacimiento || '').split('T')[0];
    state.bookingForm.expediente = paciente.expediente || paciente.No_expediente || query;
    state.bookingForm.nombre_completo = paciente.nombre_completo || `${paciente.Nombres || ''} ${paciente.ape_paterno || ''}`.trim();
    state.bookingForm.telefono = paciente.telefono || '';
    state.bookingForm.fecha_nacimiento = fNac;
    state.bookingForm.edad = calcularEdad(fNac) || paciente.edad || '';
    state.bookingForm.sexo = paciente.sexo || (paciente.Sexo === 'M' ? 'Masculino' : paciente.Sexo === 'F' ? 'Femenino' : (paciente.Sexo || ''));
    state.bookingForm.calle_direccion = paciente.Calle_direccion || paciente.calle_direccion || '';
    state.bookingForm.municipio = paciente.Municipio || paciente.municipio || '';
    state.bookingForm.ocupacion = paciente.Ocupacion || paciente.ocupacion || '';
    state.bookingForm.calzado = paciente.Calzado || paciente.calzado || '';
    state.bookingForm.antecedentes_patologicos = paciente.Antecedentes_patologicos || paciente.antecedentes_patologicos || '';
    state.bookingForm.es_diabetico = !!paciente.es_diabetico;
    state.bookingForm.es_hipertenso = !!paciente.es_hipertenso;
    state.bookingForm.notas_alergias = paciente.notas_alergias || paciente.Notas || '';
    state.bookingForm.paciente_encontrado = true;
    state.bookingForm.isLocked = true;

    toast(`Expediente vinculado: ${state.bookingForm.nombre_completo}`);
    render();
    updateBookingSummary();
  } else {
    toast(`No se encontró paciente con: "${query}"`);
  }
}

function resetearFormularioPaciente() {
  state.bookingForm.expediente = '';
  state.bookingForm.nombre_completo = '';
  state.bookingForm.telefono = '';
  state.bookingForm.fecha_nacimiento = '';
  state.bookingForm.edad = '';
  state.bookingForm.sexo = '';
  state.bookingForm.calle_direccion = '';
  state.bookingForm.municipio = '';
  state.bookingForm.ocupacion = '';
  state.bookingForm.calzado = '';
  state.bookingForm.antecedentes_patologicos = '';
  state.bookingForm.es_diabetico = false;
  state.bookingForm.es_hipertenso = false;
  state.bookingForm.notas_alergias = '';
  state.bookingForm.paciente_encontrado = false;
  state.bookingForm.isLocked = false;

  toast('Formulario listo para nuevo paciente');
  render();
  updateBookingSummary();
}

// ------------------------------------------
// CONTROLADORES DE CONSULTA DIRECTA (SIN CITA)
// ------------------------------------------

async function buscarExpedienteConsulta(expedienteDirecto) {
  const inputEl = document.getElementById('input-expediente-consulta');
  const query = (expedienteDirecto || (inputEl ? inputEl.value : '') || state.consultaForm.expediente || '').trim();

  if (!query) {
    toast('Ingresa un No. de Expediente o Teléfono para buscar');
    return;
  }

  let paciente = state.patients.find(p => 
    (p.expediente && p.expediente.toString().toLowerCase() === query.toLowerCase()) ||
    (p.id_paciente && p.id_paciente.toString() === query) ||
    (p.No_expediente && p.No_expediente.toString().toLowerCase() === query.toLowerCase()) ||
    (p.telefono && p.telefono.replace(/\D/g, '') === query.replace(/\D/g, '')) ||
    (p.nombre_completo && p.nombre_completo.toLowerCase().includes(query.toLowerCase()))
  );

  // Si no está en memoria local o faltan datos, buscar en MySQL por endpoint exacto o por búsqueda
  if (!paciente || (!paciente.Calle_direccion && !paciente.calle_direccion)) {
    try {
      let res = await fetch(`${API_BASE_URL}/pacientes/${encodeURIComponent(query)}`);
      if (res.ok) {
        paciente = await res.json();
      } else {
        res = await fetch(`${API_BASE_URL}/pacientes?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const encontrados = await res.json();
          if (Array.isArray(encontrados) && encontrados.length > 0) {
            paciente = encontrados[0];
          }
        }
      }
      if (paciente && !state.patients.some(p => (p.expediente || p.No_expediente) === (paciente.expediente || paciente.No_expediente))) {
        state.patients.unshift(paciente);
      }
    } catch (err) {
      console.warn('Búsqueda remota de paciente omitida:', err);
    }
  }

  if (paciente) {
    const fNac = (paciente.Fecha_nacimiento || paciente.fecha_nacimiento || '').split('T')[0];
    state.consultaForm.expediente = paciente.expediente || paciente.No_expediente || query;
    state.consultaForm.nombre_completo = paciente.nombre_completo || `${paciente.Nombres || ''} ${paciente.ape_paterno || ''}`.trim();
    state.consultaForm.telefono = paciente.telefono || '';
    state.consultaForm.fecha_nacimiento = fNac;
    state.consultaForm.edad = calcularEdad(fNac) || paciente.edad || '';
    state.consultaForm.sexo = paciente.sexo || (paciente.Sexo === 'M' ? 'Masculino' : paciente.Sexo === 'F' ? 'Femenino' : (paciente.Sexo || ''));
    state.consultaForm.calle_direccion = paciente.Calle_direccion || paciente.calle_direccion || '';
    state.consultaForm.municipio = paciente.Municipio || paciente.municipio || '';
    state.consultaForm.ocupacion = paciente.Ocupacion || paciente.ocupacion || '';
    state.consultaForm.calzado = paciente.Calzado || paciente.calzado || '';
    state.consultaForm.antecedentes_patologicos = paciente.Antecedentes_patologicos || paciente.antecedentes_patologicos || '';
    state.consultaForm.es_diabetico = !!paciente.es_diabetico;
    state.consultaForm.es_hipertenso = !!paciente.es_hipertenso;
    state.consultaForm.notas_alergias = paciente.notas_alergias || paciente.Notas || '';
    state.consultaForm.paciente_encontrado = true;
    state.consultaForm.isLocked = true;

    toast(`Expediente vinculado: ${state.consultaForm.nombre_completo}`);
    render();
  } else {
    toast(`No se encontró paciente con: "${query}"`);
  }
}

function resetearFormularioConsulta() {
  state.consultaForm = {
    tipo_origen: 'directa',
    cita_seleccionada_id: '',
    expediente: '',
    paciente_encontrado: false,
    isLocked: false,
    nombre_completo: '',
    telefono: '',
    fecha_nacimiento: '',
    edad: '',
    sexo: '',
    calle_direccion: '',
    municipio: '',
    ocupacion: '',
    calzado: '',
    antecedentes_patologicos: '',
    es_diabetico: false,
    es_hipertenso: false,
    notas_alergias: '',
    id_clinica: state.currentClinicId || 14,
    fecha_hora: new Date().toISOString().slice(0, 16),
    motivo: 'Atención Podológica Directa (Sin Cita Previa)',
    peso: '',
    altura: '',
    tipo_pisada: 'Neutra',
    alineacion: 'Neutra',
    observaciones: '',
    estado: 'Completada',
    diagnosticos: [
      {
        padecimiento: 'Hiperqueratosis plantar',
        pie_izquierdo: true,
        pie_derecho: true,
        tipo_diagnostico: 'Correctivo',
        detalles_adicionales: ''
      }
    ],
    tratamientos: [
      {
        procedimiento_servicio: 'Quiropodia Clínica',
        pie_izquierdo: true,
        pie_derecho: true,
        tratamiento_aplicado: 'Desbridamiento de durezas e hidratación profunda con urea',
        frecuencia: 'Control en 30 días'
      }
    ]
  };

  toast('Formulario listo para nuevo paciente y consulta');
  render();
}


function iniciarConsultaDirectaConPaciente(p) {
  if (!p) return;
  state.consultaForm.expediente = p.expediente || p.No_expediente || '';
  state.consultaForm.nombre_completo = p.nombre_completo || `${p.Nombres || ''} ${p.ape_paterno || ''}`.trim();
  state.consultaForm.telefono = p.telefono || '';
  state.consultaForm.edad = p.edad || '';
  state.consultaForm.sexo = p.sexo || (p.Sexo === 'M' ? 'Masculino' : 'Femenino');
  state.consultaForm.es_diabetico = !!p.es_diabetico;
  state.consultaForm.es_hipertenso = !!p.es_hipertenso;
  state.consultaForm.notas_alergias = p.notas_alergias || p.Notas || '';
  state.consultaForm.paciente_encontrado = true;
  state.consultaForm.isLocked = true;
  state.consultaForm.fecha_hora = new Date().toISOString().slice(0, 16);

  navigate('consulta');
  toast(`Iniciando consulta para ${state.consultaForm.nombre_completo}`);
}

function calcularIMC(peso, altura) {
  const p = parseFloat(peso);
  let a = parseFloat(altura);
  if (!p || !a || p <= 0 || a <= 0) return null;
  if (a > 3) a = a / 100; // conversión si escribió en cm (ej. 170 -> 1.70)
  const imc = p / (a * a);
  let clasificacion = 'Normal';
  let badgeClass = '';
  if (imc < 18.5) { clasificacion = 'Bajo peso'; badgeClass = 'warning'; }
  else if (imc < 25) { clasificacion = 'Normal'; badgeClass = ''; }
  else if (imc < 30) { clasificacion = 'Sobrepeso'; badgeClass = 'warning'; }
  else { clasificacion = 'Obesidad'; badgeClass = 'danger'; }
  return { valor: imc.toFixed(1), clasificacion, badgeClass };
}

function actualizarIMCEnPantalla() {
  const pesoInput = document.getElementById('input-peso');
  const alturaInput = document.getElementById('input-altura');
  const pesoVal = pesoInput ? pesoInput.value : state.consultaForm.peso;
  const alturaVal = alturaInput ? alturaInput.value : state.consultaForm.altura;

  state.consultaForm.peso = pesoVal;
  state.consultaForm.altura = alturaVal;

  const imcData = calcularIMC(pesoVal, alturaVal);
  const container = document.getElementById('imc-badge-container');
  if (!container) return;

  if (imcData) {
    container.innerHTML = `
      <span class="imc-num">${imcData.valor}</span>
      <span class="imc-tag ${imcData.badgeClass}">${imcData.clasificacion}</span>
    `;
  } else {
    container.innerHTML = `
      <span class="imc-num">--</span>
      <span style="font-size:11px; color:var(--text-muted);">Sin datos</span>
    `;
  }
}

function setConsultaSexo(sexo) {
  state.consultaForm.sexo = sexo;
  document.querySelectorAll('#consulta-form .sex-choice-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === sexo);
  });
}

function setConsultaMotivo(motivo) {
  state.consultaForm.motivo = motivo;
  const input = document.getElementById('input-consulta-motivo');
  if (input) input.value = motivo;
}

function setConsultaEstado(estado) {
  state.consultaForm.estado = estado;
  document.querySelectorAll('#consulta-form .choice-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-estado') === estado);
  });
}

function calcularEdad(fechaNacStr) {
  if (!fechaNacStr) return null;
  const hoy = new Date();
  const nac = new Date(fechaNacStr);
  if (isNaN(nac.getTime())) return null;
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) {
    edad--;
  }
  return edad >= 0 ? edad : null;
}

function actualizarEdadEnPantalla() {
  const nacInput = document.getElementById('input-fecha-nacimiento-consulta');
  const badge = document.getElementById('edad-calculada-badge');
  if (nacInput && badge) {
    state.consultaForm.fecha_nacimiento = nacInput.value;
    const edad = calcularEdad(nacInput.value);
    state.consultaForm.edad = edad || '';
    badge.textContent = edad !== null ? `${edad} años` : 'Ingresa fecha';
  }
}

function actualizarEdadBookingEnPantalla() {
  const nacInput = document.getElementById('input-fecha-nacimiento-booking');
  const badge = document.getElementById('edad-calculada-booking-badge');
  if (nacInput && badge) {
    state.bookingForm.fecha_nacimiento = nacInput.value;
    const edad = calcularEdad(nacInput.value);
    state.bookingForm.edad = edad || '';
    badge.textContent = edad !== null ? `${edad} años` : 'Ingresa fecha';
  }
}

function setTipoOrigenConsulta(tipo) {
  state.consultaForm.tipo_origen = tipo;
  if (tipo === 'directa') {
    state.consultaForm.cita_seleccionada_id = '';
    state.consultaForm.motivo = 'Atención Podológica Directa (Sin Cita Previa)';
  }
  render();
}

function seleccionarCitaParaConsulta(citaId) {
  if (!citaId) return;
  const cita = state.appointments.find(a => (a.id_cita == citaId || a.Consulta_id == citaId));
  if (!cita) return;

  const fNac = (cita.Fecha_nacimiento || cita.fecha_nacimiento || '').split('T')[0];
  state.consultaForm.tipo_origen = 'cita_previa';
  state.consultaForm.cita_seleccionada_id = citaId;
  state.consultaForm.expediente = cita.expediente || cita.id_paciente || cita.fk_no_expediente || '';
  state.consultaForm.nombre_completo = cita.paciente_nombre || '';
  state.consultaForm.telefono = cita.paciente_telefono || cita.telefono || '';
  state.consultaForm.fecha_nacimiento = fNac;
  state.consultaForm.edad = cita.paciente_edad || (fNac ? calcularEdad(fNac) : '') || '';
  state.consultaForm.sexo = cita.sexo || (cita.Sexo === 'M' ? 'Masculino' : cita.Sexo === 'F' ? 'Femenino' : (cita.Sexo || ''));
  state.consultaForm.calle_direccion = cita.Calle_direccion || cita.calle_direccion || '';
  state.consultaForm.municipio = cita.Municipio || cita.municipio || '';
  state.consultaForm.ocupacion = cita.Ocupacion || cita.ocupacion || '';
  state.consultaForm.calzado = cita.Calzado || cita.calzado || '';
  state.consultaForm.antecedentes_patologicos = cita.Antecedentes_patologicos || cita.antecedentes_patologicos || '';
  state.consultaForm.es_diabetico = !!cita.es_diabetico;
  state.consultaForm.es_hipertenso = !!cita.es_hipertenso;
  state.consultaForm.notas_alergias = cita.notas_alergias || cita.Notas || '';
  state.consultaForm.id_clinica = cita.id_clinica || cita.fk_clinica_id || state.currentClinicId || 14;
  state.consultaForm.motivo = cita.motivo || cita.motivo_o_notas || 'Atención de Cita Agendada';
  state.consultaForm.estado = 'Completada';
  state.consultaForm.paciente_encontrado = true;
  state.consultaForm.isLocked = true;

  toast(`Cita de ${cita.paciente_nombre} cargada en consulta.`);
  render();
}

function setFechaConsultaRapida(offsetDias, horaSugerida = null) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  const fechaStr = d.toISOString().split('T')[0];
  let horaStr = horaSugerida;
  if (!horaStr) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    horaStr = `${hh}:${mm}`;
  }
  state.consultaForm.fecha_hora = `${fechaStr}T${horaStr}`;
  const inputEl = document.getElementById('input-consulta-fecha-hora');
  if (inputEl) inputEl.value = state.consultaForm.fecha_hora;
  const inputFecha = document.getElementById('input-consulta-fecha-solo');
  if (inputFecha) inputFecha.value = fechaStr;
  const inputHora = document.getElementById('input-consulta-hora-solo');
  if (inputHora) inputHora.value = horaStr;
  toast(`Fecha y hora fijadas: ${fechaStr} ${horaStr}`);
}

function setFechaBookingRapida(offsetDias) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  const fechaStr = d.toISOString().split('T')[0];
  state.bookingForm.fecha = fechaStr;
  render();
  updateBookingSummary();
}

function vincularCitaAConsulta(citaId) {
  seleccionarCitaParaConsulta(citaId);
  state.consultaForm.tipo_origen = 'cita_previa';
  navigate('consulta');
  toast(`Confirmando asistencia para: ${state.consultaForm.nombre_completo}`);
}

async function cambiarEstadoCita(idCita, nuevoEstado) {
  try {
    await fetch(`${API_BASE_URL}/consultas/${idCita}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado })
    });
    toast(`Cita actualizada a: "${nuevoEstado}"`);
  } catch (err) {
    console.warn('Actualización de estado:', err);
    toast(`Estado actualizado a: ${nuevoEstado}`);
  }

  const cita = state.appointments.find(a => (a.id_cita == idCita || a.Consulta_id == idCita));
  if (cita) {
    cita.estado = nuevoEstado;
  }
  render();
}

function verificarCitasVencidas(citas) {
  if (!Array.isArray(citas)) return;
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();

  citas.forEach(c => {
    const fStr = c.fecha_hora_inicio || c.fecha_hora;
    if (fStr) {
      const fCita = new Date(fStr.replace(' ', 'T')).getTime();
      if (!isNaN(fCita) && fCita < inicioHoy) {
        if (c.estado === 'Confirmada' || c.estado === 'Pendiente') {
          c.estado = 'No asistió';
        }
      }
    }
  });
}


function agregarDiagnosticoConsulta(padecimientoPorDefecto = '') {
  state.consultaForm.diagnosticos.push({
    padecimiento: padecimientoPorDefecto || '',
    pie_izquierdo: true,
    pie_derecho: true,
    tipo_diagnostico: 'Correctivo',
    detalles_adicionales: ''
  });
  render();
}

function eliminarDiagnosticoConsulta(index) {
  if (state.consultaForm.diagnosticos.length <= 1) {
    toast('La consulta debe tener al menos un diagnóstico');
    return;
  }
  state.consultaForm.diagnosticos.splice(index, 1);
  render();
}

function agregarTratamientoConsulta(procedimientoPorDefecto = '') {
  state.consultaForm.tratamientos.push({
    procedimiento_servicio: procedimientoPorDefecto || '',
    pie_izquierdo: true,
    pie_derecho: true,
    tratamiento_aplicado: '',
    frecuencia: 'Control en 30 días'
  });
  render();
}

function eliminarTratamientoConsulta(index) {
  if (state.consultaForm.tratamientos.length <= 1) {
    toast('La consulta debe registrar al menos un tratamiento o procedimiento');
    return;
  }
  state.consultaForm.tratamientos.splice(index, 1);
  render();
}

async function guardarConsultaEnBackend(event) {
  if (event) event.preventDefault();
  const form = state.consultaForm;

  if (!form.nombre_completo || !form.nombre_completo.trim()) {
    toast('Ingresa el nombre del paciente para la consulta');
    return;
  }

  toast('Guardando consulta y actualizando expediente clínico...');

  try {
    let expedienteFinal = form.expediente;

    // Si es un paciente nuevo o no tiene expediente, registrarlo en MySQL
    if (!expedienteFinal) {
      const payloadPaciente = {
        nombre_completo: form.nombre_completo,
        telefono: form.telefono,
        Fecha_nacimiento: form.fecha_nacimiento || null,
        edad: parseInt(form.edad) || calcularEdad(form.fecha_nacimiento) || null,
        sexo: form.sexo === 'Masculino' ? 'M' : form.sexo === 'Femenino' ? 'F' : null,
        Calle_direccion: form.calle_direccion || null,
        Municipio: form.municipio || null,
        Ocupacion: form.ocupacion || null,
        Calzado: form.calzado || null,
        Antecedentes_patologicos: form.antecedentes_patologicos || null,
        es_diabetico: form.es_diabetico,
        es_hipertenso: form.es_hipertenso,
        Notas: form.notas_alergias,
        notas_alergias: form.notas_alergias,
        clinica_id: parseInt(form.id_clinica) || state.currentClinicId || 14
      };

      try {
        const resPac = await fetch(`${API_BASE_URL}/pacientes/expres`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadPaciente)
        });
        if (resPac.ok) {
          const pacData = await resPac.json();
          expedienteFinal = pacData.paciente?.No_expediente || pacData.paciente?.expediente;
          if (pacData.paciente) {
            state.patients.unshift(pacData.paciente);
          }
        }
      } catch (errPac) {
        console.warn('Registro de paciente omitida:', errPac);
      }
    }

    if (!expedienteFinal) {
      expedienteFinal = `2026${String(form.id_clinica || 14).padStart(2, '0')}${String(Math.floor(1000 + Math.random() * 9000))}`;
    }

    // Normalizar fecha y hora para MySQL
    let fechaHoraFormat = form.fecha_hora ? form.fecha_hora.replace('T', ' ') : '';
    if (fechaHoraFormat.length === 16) {
      fechaHoraFormat += ':00';
    }

    const payloadConsulta = {
      fk_no_expediente: expedienteFinal,
      nombre_completo: form.nombre_completo,
      telefono: form.telefono,
      Fecha_nacimiento: form.fecha_nacimiento || null,
      Calle_direccion: form.calle_direccion || null,
      Municipio: form.municipio || null,
      Ocupacion: form.ocupacion || null,
      Calzado: form.calzado || null,
      Antecedentes_patologicos: form.antecedentes_patologicos || null,
      Notas: form.notas_alergias,
      sexo: form.sexo === 'Masculino' ? 'M' : form.sexo === 'Femenino' ? 'F' : null,
      es_diabetico: form.es_diabetico,
      es_hipertenso: form.es_hipertenso,
      notas_alergias: form.notas_alergias,
      fk_clinica_id: parseInt(form.id_clinica) || state.currentClinicId || 14,
      fecha_hora: fechaHoraFormat || new Date().toISOString(),
      estado: form.estado || 'Completada',
      motivo_o_notas: form.motivo || 'Atención Podológica Directa',
      Peso: parseFloat(form.peso) || null,
      Altura: parseFloat(form.altura) || null,
      tipo_pisada: form.tipo_pisada || 'Neutra',
      alineacion: form.alineacion || 'Neutra',
      observaciones: form.observaciones || null,

      diagnosticos: form.diagnosticos.map(d => ({
        padecimiento: d.padecimiento || 'Sin alteración clínica',
        pie_izquierdo: d.pie_izquierdo ? 1 : 0,
        pie_derecho: d.pie_derecho ? 1 : 0,
        tipo_diagnostico: d.tipo_diagnostico || 'Correctivo',
        detalles_adicionales: d.detalles_adicionales || null
      })),
      tratamientos: form.tratamientos.map(t => ({
        procedimiento_servicio: t.procedimiento_servicio || 'Quiropodia Clínica',
        pie_izquierdo: t.pie_izquierdo ? 1 : 0,
        pie_derecho: t.pie_derecho ? 1 : 0,
        tratamiento_aplicado: t.tratamiento_aplicado || null,
        frecuencia: t.frecuencia || 'Control en 30 días'
      }))
    };

    try {
      await fetch(`${API_BASE_URL}/consultas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadConsulta)
      });
    } catch (errApi) {
      console.warn('Guardado en API remota omitido:', errApi);
    }

    await fetchPacientes();
    await fetchCitas();

    toast(`¡Consulta guardada con éxito para expediente #${expedienteFinal}!`);
    resetearFormularioConsulta();
    state.page = 'pacientes';
    render();
  } catch (error) {
    console.error('Error al guardar consulta:', error);
    toast('Ocurrió un error al guardar la consulta');
  }
}

function toast(msg) {
  const container = document.getElementById('toast-container') || document.body;
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<i class="fa-solid fa-sparkles" style="color:var(--primary); font-size:14px;"></i> <span>${msg}</span>`;
  container.appendChild(t);

  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(-10px)';
    setTimeout(() => t.remove(), 250);
  }, 3000);
}

function navigate(pageName) {
  state.page = pageName;
  render();
  // Sincroniza la URL (#/pagina) para enlaces directos y botón atrás
  if (window.Modules) window.Modules.syncHash(state.page);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function changeClinic(clinicId) {
  state.currentClinicId = parseInt(clinicId);
  toast(`Sede: ${getCurrentClinicName()}`);
  fetchCitas();
}

function getCurrentClinicName() {
  const found = state.clinics.find(c => c.id_clinica === state.currentClinicId);
  return found ? found.nombre : 'DIF Lomas de Tecámac';
}

function getClinicNameById(id) {
  const found = state.clinics.find(c => c.id_clinica === parseInt(id));
  return found ? found.nombre : 'Sede Principal';
}

function setHomeCategoryFilter(cat) {
  state.homeCategoryFilter = cat;
  render();
}

function openFilterDialog() {
  const current = state.homeCategoryFilter;
  let next = 'todos';
  if (current === 'todos') next = 'diabeticos';
  else if (current === 'diabeticos') next = 'hipertensos';
  else if (current === 'hipertensos') next = 'confirmadas';
  else next = 'todos';

  state.homeCategoryFilter = next;
  toast(`Filtro aplicado: ${next.toUpperCase()}`);
  render();
}

function togglePasswordVisibility() {
  state.isPasswordVisible = !state.isPasswordVisible;
  const input = document.getElementById('login-password');
  const icon = document.getElementById('pass-toggle-icon');
  if (input) input.type = state.isPasswordVisible ? 'text' : 'password';
  if (icon) {
    icon.className = state.isPasswordVisible ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  }
}

// El inicio de sesión real vive en js/components/loginView.js (POST /api/podologos/login).
function loginSubmit(e) {
  if (e) e.preventDefault();
  const u = (document.getElementById('login-user')?.value || '').trim().toLowerCase();
  const p = (document.getElementById('login-password')?.value || '').trim();
  if ((u === 'demo@clinica.mx' || u === 'angel hernandez') && (p === 'demo1234' || p === 'podologia2026')) {
    state.user = 'Demo Podólogo';
    state.userRole = 'Podólogo Titular';
    state.page = 'inicio';
    render();
    toast('Acceso demo concedido');
  }
}

function logout() {
  // Limpia la sesión; el evento 'auth:changed' redirige a la pantalla de login.
  if (window.Modules) window.Modules.auth.logout('manual');
  else { state.page = 'login'; render(); }
  toast('Sesión cerrada');
}

// ==========================================
// 3. CONTROLADORES DE MODALES Y CALENDARIO
// ==========================================

function getCalendarMonthDiff() {
  const currentTotal = state.calendar.year * 12 + state.calendar.month;
  const baseTotal = state.calendar.baseYear * 12 + state.calendar.baseMonth;
  return currentTotal - baseTotal;
}

function canMoveCalendarPrev() {
  return getCalendarMonthDiff() > -3;
}

function canMoveCalendarNext() {
  return getCalendarMonthDiff() < 3;
}

function changeCalendarMonth(delta) {
  const currentDiff = getCalendarMonthDiff();
  const nextDiff = currentDiff + delta;

  if (delta < 0 && nextDiff < -3) {
    toast('Límite de navegación: Máximo 3 meses hacia atrás');
    return;
  }
  if (delta > 0 && nextDiff > 3) {
    toast('Límite de navegación: Máximo 3 meses hacia adelante');
    return;
  }

  let newMonth = state.calendar.month + delta;
  let newYear = state.calendar.year;

  if (newMonth < 0) {
    newMonth = 11;
    newYear -= 1;
  } else if (newMonth > 11) {
    newMonth = 0;
    newYear += 1;
  }

  state.calendar.month = newMonth;
  state.calendar.year = newYear;
  render();
}

function resetCalendarToToday() {
  const hoy = new Date();
  state.calendar.month = hoy.getMonth();
  state.calendar.year = hoy.getFullYear();
  render();
  toast(`Mostrando mes actual: ${NOMBRES_MESES[hoy.getMonth()]} ${hoy.getFullYear()}`);
}

function openDayModal(dayNumber, monthIndex, year) {
  const mIndex = (monthIndex !== undefined) ? monthIndex : state.calendar.month;
  const yr = year || state.calendar.year;
  const monthName = NOMBRES_MESES[mIndex] || 'Mes';
  const monthStr = String(mIndex + 1).padStart(2, '0');
  const dayStr = String(dayNumber).padStart(2, '0');
  const datePrefix = `${yr}-${monthStr}-${dayStr}`;

  const citasDelDia = state.appointments.filter(c => {
    const fecha = c.fecha_hora_inicio || c.fecha_hora || '';
    return fecha.startsWith(datePrefix) || fecha.includes(datePrefix);
  });

  state.selectedDayData = {
    day: dayNumber,
    month: monthName,
    monthIndex: mIndex,
    year: yr,
    dateString: datePrefix,
    citas: citasDelDia
  };

  renderDayModalHtml();
}

function closeDayModal() {
  state.selectedDayData = null;
  const modalEl = document.getElementById('day-modal');
  if (modalEl) modalEl.classList.remove('open');
}

function renderDayModalHtml() {
  let modalEl = document.getElementById('day-modal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'day-modal';
    modalEl.className = 'modal-backdrop';
    document.body.appendChild(modalEl);
  }

  const d = state.selectedDayData;
  if (!d) return;

  const hasCitas = d.citas && d.citas.length > 0;

  modalEl.innerHTML = `
    <div class="modal-card">
      <button class="modal-close-btn" onclick="closeDayModal()">
        <i class="fa-solid fa-xmark"></i>
      </button>

      <div style="margin-bottom: 20px;">
        <span style="font-size:11px; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:0.8px;">AGENDA DEL DÍA</span>
        <h3 style="font-family:var(--font-serif); font-size:22px; color:var(--secondary); margin-top:2px;">${d.day} de ${d.month} ${d.year}</h3>
        <p style="font-size:12.5px; color:var(--text-muted);">${hasCitas ? `${d.citas.length} citas programadas en ${getCurrentClinicName()}` : 'Sin citas agendadas para esta fecha'}</p>
      </div>

      <div style="display:flex; flex-direction:column; gap:12px; margin-bottom: 20px; max-height:280px; overflow-y:auto;">
        ${hasCitas ? d.citas.map(c => `
          <div style="background:var(--surface-alt); border-radius:var(--radius-md); padding:14px; border:1px solid var(--border-light); display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="background:var(--primary-light); color:var(--primary); font-weight:800; font-size:12px; padding:6px 10px; border-radius:var(--radius-pill);">
                ${c.hora || '10:00'} ${c.ampm || 'AM'}
              </div>
              <div>
                <strong style="font-size:14px; color:var(--secondary);">${c.paciente_nombre || 'Paciente'}</strong>
                <p style="font-size:11.5px; color:var(--text-muted);">${c.motivo || 'Consulta Podológica'}</p>
              </div>
            </div>
            ${c.es_diabetico ? '<span class="micro-tag tag-diabetic">Pie Diabético</span>' : ''}
          </div>
        `).join('') : `
          <div style="text-align:center; padding:30px 10px;">
            <i class="fa-regular fa-calendar-plus" style="font-size:36px; color:var(--text-subtle); margin-bottom:10px;"></i>
            <p style="font-size:13px; color:var(--text-muted);">Horario libre para programar nuevos pacientes.</p>
          </div>
        `}
      </div>

      <div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
        <button class="hero-btn-pill" style="background:var(--surface-alt); color:var(--text-muted); box-shadow:none;" onclick="closeDayModal()">Cerrar</button>
        <button class="hero-btn-pill" style="background:var(--surface); border:1px solid var(--border);" onclick="closeDayModal(); state.bookingForm.fecha='${d.dateString}'; navigate('agendar');">
          <i class="fa-solid fa-calendar-plus" style="color:var(--primary);"></i> Agendar Cita
        </button>
        <button class="btn-primary-pill" style="width:auto; padding:10px 18px;" onclick="closeDayModal(); state.consultaForm.fecha_hora='${d.dateString}T10:00'; navigate('consulta');">
          <i class="fa-solid fa-notes-medical"></i> Registrar Consulta
        </button>
      </div>
    </div>
  `;

  modalEl.onclick = (e) => {
    if (e.target === modalEl) closeDayModal();
  };

  requestAnimationFrame(() => modalEl.classList.add('open'));
}

async function openPatientModal(telefonoOrIndexOrName) {
  let paciente = null;
  if (typeof telefonoOrIndexOrName === 'number') {
    paciente = state.patients[telefonoOrIndexOrName];
  } else if (telefonoOrIndexOrName) {
    const q = String(telefonoOrIndexOrName).trim().toLowerCase();
    paciente = state.patients.find(p => 
      (p.expediente && p.expediente.toString().toLowerCase() === q) ||
      (p.No_expediente && p.No_expediente.toString().toLowerCase() === q) ||
      (p.telefono && p.telefono.replace(/\D/g, '') === q.replace(/\D/g, '')) ||
      (p.nombre_completo && p.nombre_completo.toLowerCase() === q)
    );
  }

  if (!paciente && state.patients.length > 0) {
    paciente = state.patients[0];
  }

  state.selectedPatientDetail = paciente;
  renderPatientModalHtml();

  // Obtener expediente completo y consultas previas desde la base de datos MySQL
  const exp = paciente ? (paciente.No_expediente || paciente.expediente || paciente.id_paciente) : null;
  if (exp) {
    try {
      const res = await fetch(`${API_BASE_URL}/pacientes/${encodeURIComponent(exp)}`);
      if (res.ok) {
        const fullData = await res.json();
        state.selectedPatientDetail = { ...paciente, ...fullData };
        // Actualizar también en el array de memoria local
        const idx = state.patients.findIndex(p => (p.expediente || p.No_expediente) === exp);
        if (idx !== -1) {
          state.patients[idx] = state.selectedPatientDetail;
        }
        renderPatientModalHtml();
      }
    } catch (err) {
      console.warn('Error al cargar detalle clínico del paciente:', err);
    }
  }
}

function closePatientModal() {
  state.selectedPatientDetail = null;
  const modalEl = document.getElementById('patient-modal');
  if (modalEl) modalEl.classList.remove('open');
}

function renderPatientModalHtml() {
  let modalEl = document.getElementById('patient-modal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'patient-modal';
    modalEl.className = 'modal-backdrop';
    document.body.appendChild(modalEl);
  }

  const p = state.selectedPatientDetail;
  if (!p) return;

  const inicial = (p.nombre_completo || 'P')[0].toUpperCase();
  const fNac = (p.Fecha_nacimiento || p.fecha_nacimiento || '').split('T')[0];
  const edadCalculada = fNac ? (calcularEdad(fNac) || p.edad || '') : (p.edad || '');
  const sexoCalculado = p.sexo || (p.Sexo === 'M' ? 'Masculino' : p.Sexo === 'F' ? 'Femenino' : (p.Sexo || 'No especificado'));
  const expDisplay = p.expediente || p.No_expediente || 'Sin Exp';
  
  // Última consulta registrada en MySQL
  const ultimaConsulta = (Array.isArray(p.consultas) && p.consultas.length > 0) ? p.consultas[0] : null;
  let imcTexto = '—';
  if (ultimaConsulta && ultimaConsulta.Peso && ultimaConsulta.Altura) {
    const alt = parseFloat(ultimaConsulta.Altura) > 3 ? parseFloat(ultimaConsulta.Altura) / 100 : parseFloat(ultimaConsulta.Altura);
    if (alt > 0) {
      imcTexto = (parseFloat(ultimaConsulta.Peso) / (alt * alt)).toFixed(1);
    }
  }

  modalEl.innerHTML = `
    <div class="modal-card" style="max-width:580px; max-height:90vh; overflow-y:auto;">
      <button class="modal-close-btn" onclick="closePatientModal()">
        <i class="fa-solid fa-xmark"></i>
      </button>

      <!-- Encabezado de la Ficha -->
      <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid var(--border);">
        <div class="patient-avatar-box tint-orange" style="width:58px; height:58px; font-size:22px; border-radius:var(--radius-md);">
          ${inicial}
        </div>
        <div>
          <span style="font-size:11px; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:0.8px;">EXPEDIENTE #${expDisplay}</span>
          <h3 style="font-family:var(--font-serif); font-size:22px; color:var(--secondary); line-height:1.2;">${p.nombre_completo}</h3>
          <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
            ${p.es_diabetico ? '<span class="micro-tag tag-diabetic"><i class="fa-solid fa-triangle-exclamation"></i> Pie Diabético</span>' : ''}
            ${p.es_hipertenso ? '<span class="micro-tag tag-hypertension"><i class="fa-solid fa-heart-pulse"></i> Hipertenso</span>' : ''}
            <span class="micro-tag tag-regular">${edadCalculada ? edadCalculada + ' años' : 'Edad no reg.'} · ${sexoCalculado}</span>
          </div>
        </div>
      </div>

      <!-- Datos Demográficos y de Contacto -->
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:16px;">
        <div class="summary-row-item" style="padding:10px; background:var(--surface-alt); border-radius:var(--radius-sm);">
          <i class="fa-solid fa-phone" style="color:var(--primary);"></i>
          <div>
            <small style="display:block; font-size:10.5px; color:var(--text-muted);">Teléfono / WhatsApp</small>
            <strong style="font-size:12.5px;">${p.telefono || 'Sin teléfono'}</strong>
          </div>
        </div>

        <div class="summary-row-item" style="padding:10px; background:var(--surface-alt); border-radius:var(--radius-sm);">
          <i class="fa-regular fa-calendar-days" style="color:var(--primary);"></i>
          <div>
            <small style="display:block; font-size:10.5px; color:var(--text-muted);">Fecha de Nacimiento</small>
            <strong style="font-size:12.5px;">${fNac || 'No registrada'}</strong>
          </div>
        </div>

        <div class="summary-row-item" style="padding:10px; background:var(--surface-alt); border-radius:var(--radius-sm);">
          <i class="fa-solid fa-location-dot" style="color:var(--primary);"></i>
          <div>
            <small style="display:block; font-size:10.5px; color:var(--text-muted);">Domicilio y Municipio</small>
            <strong style="font-size:12px;">${[p.Calle_direccion || p.calle_direccion, p.Municipio || p.municipio].filter(Boolean).join(', ') || 'No especificado'}</strong>
          </div>
        </div>

        <div class="summary-row-item" style="padding:10px; background:var(--surface-alt); border-radius:var(--radius-sm);">
          <i class="fa-solid fa-briefcase" style="color:var(--primary);"></i>
          <div>
            <small style="display:block; font-size:10.5px; color:var(--text-muted);">Ocupación / Calzado</small>
            <strong style="font-size:12px;">${p.Ocupacion || p.ocupacion || 'General'} ${p.Calzado || p.calzado ? '· Talla ' + (p.Calzado || p.calzado) : ''}</strong>
          </div>
        </div>
      </div>

      <!-- Antecedentes Clínicos y Notas -->
      <div style="background:var(--surface-alt); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px 14px; margin-bottom:16px;">
        <div style="margin-bottom:8px;">
          <small style="font-size:11px; font-weight:700; color:var(--secondary); display:block; margin-bottom:2px;">
            <i class="fa-solid fa-file-waveform" style="color:var(--primary);"></i> Antecedentes Patológicos:
          </small>
          <p style="font-size:12px; color:var(--text); margin:0;">${p.Antecedentes_patologicos || p.antecedentes_patologicos || 'Sin antecedentes patológicos registrados.'}</p>
        </div>
        <div>
          <small style="font-size:11px; font-weight:700; color:var(--secondary); display:block; margin-bottom:2px;">
            <i class="fa-solid fa-notes-medical" style="color:var(--primary);"></i> Notas / Alergias:
          </small>
          <p style="font-size:12px; color:var(--text); margin:0;">${p.Notas || p.notas_alergias || 'Sin notas especiales o alergias registradas.'}</p>
        </div>
      </div>

      <!-- Historial de Última Consulta Registrada -->
      <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md); padding:14px; margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h4 style="font-size:12.5px; font-weight:800; color:var(--secondary); margin:0; text-transform:uppercase; letter-spacing:0.5px;">
            <i class="fa-solid fa-clipboard-check" style="color:var(--accent-mint);"></i> Última Consulta Guardada
          </h4>
          <span style="font-size:11px; color:var(--text-muted);">
            ${ultimaConsulta ? (ultimaConsulta.fecha_hora || '').replace('T', ' ').slice(0, 16) : (p.ultima_cita || 'Sin consultas')}
          </span>
        </div>

        ${ultimaConsulta ? `
          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-bottom:10px; background:var(--surface-alt); padding:8px 10px; border-radius:var(--radius-sm); font-size:11.5px;">
            <div><strong>Peso:</strong> ${ultimaConsulta.Peso ? ultimaConsulta.Peso + ' kg' : '—'}</div>
            <div><strong>Altura:</strong> ${ultimaConsulta.Altura ? ultimaConsulta.Altura + ' m' : '—'}</div>
            <div><strong>IMC:</strong> ${imcTexto}</div>
            <div><strong>Pisada:</strong> ${ultimaConsulta.tipo_pisada || 'Neutra'}</div>
            <div><strong>Alineación:</strong> ${ultimaConsulta.alineacion || 'Neutra'}</div>
            <div><strong>Estado:</strong> ${ultimaConsulta.estado || 'Completada'}</div>
          </div>
          <div style="font-size:12px; margin-bottom:4px;">
            <strong>Motivo / Diagnóstico:</strong> ${ultimaConsulta.motivo_o_notas || 'Consulta general'}
          </div>
          ${ultimaConsulta.observaciones ? `
            <div style="font-size:12px; color:var(--text-muted);">
              <strong>Observaciones:</strong> ${ultimaConsulta.observaciones}
            </div>
          ` : ''}
          <div style="margin-top:6px; font-size:11px; color:var(--text-subtle);">
            Atendido por: ${ultimaConsulta.podologo_nombre || state.user} ${ultimaConsulta.clinica_nombre ? '· Sede: ' + ultimaConsulta.clinica_nombre : ''}
          </div>
        ` : `
          <p style="font-size:12px; color:var(--text-muted); margin:0;">No se registran consultas clínicas previas guardadas para este paciente.</p>
        `}
      </div>

      <!-- Botones de Acción -->
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <a href="tel:${(p.telefono||'').replace(/\D/g,'')}" class="hero-btn-pill" style="flex:1; justify-content:center; background:var(--surface-alt); box-shadow:none;">
          <i class="fa-solid fa-phone" style="color:var(--accent-mint);"></i> Llamar
        </a>
        <button class="hero-btn-pill" style="flex:1; justify-content:center; background:var(--secondary); color:#fff; box-shadow:none;" onclick="closePatientModal(); Modules.openExpediente('${expDisplay}');">
          <i class="fa-solid fa-file-medical"></i> Expediente
        </button>
        <button class="hero-btn-pill" style="flex:1.2; justify-content:center; background:var(--surface); border:1px solid var(--border);" onclick="closePatientModal(); state.bookingForm.expediente='${expDisplay}'; buscarExpediente('${expDisplay}'); navigate('agendar');">
          <i class="fa-solid fa-calendar-plus" style="color:var(--primary);"></i> Agendar Cita
        </button>
        <button class="btn-primary-pill" style="flex:1.5; justify-content:center;" onclick="closePatientModal(); iniciarConsultaDirectaConPaciente(state.selectedPatientDetail || state.patients.find(x => (x.expediente||x.No_expediente)==='${expDisplay}') || ${JSON.stringify(p).replace(/"/g, '&quot;')});">
          <i class="fa-solid fa-notes-medical"></i> Atender Consulta
        </button>
      </div>
    </div>
  `;

  modalEl.onclick = (e) => {
    if (e.target === modalEl) closePatientModal();
  };

  requestAnimationFrame(() => modalEl.classList.add('open'));
}

// ==========================================
// 4. PLANTILLAS HTML DE VISTAS (COMPILADO BOUTIQUE)
// ==========================================

function renderSidebar() {
  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-logo">
          <i class="fa-solid fa-stethoscope"></i>
        </div>
        <div>
          <h2>Elite Foot Care</h2>
          <small>Podología Clínica</small>
        </div>
      </div>

      <nav class="nav">
        <button class="${state.page === 'inicio' ? 'active' : ''}" onclick="navigate('inicio')">
          <i class="fa-solid fa-house"></i>
          <span>Inicio</span>
        </button>
        <button class="${state.page === 'agenda' ? 'active' : ''}" onclick="navigate('agenda')">
          <i class="fa-solid fa-calendar-days"></i>
          <span>Agenda</span>
        </button>
        <button class="${state.page === 'pacientes' ? 'active' : ''}" onclick="navigate('pacientes')">
          <i class="fa-solid fa-users"></i>
          <span>Pacientes</span>
        </button>
        <button class="${state.page === 'consulta' ? 'active' : ''}" onclick="navigate('consulta')">
          <i class="fa-solid fa-notes-medical"></i>
          <span>Nueva Consulta</span>
        </button>
        <button class="${state.page === 'agendar' ? 'active' : ''}" onclick="navigate('agendar')">
          <i class="fa-solid fa-calendar-plus"></i>
          <span>Agendar Cita</span>
        </button>
        <button class="${state.page === 'recetas' ? 'active' : ''}" onclick="navigate('recetas')">
          <i class="fa-solid fa-prescription"></i>
          <span>Recetas Médicas</span>
        </button>
        <button class="${state.page === 'mapa' ? 'active' : ''}" onclick="navigate('mapa')">
          <i class="fa-solid fa-shoe-prints"></i>
          <span>Mapa Podológico</span>
        </button>
        <button class="${state.page === 'pagos' ? 'active' : ''}" onclick="navigate('pagos')">
          <i class="fa-solid fa-cash-register"></i>
          <span>Caja y Pagos</span>
        </button>
        <button class="${state.page === 'inventario' ? 'active' : ''}" onclick="navigate('inventario')">
          <i class="fa-solid fa-boxes-stacked"></i>
          <span>Inventario</span>
        </button>
        <button class="${state.page === 'auditoria' ? 'active' : ''}" onclick="navigate('auditoria')">
          <i class="fa-solid fa-shield-halved"></i>
          <span>Bitácora de Auditoría</span>
        </button>
        <button class="${state.page === 'reportes' ? 'active' : ''}" onclick="navigate('reportes')">
          <i class="fa-solid fa-chart-pie"></i>
          <span>Reportes</span>
        </button>
        <a href="/admin.html" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: var(--radius-md, 8px); color: #38bdf8; text-decoration: none; font-size: 0.88rem; font-weight: 600; background: rgba(56, 189, 248, 0.08); margin: 0.5rem 0.5rem 0; border: 1px solid rgba(56, 189, 248, 0.2); transition: all 0.2s ease;">
          <i class="fa-solid fa-shield-halved"></i>
          <span>Panel de Admin</span>
        </a>
      </nav>

      <div class="sidebar-bottom">
        <div class="clinic-selector-widget">
          <div class="lbl">Sede Activa</div>
          <select onchange="changeClinic(this.value)">
            ${state.clinics.map(c => `
              <option value="${c.id_clinica}" ${c.id_clinica === state.currentClinicId ? 'selected' : ''}>
                ${c.nombre}
              </option>
            `).join('')}
          </select>
        </div>

        <button class="logout" onclick="logout()">
          <i class="fa-solid fa-arrow-right-from-bracket"></i>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  `;
}

function renderTopbar() {
  const fechaHoy = getFechaActualFormateada();

  return `
    <div class="topbar-wrapper">
      <div class="topbar-header">
        <div class="topbar-greeting">
          <h1 class="greeting-title">Hola, Dr. ${state.user.split(' ')[0]} 👋</h1>
          <div class="greeting-subtitle" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="display:inline-flex; align-items:center; gap:6px;">
              <span class="status-badge-dot"></span>
              <span>${getCurrentClinicName()}</span>
            </span>
            <span class="greeting-date-pill">
              <i class="fa-regular fa-calendar-days"></i>
              <span>${fechaHoy}</span>
            </span>
          </div>
        </div>

        <div class="topbar-actions">
          <button class="hero-btn-pill" style="padding:8px 14px; font-size:12px; background:var(--primary); color:#ffffff; display:inline-flex;" onclick="navigate('consulta')">
            <i class="fa-solid fa-notes-medical"></i> <span>Registrar Consulta</span>
          </button>

          <button class="icon-btn-pill" onclick="window.Modules ? Modules.toggleNotifications() : toast('Notificaciones al día. Sin alertas pendientes.')" aria-label="Notificaciones" id="topbar-bell">
            <i class="fa-regular fa-bell"></i>
            <span class="notif-dot" data-notif-dot style="display:none"></span>
          </button>

          <div class="user-avatar-pill" onclick="toast('${state.user} | ${state.userRole}')" title="Perfil">
            ${state.user[0]}
          </div>
        </div>
      </div>

      <!-- Barra de búsqueda integrada con botón de filtro circular cálido (Estilo imagen) -->
      <div class="search-filter-bar">
        <div class="search-input-wrapper">
          <i class="fa-solid fa-magnifying-glass search-icon"></i>
          <input 
            type="text" 
            placeholder="Buscar pacientes, citas, expedientes..." 
            value="${state.searchTerm}"
            oninput="state.searchTerm=this.value; renderHomePageContentDynamic();"
          >
          ${state.searchTerm ? `
            <button class="search-clear-btn" onclick="state.searchTerm=''; render();">
              <i class="fa-solid fa-xmark"></i>
            </button>
          ` : ''}
        </div>

        <button class="filter-btn-circle" onclick="openFilterDialog()" title="Filtrar citas y pacientes">
          <i class="fa-solid fa-sliders"></i>
        </button>
      </div>
    </div>
  `;
}

function renderBottomNav() {
  return `
    <nav class="bottom-nav">
      <button class="bottom-nav-item ${state.page === 'inicio' ? 'active' : ''}" onclick="navigate('inicio')">
        <i class="fa-solid fa-house"></i>
        <span>Inicio</span>
      </button>

      <button class="bottom-nav-item ${state.page === 'agenda' ? 'active' : ''}" onclick="navigate('agenda')">
        <i class="fa-regular fa-calendar-days"></i>
        <span>Agenda</span>
      </button>

      <button class="bottom-nav-center-btn" onclick="navigate('consulta')" title="Registrar Consulta Directa">
        <i class="fa-solid fa-notes-medical"></i>
      </button>

      <button class="bottom-nav-item ${state.page === 'pacientes' ? 'active' : ''}" onclick="navigate('pacientes')">
        <i class="fa-regular fa-user"></i>
        <span>Pacientes</span>
      </button>

      <button class="bottom-nav-item ${state.page === 'reportes' ? 'active' : ''}" onclick="navigate('reportes')">
        <i class="fa-solid fa-chart-pie"></i>
        <span>Reportes</span>
      </button>
    </nav>
  `;
}

// ------------------------------------------
// 4.1. PANTALLA: INICIO BOUTIQUE (LOOK DE LA IMAGEN)
// ------------------------------------------
function renderHomePage() {
  const hoyStr = new Date().toISOString().split('T')[0];
  const citasHoyList = state.appointments.filter(a => {
    const f = a.fecha_hora_inicio || a.fecha_hora || '';
    return f.startsWith(hoyStr);
  });
  const citasHoyCount = citasHoyList.length;
  const citasTotalCount = state.appointments.length;
  const citasCount = citasHoyCount;
  const pacientesCount = state.patients.length;
  const diabeticosCount = state.patients.filter(p => p.es_diabetico).length || state.appointments.filter(a => a.es_diabetico).length;
  const fechaCompletaHoy = getFechaActualFormateada();
  const fechaCorta = getFechaCortaHoy();

  return `
    <div>
      ${renderTopbar()}

      <!-- HERO BANNER MODERNO EDITORIAL CON FECHA DE HOY -->
      <div class="hero-banner-card">
        <div class="hero-backdrop-glow"></div>
        
        <div class="hero-content">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
            <div class="hero-tag-badge">
              <i class="fa-solid fa-stethoscope"></i>
              <span>Consultorio Activo</span>
            </div>
            <div class="hero-date-badge" style="margin-bottom:0;">
              <i class="fa-regular fa-calendar-check"></i>
              <span>Hoy: <b>${fechaCompletaHoy}</b></span>
            </div>
          </div>

          <h2 class="hero-title">Atención Podológica Integral</h2>
          <p class="hero-subtitle">Gestión clínica especializada, atención directa en consultorio, control de pie diabético y procedimientos ungueales.</p>
          
          <div class="hero-actions" style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="hero-btn-pill" style="background:var(--primary); color:#ffffff;" onclick="navigate('consulta')">
              <i class="fa-solid fa-notes-medical"></i> Registrar Consulta Directa
            </button>
            <button class="hero-btn-pill" onclick="navigate('agendar')">
              <i class="fa-solid fa-calendar-plus" style="color:var(--primary);"></i> Agendar Cita
            </button>
          </div>
        </div>

        <div class="hero-metric-badge" onclick="navigate('agenda')">
          <div class="metric-icon">
            <i class="fa-solid fa-calendar-check"></i>
          </div>
          <div class="metric-text">
            <small>Turno de Hoy (${fechaCorta})</small>
            <strong>${citasHoyCount} Citas Programadas Hoy</strong>
            <div style="font-size:10.5px; opacity:0.85; margin-top:2px;">${citasTotalCount} citas totales en sistema</div>
          </div>
        </div>
      </div>

      <!-- GESTIÓN RÁPIDA / CATEGORÍAS ("SHOP BY CATEGORY") -->
      <div class="section-container">
        <div class="section-header-row">
          <h3 class="section-heading">Gestión Rápida</h3>
          <span class="section-see-all" onclick="navigate('pacientes')">Ver todo <i class="fa-solid fa-chevron-right" style="font-size:10px;"></i></span>
        </div>

        <div class="categories-scroll-row">
          <div class="category-pill-card" onclick="navigate('consulta')">
            <div class="category-icon-box cat-warm"><i class="fa-solid fa-notes-medical"></i></div>
            <span>Consulta</span>
          </div>

          <div class="category-pill-card ${state.homeCategoryFilter === 'todos' ? 'active' : ''}" onclick="setHomeCategoryFilter('todos')">
            <div class="category-icon-box cat-mint"><i class="fa-solid fa-calendar-check"></i></div>
            <span>Todas Citas</span>
          </div>

          <div class="category-pill-card ${state.homeCategoryFilter === 'diabeticos' ? 'active' : ''}" onclick="setHomeCategoryFilter('diabeticos')">
            <div class="category-icon-box cat-rose"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <span>Diabéticos</span>
          </div>

          <div class="category-pill-card" onclick="navigate('agendar')">
            <div class="category-icon-box cat-amber"><i class="fa-solid fa-user-plus"></i></div>
            <span>Agendar Cita</span>
          </div>

          <div class="category-pill-card" onclick="navigate('agenda')">
            <div class="category-icon-box cat-lavender"><i class="fa-solid fa-calendar-days"></i></div>
            <span>Calendario</span>
          </div>

          <div class="category-pill-card" onclick="navigate('pacientes')">
            <div class="category-icon-box cat-blue"><i class="fa-solid fa-folder-open"></i></div>
            <span>Expedientes</span>
          </div>
        </div>
      </div>

      <!-- SECCIÓN: CITAS DE HOY ("FEATURED PRODUCTS") -->
      <div class="section-container">
        <div class="section-header-row">
          <h3 class="section-heading">Citas del Turno (${getCurrentClinicName()})</h3>
          <span class="section-see-all" onclick="navigate('agenda')">Ver calendario <i class="fa-solid fa-chevron-right" style="font-size:10px;"></i></span>
        </div>

        <div id="home-appointments-container">
          ${renderHomeAppointmentsGrid()}
        </div>
      </div>

      <!-- MÉTRICAS CLÍNICAS (WIDGETS) -->
      <div class="stats-grid-row">
        <div class="stat-metric-card">
          <div class="stat-metric-icon cat-warm"><i class="fa-solid fa-calendar-check"></i></div>
          <div class="stat-metric-info">
            <span>Citas del Turno</span>
            <strong>${citasCount}</strong>
          </div>
        </div>

        <div class="stat-metric-card">
          <div class="stat-metric-icon cat-lavender"><i class="fa-solid fa-users"></i></div>
          <div class="stat-metric-info">
            <span>Pacientes</span>
            <strong>${pacientesCount}</strong>
          </div>
        </div>

        <div class="stat-metric-card">
          <div class="stat-metric-icon cat-rose"><i class="fa-solid fa-heart-pulse"></i></div>
          <div class="stat-metric-info">
            <span>Pie Diabético</span>
            <strong>${diabeticosCount}</strong>
          </div>
        </div>

        <div class="stat-metric-card">
          <div class="stat-metric-icon cat-mint"><i class="fa-solid fa-hospital"></i></div>
          <div class="stat-metric-info">
            <span>Sedes Activas</span>
            <strong>${state.clinics.length}</strong>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderHomeAppointmentsGrid() {
  let list = state.appointments;
  const term = state.searchTerm.toLowerCase().trim();

  if (term) {
    list = list.filter(a => 
      (a.paciente_nombre || '').toLowerCase().includes(term) ||
      (a.motivo || '').toLowerCase().includes(term) ||
      (a.paciente_telefono || '').includes(term) ||
      (a.expediente && a.expediente.toString().toLowerCase().includes(term)) ||
      (a.No_expediente && a.No_expediente.toString().toLowerCase().includes(term)) ||
      (a.fk_no_expediente && a.fk_no_expediente.toString().toLowerCase().includes(term)) ||
      (a.id_cita && a.id_cita.toString().includes(term)) ||
      (a.Consulta_id && a.Consulta_id.toString().includes(term))
    );
  }

  if (state.homeCategoryFilter === 'diabeticos') {
    list = list.filter(a => a.es_diabetico);
  } else if (state.homeCategoryFilter === 'hipertensos') {
    list = list.filter(a => a.es_hipertenso);
  } else if (state.homeCategoryFilter === 'confirmadas') {
    list = list.filter(a => a.estado === 'Confirmada');
  }

  if (list.length === 0) {
    return `
      <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:32px 20px; text-align:center;">
        <i class="fa-solid fa-calendar-check" style="font-size:32px; color:var(--text-subtle); margin-bottom:8px;"></i>
        <p style="font-size:13.5px; font-weight:600; color:var(--secondary);">No se encontraron citas con el filtro aplicado.</p>
        <button class="hero-btn-pill" style="margin-top:12px; background:var(--surface-alt); box-shadow:none;" onclick="state.homeCategoryFilter='todos'; state.searchTerm=''; render();">
          Limpiar Filtros
        </button>
      </div>
    `;
  }

  return `
    <div class="cards-grid-layout">
      ${list.map((a, idx) => {
        const pName = a.paciente_nombre || 'Paciente';
        const hora = a.hora || '10:00';
        const ampm = a.ampm || 'AM';
        const isDiabetic = a.es_diabetico;
        const isHypertensive = a.es_hipertenso;
        const tintClass = idx % 2 === 0 ? 'tint-orange' : 'tint-mint';

        return `
          <div class="boutique-appointment-card">
            <div class="card-top-meta">
              <span class="time-pill-badge">
                <i class="fa-regular fa-clock"></i>
                <span>${hora} ${ampm}</span>
              </span>

              <span class="status-badge ${a.estado === 'Confirmada' ? 'confirmed' : a.estado === 'Completada' ? 'confirmed' : a.estado === 'No asistió' ? 'pending' : a.estado === 'Cancelada' ? 'pending' : 'pending'}" style="${a.estado === 'No asistió' ? 'background:#fee2e2; color:#b91c1c;' : a.estado === 'Cancelada' ? 'background:#f3f4f6; color:#6b7280; text-decoration:line-through;' : ''}">
                ${a.estado || 'Confirmada'}
              </span>
            </div>

            <div class="patient-profile-snippet">
              <div class="patient-avatar-box ${tintClass}">
                ${pName[0].toUpperCase()}
              </div>

              <div class="patient-details">
                <h4 class="patient-name">${pName}</h4>
                <div class="patient-motive">
                  <i class="fa-solid fa-notes-medical" style="font-size:10px; color:var(--primary);"></i>
                  <span>${a.motivo || 'Consulta Podológica'}</span>
                </div>

                <div class="patient-tags-row">
                  ${isDiabetic ? '<span class="micro-tag tag-diabetic">⚠️ Pie Diabético</span>' : ''}
                  ${isHypertensive ? '<span class="micro-tag tag-hypertension">❤️ Hipertenso</span>' : ''}
                </div>
              </div>
            </div>

            <div class="card-footer-actions" style="flex-wrap:wrap; gap:8px;">
              <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                ${(a.estado === 'Confirmada' || a.estado === 'Pendiente') ? `
                  <button class="hero-btn-pill" style="padding:6px 12px; font-size:11.5px; background:var(--primary); color:#ffffff; box-shadow:none;" onclick="vincularCitaAConsulta('${a.id_cita || a.Consulta_id}')" title="Atender en consultorio y registrar consulta">
                    <i class="fa-solid fa-notes-medical"></i> Atender
                  </button>
                  <button class="hero-btn-pill" style="padding:6px 9px; font-size:11px; background:var(--surface-alt); box-shadow:none;" onclick="cambiarEstadoCita('${a.id_cita || a.Consulta_id}', 'Cancelada')" title="Marcar cita como Cancelada">
                    <i class="fa-solid fa-ban" style="color:var(--accent-rose);"></i> Cancelar
                  </button>
                  <button class="hero-btn-pill" style="padding:6px 9px; font-size:11px; background:var(--surface-alt); box-shadow:none;" onclick="cambiarEstadoCita('${a.id_cita || a.Consulta_id}', 'No asistió')" title="Marcar inasistencia (No se presentó)">
                    <i class="fa-solid fa-user-xmark" style="color:var(--accent-amber);"></i> Inasistencia
                  </button>
                ` : `
                  <span class="card-action-link" onclick="openPatientModal('${pName}')">
                    <span>Ver expediente</span>
                    <i class="fa-solid fa-arrow-right" style="font-size:10px;"></i>
                  </span>
                `}
              </div>

              <a href="tel:${(a.paciente_telefono||'').replace(/\D/g,'')}" class="card-quick-call-btn" title="Llamar al paciente">
                <i class="fa-solid fa-phone"></i>
              </a>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

}

function renderHomePageContentDynamic() {
  const container = document.getElementById('home-appointments-container');
  if (container) {
    container.innerHTML = renderHomeAppointmentsGrid();
  }
}

// ------------------------------------------
// 4.2. PANTALLA: AGENDAR CITA (BOUTIQUE FORM)
// ------------------------------------------
function renderBookingPage() {
  const form = state.bookingForm;
  const timeSlots = [
    { time: '09:00 AM', shift: 'morning' },
    { time: '10:00 AM', shift: 'morning' },
    { time: '11:00 AM', shift: 'morning' },
    { time: '12:00 PM', shift: 'morning' },
    { time: '01:00 PM', shift: 'afternoon' },
    { time: '02:00 PM', shift: 'afternoon' },
    { time: '03:00 PM', shift: 'afternoon' },
    { time: '04:00 PM', shift: 'afternoon' },
    { time: '05:00 PM', shift: 'afternoon' },
    { time: '06:00 PM', shift: 'afternoon' }
  ];

  return `
    <div>
      <div class="page-card-container">
        <div class="page-header-title">
          <h2>Agendar Cita Podológica</h2>
          <p>Registra un nuevo paciente o agenda sobre un expediente clínico existente</p>
        </div>

        <div class="booking-dual-grid">
          <!-- Formulario Principal -->
          <div>
            <form id="booking-form" onsubmit="guardarCitaEnBackend(event)">
              
              <!-- PASO 1: DATOS DEL PACIENTE -->
              <div class="booking-form-section">
                <div class="section-step-indicator">
                  <div class="step-circle">1</div>
                  <div>
                    <h3>Información del Paciente</h3>
                    <p>Búsqueda por expediente o registro directo</p>
                  </div>
                </div>

                <div class="form-field-group">
                  <label><i class="fa-solid fa-id-card"></i> No. de Expediente o Teléfono (Opcional)</label>
                  <div style="display:flex; gap:8px;">
                    <input 
                      type="text" 
                      id="input-expediente" 
                      placeholder="Ej. 2026140001 o 55 4123 8970" 
                      value="${form.expediente || ''}"
                      oninput="state.bookingForm.expediente=this.value;"
                      onkeydown="if(event.key==='Enter'){event.preventDefault(); buscarExpediente();}"
                    >
                    <button type="button" class="hero-btn-pill" style="padding:10px 18px; font-size:12px; background:var(--primary); color:#fff;" onclick="buscarExpediente()">
                      <i class="fa-solid fa-magnifying-glass"></i> Buscar
                    </button>
                    ${form.paciente_encontrado ? `
                      <button type="button" class="hero-btn-pill" style="padding:10px 14px; font-size:12px; background:var(--surface);" onclick="resetearFormularioPaciente()">
                        <i class="fa-solid fa-rotate-left"></i> Nuevo
                      </button>
                    ` : ''}
                  </div>
                </div>

                <div class="form-field-group">
                  <label><i class="fa-solid fa-user"></i> Nombre Completo *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ej. Rosa María Martínez" 
                    value="${form.nombre_completo || ''}" 
                    ${form.isLocked ? 'readonly disabled' : ''}
                    oninput="state.bookingForm.nombre_completo=this.value; updateBookingSummary();"
                  >
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                  <div class="form-field-group">
                    <label><i class="fa-solid fa-phone"></i> Teléfono (WhatsApp) *</label>
                    <input 
                      type="tel" 
                      required 
                      placeholder="Ej. 55 1234 5678" 
                      value="${form.telefono || ''}" 
                      ${form.isLocked ? 'readonly disabled' : ''}
                      oninput="state.bookingForm.telefono=this.value; updateBookingSummary();"
                    >
                  </div>

                  <div class="form-field-group">
                    <label><i class="fa-solid fa-venus-mars"></i> Sexo</label>
                    <div class="sex-pill-row">
                      <button type="button" class="sex-choice-btn ${form.sexo === 'Femenino' ? 'active' : ''}" onclick="state.bookingForm.sexo='Femenino'; render();">Femenino</button>
                      <button type="button" class="sex-choice-btn ${form.sexo === 'Masculino' ? 'active' : ''}" onclick="state.bookingForm.sexo='Masculino'; render();">Masculino</button>
                      <button type="button" class="sex-choice-btn ${form.sexo === 'Otro' ? 'active' : ''}" onclick="state.bookingForm.sexo='Otro'; render();">Otro</button>
                    </div>
                  </div>
                </div>

                <!-- FECHA DE NACIMIENTO CON EDAD CALCULADA -->
                <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap:12px;">
                  <div class="form-field-group">
                    <label><i class="fa-regular fa-calendar-days"></i> Fecha de Nacimiento (YYYY-MM-DD)</label>
                    <input 
                      type="date" 
                      id="input-fecha-nacimiento-booking"
                      value="${form.fecha_nacimiento || ''}" 
                      placeholder="YYYY-MM-DD"
                      ${form.isLocked ? 'readonly disabled' : ''}
                      oninput="actualizarEdadBookingEnPantalla()"
                    >
                  </div>

                  <div class="form-field-group">
                    <label><i class="fa-solid fa-cake-candles"></i> Edad Calculada</label>
                    <div id="edad-calculada-booking-badge" style="background:var(--surface-alt); border:1px solid var(--border); border-radius:var(--radius-xs); padding:12px 14px; font-size:13px; font-weight:700; color:var(--secondary); height:46px; display:flex; align-items:center;">
                      ${form.fecha_nacimiento && calcularEdad(form.fecha_nacimiento) !== null ? calcularEdad(form.fecha_nacimiento) + ' años' : (form.edad ? form.edad + ' años' : 'Sin fecha')}
                    </div>
                  </div>
                </div>

                <!-- Domicilio y Municipio -->
                <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap:12px;">
                  <div class="form-field-group">
                    <label><i class="fa-solid fa-location-dot"></i> Dirección (Domicilio)</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Calle Morelos #45, Col. Centro" 
                      value="${form.calle_direccion || ''}"
                      oninput="state.bookingForm.calle_direccion=this.value;"
                    >
                  </div>

                  <div class="form-field-group">
                    <label><i class="fa-solid fa-city"></i> Municipio</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Tecámac" 
                      value="${form.municipio || 'Tecámac'}"
                      oninput="state.bookingForm.municipio=this.value;"
                    >
                  </div>
                </div>

                <div style="display:flex; gap:18px; margin: 12px 0;">
                  <label style="display:inline-flex; align-items:center; gap:8px; font-size:12.5px; font-weight:700; cursor:pointer;">
                    <input type="checkbox" ${form.es_diabetico ? 'checked' : ''} onchange="state.bookingForm.es_diabetico=this.checked; updateBookingSummary();" style="width:18px; height:18px; accent-color:var(--primary);">
                    <span>⚠️ Paciente Diabético</span>
                  </label>

                  <label style="display:inline-flex; align-items:center; gap:8px; font-size:12.5px; font-weight:700; cursor:pointer;">
                    <input type="checkbox" ${form.es_hipertenso ? 'checked' : ''} onchange="state.bookingForm.es_hipertenso=this.checked; updateBookingSummary();" style="width:18px; height:18px; accent-color:var(--primary);">
                    <span>❤️ Paciente Hipertenso</span>
                  </label>
                </div>

                <div class="form-field-group">
                  <label><i class="fa-solid fa-notes-medical"></i> Motivo de Consulta / Padecimiento</label>
                  <textarea rows="2" placeholder="Describir motivo, alergias o atención requerida..." oninput="state.bookingForm.notas_alergias=this.value;">${form.notas_alergias || ''}</textarea>
                </div>
              </div>


              <!-- PASO 2: SEDE O CLÍNICA -->
              <div class="booking-form-section">
                <div class="section-step-indicator">
                  <div class="step-circle">2</div>
                  <div>
                    <h3>Sede de Consulta</h3>
                    <p>Selecciona la clínica donde se atenderá el paciente</p>
                  </div>
                </div>

                <div class="clinics-select-grid">
                  ${state.clinics.map(c => `
                    <div class="clinic-pill-option ${form.id_clinica === c.id_clinica ? 'active' : ''}" onclick="state.bookingForm.id_clinica=${c.id_clinica}; render();">
                      <i class="fa-solid fa-hospital" style="color:var(--primary); font-size:16px; margin-bottom:6px;"></i>
                      <h4>${c.nombre}</h4>
                      <small>${c.direccion}</small>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- PASO 3: FECHA Y HORARIO -->
              <div class="booking-form-section">
                <div class="section-step-indicator">
                  <div class="step-circle">3</div>
                  <div>
                    <h3>Fecha y Horario de la Cita</h3>
                    <p>Elige el día y bloque horario disponible o ingresa una hora específica</p>
                  </div>
                </div>

                <!-- Atajos rápidos de fecha -->
                <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
                  <button type="button" class="hero-btn-pill" style="font-size:11.5px; padding:6px 12px; background:var(--surface-alt); box-shadow:none;" onclick="setFechaBookingRapida(0)">
                    <i class="fa-solid fa-calendar-day" style="color:var(--primary);"></i> Hoy
                  </button>
                  <button type="button" class="hero-btn-pill" style="font-size:11.5px; padding:6px 12px; background:var(--surface-alt); box-shadow:none;" onclick="setFechaBookingRapida(1)">
                    <i class="fa-solid fa-arrow-right" style="color:var(--accent-mint);"></i> Mañana
                  </button>
                  <button type="button" class="hero-btn-pill" style="font-size:11.5px; padding:6px 12px; background:var(--surface-alt); box-shadow:none;" onclick="setFechaBookingRapida(2)">
                    +2 días
                  </button>
                  <button type="button" class="hero-btn-pill" style="font-size:11.5px; padding:6px 12px; background:var(--surface-alt); box-shadow:none;" onclick="setFechaBookingRapida(7)">
                    Próxima semana
                  </button>
                </div>

                <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:12px; margin-bottom:14px;">
                  <div class="form-field-group">
                    <label><i class="fa-regular fa-calendar"></i> Fecha Seleccionada</label>
                    <input type="date" value="${form.fecha}" onchange="state.bookingForm.fecha=this.value; updateBookingSummary();">
                  </div>

                  <div class="form-field-group">
                    <label><i class="fa-regular fa-clock"></i> Hora Personalizada</label>
                    <input 
                      type="time" 
                      value="${(form.hora || '10:00 AM').replace(' AM', '').replace(' PM', '')}" 
                      onchange="state.bookingForm.hora=this.value; updateBookingSummary();"
                    >
                  </div>
                </div>

                <label style="font-size:12px; font-weight:700; color:var(--secondary); margin-bottom:6px; display:block;">
                  <i class="fa-solid fa-list-check" style="color:var(--primary);"></i> Horarios de Atención Frecuentes:
                </label>
                <div class="time-slots-container">
                  ${timeSlots.map(s => `
                    <button type="button" class="slot-btn ${form.hora === s.time ? 'selected' : ''}" onclick="state.bookingForm.hora='${s.time}'; render();">
                      ${s.time}
                    </button>
                  `).join('')}
                </div>
              </div>

              <button type="submit" class="btn-primary-pill" style="margin-top:14px;">
                <i class="fa-solid fa-calendar-check"></i>
                <span>Confirmar y Agendar Cita</span>
              </button>
            </form>
          </div>

          <!-- Resumen Lateral -->
          <div>
            <div class="booking-summary-box">
              <h3 class="summary-heading">Comprobante de Cita</h3>

              <div class="summary-row-item">
                <i class="fa-solid fa-user"></i>
                <div>
                  <small>Paciente</small>
                  <strong id="summary-patient-name">${form.nombre_completo || 'Sin especificar'}</strong>
                </div>
              </div>

              <div class="summary-row-item">
                <i class="fa-solid fa-phone"></i>
                <div>
                  <small>Teléfono</small>
                  <strong id="summary-patient-phone">${form.telefono || 'Sin teléfono'}</strong>
                </div>
              </div>

              <div class="summary-row-item">
                <i class="fa-solid fa-hospital"></i>
                <div>
                  <small>Sede</small>
                  <strong>${getClinicNameById(form.id_clinica)}</strong>
                </div>
              </div>

              <div class="summary-row-item">
                <i class="fa-regular fa-clock"></i>
                <div>
                  <small>Horario</small>
                  <strong>${form.fecha} · ${form.hora}</strong>
                </div>
              </div>

              <div class="summary-row-item">
                <i class="fa-solid fa-user-doctor"></i>
                <div>
                  <small>Especialista</small>
                  <strong>${state.user}</strong>
                </div>
              </div>

              <button type="button" class="btn-primary-pill" onclick="document.getElementById('booking-form').requestSubmit();">
                <i class="fa-solid fa-check"></i> Guardar Cita
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function updateBookingSummary() {
  const pName = document.getElementById('summary-patient-name');
  const pPhone = document.getElementById('summary-patient-phone');
  if (pName) pName.textContent = state.bookingForm.nombre_completo || 'Sin especificar';
  if (pPhone) pPhone.textContent = state.bookingForm.telefono || 'Sin teléfono';
}

// ------------------------------------------
// 4.2.1. PANTALLA: CONSULTA CLÍNICA DIRECTA (WALK-IN / EXPEDIENTE)
// ------------------------------------------
function renderConsultaPage() {
  const form = state.consultaForm;
  const imcData = calcularIMC(form.peso, form.altura);

  const motivosComunes = [
    'Atención Podológica Directa (Sin Cita Previa)',
    'Quiropodia Clínica Preventiva',
    'Tratamiento de Onicomicosis',
    'Desbridamiento de Heloma / Callosidad',
    'Espiculotomía por Onicocriptosis (Uña Encarnada)',
    'Control y Curación de Pie Diabético',
    'Dolor Plantar / Talalgia / Fascitis',
    'Tratamiento de Verruga Plantar / Papiloma'
  ];

  const padecimientosRapidos = [
    'Onicomicosis',
    'Hiperqueratosis plantar',
    'Heloma interdigital',
    'Onicocriptosis bilateral',
    'Pie diabético grado 1',
    'Fascitis plantar',
    'Verruga plantar',
    'Dermatomicosis (Pie de atleta)',
    'Espolón calcáneo',
    'Xerosis / Resequedad severa'
  ];

  const procedimientosRapidos = [
    'Quiropodia Clínica Integral',
    'Desbridamiento con bisturí',
    'Espiculotomía terapéutica',
    'Fresado ungueal y remoción micótica',
    'Curación y antisepsia de úlcera',
    'Aplicación de antifúngico tópico',
    'Hidratación profunda con urea 20%',
    'Confección de órtesis de silicona',
    'Vendaje neuromuscular de descarga'
  ];

  return `
    <div>
      <div class="page-card-container">
        <div class="page-header-title">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
            <div>
              <div style="display:inline-flex; align-items:center; gap:6px; background:#fff3e0; color:#e65100; font-size:11px; font-weight:800; padding:4px 10px; border-radius:var(--radius-pill); margin-bottom:8px; letter-spacing:0.5px; text-transform:uppercase;">
                <i class="fa-solid fa-bolt"></i> Atención Clínica Podológica
              </div>
              <h2>Registrar Consulta Podológica</h2>
              <p>Registro de consulta directa (Walk-in), confirmación de citas agendadas y actualización del expediente clínico</p>
            </div>

            <div style="display:flex; gap:8px;">
              <button type="button" class="hero-btn-pill" style="font-size:12px; background:var(--surface-alt); box-shadow:none;" onclick="resetearFormularioConsulta()">
                <i class="fa-solid fa-rotate-left"></i> Limpiar Formulario
              </button>
            </div>
          </div>
        </div>

        <!-- SELECTOR DE ORIGEN: CONSULTA DIRECTA VS CITA PREVIA -->
        <div style="background:var(--surface-alt); border:1px solid var(--border); border-radius:var(--radius-md); padding:16px 18px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
            <label style="font-size:12px; font-weight:800; color:var(--secondary); text-transform:uppercase; letter-spacing:0.6px; display:flex; align-items:center; gap:6px;">
              <i class="fa-solid fa-arrows-split-up-and-left" style="color:var(--primary);"></i> Tipo de Ingreso al Consultorio:
            </label>
            <span style="font-size:11.5px; color:var(--text-muted);">
              ${form.tipo_origen === 'directa' ? '⚡ Paciente sin cita previa' : '📅 Confirmando asistencia de cita previa'}
            </span>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <button type="button" class="choice-pill-btn ${form.tipo_origen === 'directa' ? 'active' : ''}" style="justify-content:center; padding:12px;" onclick="setTipoOrigenConsulta('directa')">
              <i class="fa-solid fa-bolt"></i> <span>Consulta Directa (Sin Cita / Walk-in)</span>
            </button>
            <button type="button" class="choice-pill-btn ${form.tipo_origen === 'cita_previa' ? 'active' : ''}" style="justify-content:center; padding:12px;" onclick="setTipoOrigenConsulta('cita_previa')">
              <i class="fa-solid fa-calendar-check"></i> <span>Cita Agendada (Confirmar Asistencia)</span>
            </button>
          </div>

          ${form.tipo_origen === 'cita_previa' ? `
            <div style="margin-top:14px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-sm); padding:12px 14px;">
              <label style="font-size:12px; font-weight:700; color:var(--primary); display:block; margin-bottom:6px;">
                <i class="fa-solid fa-user-clock"></i> Selecciona la Cita para Autocompletar Paciente y Marcar Asistencia:
              </label>
              <select onchange="seleccionarCitaParaConsulta(this.value)" style="width:100%; font-size:13px;">
                <option value="">-- Elige una cita agendada para atender --</option>
                ${state.appointments.map(a => `
                  <option value="${a.id_cita || a.Consulta_id}" ${form.cita_seleccionada_id == (a.id_cita || a.Consulta_id) ? 'selected' : ''}>
                    ${a.hora || ''} ${a.ampm || ''} · ${a.paciente_nombre} · ${a.motivo || 'Consulta'} [${a.estado || 'Confirmada'}]
                  </option>
                `).join('')}
              </select>
            </div>
          ` : ''}
        </div>

        <div class="booking-dual-grid">
          <!-- Columna Izquierda: Formulario Clínico Completo -->
          <div>
            <form id="consulta-form" onsubmit="guardarConsultaEnBackend(event)">

              <!-- PASO 1: PACIENTE Y EXPEDIENTE (DATOS DDL) -->
              <div class="booking-form-section">
                <div class="section-step-indicator">
                  <div class="step-circle"><i class="fa-solid fa-user-check" style="font-size:12px;"></i></div>
                  <div>
                    <h3>1. Identificación y Ficha del Paciente</h3>
                    <p>Búsqueda automática por expediente / teléfono o registro con datos completos</p>
                  </div>
                </div>

                <div class="form-field-group">
                  <label><i class="fa-solid fa-id-card"></i> No. de Expediente o Teléfono (Autocompletar)</label>
                  <div style="display:flex; gap:8px;">
                    <input 
                      type="text" 
                      id="input-expediente-consulta" 
                      placeholder="Ingresa No. de Expediente (Ej. 2025350012) o Teléfono..." 
                      value="${form.expediente || ''}"
                      oninput="state.consultaForm.expediente=this.value;"
                      onkeydown="if(event.key==='Enter'){event.preventDefault(); buscarExpedienteConsulta();}"
                    >
                    <button type="button" class="hero-btn-pill" style="padding:10px 18px; font-size:12px; background:var(--primary); color:#fff;" onclick="buscarExpedienteConsulta()">
                      <i class="fa-solid fa-magnifying-glass"></i> Vincular
                    </button>
                    ${form.paciente_encontrado ? `
                      <button type="button" class="hero-btn-pill" style="padding:10px 14px; font-size:12px; background:var(--surface);" onclick="resetearFormularioConsulta()">
                        <i class="fa-solid fa-user-plus"></i> Paciente Nuevo
                      </button>
                    ` : ''}
                  </div>
                  ${form.paciente_encontrado ? `
                    <div style="margin-top:6px; font-size:11.5px; color:#2e7d32; font-weight:700; display:flex; align-items:center; gap:6px;">
                      <i class="fa-solid fa-circle-check"></i> Expediente vinculado: ${form.nombre_completo} (Ficha médica cargada)
                    </div>
                  ` : `
                    <small style="font-size:11px; color:var(--text-muted); margin-top:4px; display:block;">
                      Si el paciente es nuevo, llena sus datos y el sistema creará su número de expediente automáticamente en MySQL.
                    </small>
                  `}
                </div>

                <div class="form-field-group">
                  <label><i class="fa-solid fa-user"></i> Nombre Completo del Paciente *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ej. María Luisa Rodríguez Gómez" 
                    value="${form.nombre_completo || ''}" 
                    ${form.isLocked ? 'readonly disabled' : ''}
                    oninput="state.consultaForm.nombre_completo=this.value;"
                  >
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                  <div class="form-field-group">
                    <label><i class="fa-solid fa-phone"></i> Teléfono (WhatsApp) *</label>
                    <input 
                      type="tel" 
                      required 
                      placeholder="Ej. 55 1234 5678" 
                      value="${form.telefono || ''}" 
                      ${form.isLocked ? 'readonly disabled' : ''}
                      oninput="state.consultaForm.telefono=this.value;"
                    >
                  </div>

                  <div class="form-field-group">
                    <label><i class="fa-solid fa-venus-mars"></i> Sexo</label>
                    <div class="sex-pill-row">
                      <button type="button" class="sex-choice-btn ${form.sexo === 'Femenino' ? 'active' : ''}" onclick="setConsultaSexo('Femenino')">Femenino</button>
                      <button type="button" class="sex-choice-btn ${form.sexo === 'Masculino' ? 'active' : ''}" onclick="setConsultaSexo('Masculino')">Masculino</button>
                      <button type="button" class="sex-choice-btn ${form.sexo === 'Otro' ? 'active' : ''}" onclick="setConsultaSexo('Otro')">Otro</button>
                    </div>
                  </div>
                </div>

                <!-- FECHA DE NACIMIENTO CON EDAD CALCULADA -->
                <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap:12px;">
                  <div class="form-field-group">
                    <label><i class="fa-regular fa-calendar-days"></i> Fecha de Nacimiento (YYYY-MM-DD)</label>
                    <input 
                      type="date" 
                      id="input-fecha-nacimiento-consulta"
                      value="${form.fecha_nacimiento || ''}" 
                      placeholder="YYYY-MM-DD"
                      ${form.isLocked ? 'readonly disabled' : ''}
                      oninput="actualizarEdadEnPantalla()"
                    >
                  </div>

                  <div class="form-field-group">
                    <label><i class="fa-solid fa-cake-candles"></i> Edad Calculada</label>
                    <div id="edad-calculada-badge" style="background:var(--surface-alt); border:1px solid var(--border); border-radius:var(--radius-xs); padding:12px 14px; font-size:13px; font-weight:700; color:var(--secondary); height:46px; display:flex; align-items:center;">
                      ${form.fecha_nacimiento && calcularEdad(form.fecha_nacimiento) !== null ? calcularEdad(form.fecha_nacimiento) + ' años' : (form.edad ? form.edad + ' años' : 'Sin fecha')}
                    </div>
                  </div>
                </div>

                <!-- DOMICILIO Y MUNICIPIO (DDL) -->
                <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap:12px;">
                  <div class="form-field-group">
                    <label><i class="fa-solid fa-location-dot"></i> Calle y Dirección (Domicilio)</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Calle Morelos #45, Col. Centro" 
                      value="${form.calle_direccion || ''}"
                      oninput="state.consultaForm.calle_direccion=this.value;"
                    >
                  </div>

                  <div class="form-field-group">
                    <label><i class="fa-solid fa-city"></i> Municipio</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Tecámac" 
                      value="${form.municipio || 'Tecámac'}"
                      oninput="state.consultaForm.municipio=this.value;"
                    >
                  </div>
                </div>

                <!-- OCUPACIÓN Y CALZADO (DDL) -->
                <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap:12px;">
                  <div class="form-field-group">
                    <label><i class="fa-solid fa-briefcase"></i> Ocupación</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Docente, Comerciante, Jubilado(a)..." 
                      value="${form.ocupacion || ''}"
                      oninput="state.consultaForm.ocupacion=this.value;"
                    >
                  </div>

                  <div class="form-field-group">
                    <label><i class="fa-solid fa-shoe-prints"></i> No. Calzado</label>
                    <input 
                      type="text" 
                      placeholder="Ej. 25.5" 
                      value="${form.calzado || ''}"
                      oninput="state.consultaForm.calzado=this.value;"
                    >
                  </div>
                </div>

                <!-- Factores de Riesgo -->
                <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-sm); padding:12px 14px; margin-bottom:12px;">
                  <label style="font-size:12px; font-weight:700; color:var(--secondary); margin-bottom:8px; display:block;">Factores de Riesgo / Patologías Base</label>
                  <div style="display:flex; gap:20px; flex-wrap:wrap;">
                    <label class="foot-check-label" style="color:${form.es_diabetico ? '#c62828' : 'inherit'};">
                      <input type="checkbox" ${form.es_diabetico ? 'checked' : ''} onchange="state.consultaForm.es_diabetico=this.checked;">
                      <span><i class="fa-solid fa-triangle-exclamation" style="color:#d32f2f;"></i> Paciente Diabético</span>
                    </label>

                    <label class="foot-check-label" style="color:${form.es_hipertenso ? '#e65100' : 'inherit'};">
                      <input type="checkbox" ${form.es_hipertenso ? 'checked' : ''} onchange="state.consultaForm.es_hipertenso=this.checked;">
                      <span><i class="fa-solid fa-heart-pulse" style="color:#f57c00;"></i> Hipertenso</span>
                    </label>
                  </div>
                </div>

                <!-- ANTECEDENTES PATOLÓGICOS (DDL) -->
                <div class="form-field-group">
                  <label><i class="fa-solid fa-file-waveform"></i> Antecedentes Patológicos Clínicos</label>
                  <textarea rows="2" placeholder="Tiempo con diabetes, cirugías previas, problemas circulatorios o de columna..." oninput="state.consultaForm.antecedentes_patologicos=this.value;">${form.antecedentes_patologicos || ''}</textarea>
                </div>

                <!-- NOTAS Y ALERGIAS (DDL) -->
                <div class="form-field-group">
                  <label><i class="fa-solid fa-notes-medical"></i> Notas Generales / Alergias del Paciente</label>
                  <textarea rows="2" placeholder="Alergia a medicamentos o yodo, sensibilidad a desinfectantes..." oninput="state.consultaForm.notas_alergias=this.value;">${form.notas_alergias || ''}</textarea>
                </div>
              </div>


              <!-- PASO 2: SEDE, FECHA Y MOTIVO DE CONSULTA -->
              <div class="booking-form-section">
                <div class="section-step-indicator">
                  <div class="step-circle"><i class="fa-solid fa-hospital-user" style="font-size:12px;"></i></div>
                  <div>
                    <h3>2. Sede, Fecha y Motivo de Consulta</h3>
                    <p>Ubicación, fecha/hora exacta de la atención y motivo clínico</p>
                  </div>
                </div>

                <div class="form-field-group" style="margin-bottom:12px;">
                  <label><i class="fa-solid fa-hospital"></i> Sede / Clínica *</label>
                  <select onchange="state.consultaForm.id_clinica=parseInt(this.value);" style="width:100%;">
                    ${state.clinics.map(c => `
                      <option value="${c.id_clinica}" ${form.id_clinica === c.id_clinica ? 'selected' : ''}>
                        ${c.nombre} (${c.direccion})
                      </option>
                    `).join('')}
                  </select>
                </div>

                <!-- Atajos rápidos para fecha y hora de consulta -->
                <div style="margin-bottom:12px;">
                  <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px;">
                    <i class="fa-solid fa-bolt" style="color:var(--primary);"></i> Atajos Rápidos de Horario de Atención:
                  </label>
                  <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button type="button" class="hero-btn-pill" style="font-size:11.5px; padding:6px 12px; background:var(--primary); color:#ffffff;" onclick="setFechaConsultaRapida(0)">
                      <i class="fa-solid fa-clock"></i> Ahora Mismo
                    </button>
                    <button type="button" class="hero-btn-pill" style="font-size:11.5px; padding:6px 12px; background:var(--surface-alt); box-shadow:none;" onclick="setFechaConsultaRapida(0, '10:00')">
                      Hoy 10:00 AM
                    </button>
                    <button type="button" class="hero-btn-pill" style="font-size:11.5px; padding:6px 12px; background:var(--surface-alt); box-shadow:none;" onclick="setFechaConsultaRapida(0, '16:00')">
                      Hoy 04:00 PM
                    </button>
                    <button type="button" class="hero-btn-pill" style="font-size:11.5px; padding:6px 12px; background:var(--surface-alt); box-shadow:none;" onclick="setFechaConsultaRapida(1, '10:00')">
                      Mañana 10:00 AM
                    </button>
                  </div>
                </div>

                <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:12px; margin-bottom:12px;">
                  <div class="form-field-group">
                    <label><i class="fa-regular fa-calendar-days"></i> Día de la Consulta *</label>
                    <input 
                      type="date" 
                      id="input-consulta-fecha-solo"
                      required 
                      value="${(form.fecha_hora || '').split('T')[0] || new Date().toISOString().split('T')[0]}" 
                      onchange="const f=this.value; const h=(state.consultaForm.fecha_hora||'').split('T')[1]||'10:00'; state.consultaForm.fecha_hora=f+'T'+h; const el=document.getElementById('input-consulta-fecha-hora'); if(el) el.value=state.consultaForm.fecha_hora;"
                    >
                  </div>

                  <div class="form-field-group">
                    <label><i class="fa-regular fa-clock"></i> Hora de Atención *</label>
                    <input 
                      type="time" 
                      id="input-consulta-hora-solo"
                      required 
                      value="${(form.fecha_hora || '').split('T')[1] ? (form.fecha_hora.split('T')[1]).slice(0, 5) : '10:00'}" 
                      onchange="const h=this.value; const f=(state.consultaForm.fecha_hora||'').split('T')[0]||new Date().toISOString().split('T')[0]; state.consultaForm.fecha_hora=f+'T'+h; const el=document.getElementById('input-consulta-fecha-hora'); if(el) el.value=state.consultaForm.fecha_hora;"
                    >
                  </div>
                </div>

                <!-- Input oculto o sincronizado para validación estándar -->
                <input 
                  type="hidden" 
                  id="input-consulta-fecha-hora" 
                  value="${form.fecha_hora || new Date().toISOString().slice(0, 16)}"
                >

                <div class="form-field-group">
                  <label><i class="fa-solid fa-clipboard-question"></i> Motivo de la Consulta / Anamnesis *</label>
                  <input 
                    type="text" 
                    id="input-consulta-motivo"
                    required 
                    placeholder="Ej. Revisión por dolor en uña y durezas plantares" 
                    value="${form.motivo || ''}"
                    oninput="state.consultaForm.motivo=this.value;"
                  >
                  
                  <div class="quick-tags-container">
                    ${motivosComunes.map(m => `
                      <span class="quick-tag-pill" onclick="setConsultaMotivo('${m}')">
                        ${m}
                      </span>
                    `).join('')}
                  </div>
                </div>

                <div class="form-field-group">
                  <label><i class="fa-solid fa-circle-info"></i> Estado de la Consulta</label>
                  <div class="choice-pills-row">
                    <button type="button" class="choice-pill-btn ${form.estado === 'Completada' ? 'active' : ''}" data-estado="Completada" onclick="setConsultaEstado('Completada')">
                      <i class="fa-solid fa-check-double"></i> Atendida / Completada
                    </button>
                    <button type="button" class="choice-pill-btn ${form.estado === 'En proceso' ? 'active' : ''}" data-estado="En proceso" onclick="setConsultaEstado('En proceso')">
                      <i class="fa-solid fa-hourglass-half"></i> En Proceso
                    </button>
                    <button type="button" class="choice-pill-btn ${form.estado === 'Confirmada' ? 'active' : ''}" data-estado="Confirmada" onclick="setConsultaEstado('Confirmada')">
                      <i class="fa-regular fa-clock"></i> Por Atender
                    </button>
                  </div>
                </div>
              </div>

              <!-- PASO 3: SOMATOMETRÍA Y EXPLORACIÓN BIOMECÁNICA -->
              <div class="booking-form-section">
                <div class="section-step-indicator">
                  <div class="step-circle"><i class="fa-solid fa-weight-scale" style="font-size:12px;"></i></div>
                  <div>
                    <h3>3. Somatometría y Exploración Biomecánica</h3>
                    <p>Signos, peso, talla, tipo de pisada y observaciones de la marcha</p>
                  </div>
                </div>

                <div class="biometrics-grid">
                  <div class="form-field-group" style="margin-bottom:0;">
                    <label><i class="fa-solid fa-weight-scale"></i> Peso (kg)</label>
                    <input 
                      type="number" 
                      id="input-peso"
                      step="0.1" 
                      min="0"
                      placeholder="Ej. 72.5" 
                      value="${form.peso || ''}" 
                      oninput="actualizarIMCEnPantalla()"
                    >
                  </div>

                  <div class="form-field-group" style="margin-bottom:0;">
                    <label><i class="fa-solid fa-ruler-vertical"></i> Altura (m)</label>
                    <input 
                      type="number" 
                      id="input-altura"
                      step="0.01" 
                      min="0"
                      placeholder="Ej. 1.65" 
                      value="${form.altura || ''}" 
                      oninput="actualizarIMCEnPantalla()"
                    >
                  </div>

                  <div class="imc-badge-box">
                    <small>IMC Calculado</small>
                    <div class="imc-value-row" id="imc-badge-container">
                      <span class="imc-num">${imcData ? imcData.valor : '--'}</span>
                      ${imcData ? `<span class="imc-tag ${imcData.badgeClass}">${imcData.clasificacion}</span>` : '<span style="font-size:11px; color:var(--text-muted);">Sin datos</span>'}
                    </div>
                  </div>
                </div>


                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:14px;">
                  <div class="form-field-group">
                    <label><i class="fa-solid fa-shoe-prints"></i> Tipo de Pisada</label>
                    <select onchange="state.consultaForm.tipo_pisada=this.value;">
                      <option value="Neutra" ${form.tipo_pisada === 'Neutra' ? 'selected' : ''}>Neutra</option>
                      <option value="Pronadora" ${form.tipo_pisada === 'Pronadora' ? 'selected' : ''}>Pronadora (Hacia adentro)</option>
                      <option value="Supinadora" ${form.tipo_pisada === 'Supinadora' ? 'selected' : ''}>Supinadora (Hacia afuera)</option>
                    </select>
                  </div>

                  <div class="form-field-group">
                    <label><i class="fa-solid fa-arrows-split-up-and-left"></i> Alineación de Tobillo</label>
                    <select onchange="state.consultaForm.alineacion=this.value;">
                      <option value="Neutra" ${form.alineacion === 'Neutra' ? 'selected' : ''}>Neutra</option>
                      <option value="Valgo" ${form.alineacion === 'Valgo' ? 'selected' : ''}>Valgo</option>
                      <option value="Varo" ${form.alineacion === 'Varo' ? 'selected' : ''}>Varo</option>
                    </select>
                  </div>
                </div>

                <div class="form-field-group">
                  <label><i class="fa-solid fa-magnifying-glass-chart"></i> Observaciones de la Exploración Clínica</label>
                  <textarea rows="2" placeholder="Hiperqueratosis en cabezas metatarsales, temperatura podálica, pulsos pedios conservados..." oninput="state.consultaForm.observaciones=this.value;">${form.observaciones || ''}</textarea>
                </div>
              </div>

              <!-- PASO 4: DIAGNÓSTICOS PODOLÓGICOS (DINÁMICO) -->
              <div class="booking-form-section">
                <div class="section-step-indicator">
                  <div class="step-circle"><i class="fa-solid fa-virus" style="font-size:12px;"></i></div>
                  <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <h3>4. Diagnósticos Podológicos</h3>
                      <span style="font-size:11.5px; font-weight:700; color:var(--primary);">${form.diagnosticos.length} Registrado(s)</span>
                    </div>
                    <p>Patologías encontradas en la valoración del paciente</p>
                  </div>
                </div>

                <!-- Tags rápidos para agregar diagnósticos -->
                <div style="margin-bottom:12px;">
                  <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Añadir Diagnóstico Frecuente:</label>
                  <div class="quick-tags-container" style="margin-top:4px;">
                    ${padecimientosRapidos.map(p => `
                      <span class="quick-tag-pill" onclick="agregarDiagnosticoConsulta('${p}')">
                        <i class="fa-solid fa-plus" style="font-size:9px;"></i> ${p}
                      </span>
                    `).join('')}
                  </div>
                </div>

                <!-- Lista de diagnósticos -->
                <div id="diagnosticos-container">
                  ${form.diagnosticos.map((d, index) => `
                    <div class="dynamic-item-card">
                      <div class="dynamic-item-header">
                        <div class="dynamic-item-title">
                          <span style="width:22px; height:22px; border-radius:50%; background:var(--surface-alt); display:grid; place-items:center; font-size:11px;">${index + 1}</span>
                          <span>Diagnóstico Clínico</span>
                        </div>
                        <button type="button" class="btn-remove-item" title="Eliminar diagnóstico" onclick="eliminarDiagnosticoConsulta(${index})">
                          <i class="fa-solid fa-trash-can"></i>
                        </button>
                      </div>

                      <div class="form-field-group">
                        <label>Padecimiento / Patología *</label>
                        <input 
                          type="text" 
                          required 
                          placeholder="Ej. Onicomicosis distal subungueal" 
                          value="${d.padecimiento || ''}"
                          oninput="state.consultaForm.diagnosticos[${index}].padecimiento=this.value;"
                        >
                      </div>

                      <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:12px;">
                        <div>
                          <label style="font-size:11.5px; font-weight:700; color:var(--secondary); display:block; margin-bottom:4px;">Pie Afectado</label>
                          <div class="foot-checkbox-row">
                            <label class="foot-check-label">
                              <input type="checkbox" ${d.pie_izquierdo ? 'checked' : ''} onchange="state.consultaForm.diagnosticos[${index}].pie_izquierdo=this.checked;">
                              <span>Pie Izq.</span>
                            </label>
                            <label class="foot-check-label">
                              <input type="checkbox" ${d.pie_derecho ? 'checked' : ''} onchange="state.consultaForm.diagnosticos[${index}].pie_derecho=this.checked;">
                              <span>Pie Der.</span>
                            </label>
                          </div>
                        </div>

                        <div class="form-field-group" style="margin-bottom:0;">
                          <label>Tipo</label>
                          <select onchange="state.consultaForm.diagnosticos[${index}].tipo_diagnostico=this.value;">
                            <option value="Correctivo" ${d.tipo_diagnostico === 'Correctivo' ? 'selected' : ''}>Correctivo</option>
                            <option value="Preventivo" ${d.tipo_diagnostico === 'Preventivo' ? 'selected' : ''}>Preventivo</option>
                            <option value="Evolutivo" ${d.tipo_diagnostico === 'Evolutivo' ? 'selected' : ''}>Evolutivo</option>
                            <option value="Urgencia" ${d.tipo_diagnostico === 'Urgencia' ? 'selected' : ''}>Urgencia</option>
                          </select>
                        </div>
                      </div>

                      <div class="form-field-group" style="margin-top:10px; margin-bottom:0;">
                        <input 
                          type="text" 
                          placeholder="Detalles adicionales, grado o dedos afectados (opcional)..." 
                          value="${d.detalles_adicionales || ''}"
                          oninput="state.consultaForm.diagnosticos[${index}].detalles_adicionales=this.value;"
                        >
                      </div>
                    </div>
                  `).join('')}
                </div>

                <button type="button" class="btn-add-dynamic" onclick="agregarDiagnosticoConsulta()">
                  <i class="fa-solid fa-plus"></i> Agregar Otro Diagnóstico
                </button>
              </div>

              <!-- PASO 5: TRATAMIENTOS Y PROCEDIMIENTOS REALIZADOS (DINÁMICO) -->
              <div class="booking-form-section">
                <div class="section-step-indicator">
                  <div class="step-circle"><i class="fa-solid fa-hand-holding-medical" style="font-size:12px;"></i></div>
                  <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <h3>5. Procedimientos y Tratamientos Realizados</h3>
                      <span style="font-size:11.5px; font-weight:700; color:var(--primary);">${form.tratamientos.length} Procedimiento(s)</span>
                    </div>
                    <p>Servicios clínicos aplicados y recomendaciones terapéuticas</p>
                  </div>
                </div>

                <!-- Tags rápidos para agregar procedimientos -->
                <div style="margin-bottom:12px;">
                  <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Añadir Procedimiento Frecuente:</label>
                  <div class="quick-tags-container" style="margin-top:4px;">
                    ${procedimientosRapidos.map(pr => `
                      <span class="quick-tag-pill" onclick="agregarTratamientoConsulta('${pr}')">
                        <i class="fa-solid fa-plus" style="font-size:9px;"></i> ${pr}
                      </span>
                    `).join('')}
                  </div>
                </div>

                <!-- Lista de tratamientos -->
                <div id="tratamientos-container">
                  ${form.tratamientos.map((t, index) => `
                    <div class="dynamic-item-card">
                      <div class="dynamic-item-header">
                        <div class="dynamic-item-title">
                          <span style="width:22px; height:22px; border-radius:50%; background:var(--surface-alt); display:grid; place-items:center; font-size:11px;">${index + 1}</span>
                          <span>Procedimiento / Servicio</span>
                        </div>
                        <button type="button" class="btn-remove-item" title="Eliminar tratamiento" onclick="eliminarTratamientoConsulta(${index})">
                          <i class="fa-solid fa-trash-can"></i>
                        </button>
                      </div>

                      <div class="form-field-group">
                        <label>Procedimiento o Servicio Realizado *</label>
                        <input 
                          type="text" 
                          required 
                          placeholder="Ej. Quiropodia integral y remoción de hiperqueratosis" 
                          value="${t.procedimiento_servicio || ''}"
                          oninput="state.consultaForm.tratamientos[${index}].procedimiento_servicio=this.value;"
                        >
                      </div>

                      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                        <div>
                          <label style="font-size:11.5px; font-weight:700; color:var(--secondary); display:block; margin-bottom:4px;">Pie Tratado</label>
                          <div class="foot-checkbox-row">
                            <label class="foot-check-label">
                              <input type="checkbox" ${t.pie_izquierdo ? 'checked' : ''} onchange="state.consultaForm.tratamientos[${index}].pie_izquierdo=this.checked;">
                              <span>Pie Izq.</span>
                            </label>
                            <label class="foot-check-label">
                              <input type="checkbox" ${t.pie_derecho ? 'checked' : ''} onchange="state.consultaForm.tratamientos[${index}].pie_derecho=this.checked;">
                              <span>Pie Der.</span>
                            </label>
                          </div>
                        </div>

                        <div class="form-field-group" style="margin-bottom:0;">
                          <label>Frecuencia / Seguimiento</label>
                          <input 
                            type="text" 
                            placeholder="Ej. Control en 30 días" 
                            value="${t.frecuencia || ''}"
                            oninput="state.consultaForm.tratamientos[${index}].frecuencia=this.value;"
                          >
                        </div>
                      </div>

                      <div class="form-field-group" style="margin-top:10px; margin-bottom:0;">
                        <label>Medicamento o Producto Aplicado en Consultorio</label>
                        <input 
                          type="text" 
                          placeholder="Ej. Tintura antifúngica, pomada con urea al 20%, antiséptico iodado..." 
                          value="${t.tratamiento_aplicado || ''}"
                          oninput="state.consultaForm.tratamientos[${index}].tratamiento_aplicado=this.value;"
                        >
                      </div>
                    </div>
                  `).join('')}
                </div>

                <button type="button" class="btn-add-dynamic" onclick="agregarTratamientoConsulta()">
                  <i class="fa-solid fa-plus"></i> Agregar Otro Tratamiento
                </button>
              </div>

              <!-- BOTÓN DE CONFIRMACIÓN -->
              <button type="submit" class="btn-primary-pill" style="margin-top:14px; padding:16px 24px; font-size:14.5px;">
                <i class="fa-solid fa-file-medical"></i>
                <span>Finalizar y Guardar Consulta en Expediente</span>
              </button>
            </form>
          </div>

          <!-- Columna Derecha: Resumen Clínico Lateral en Vivo -->
          <div>
            <div class="booking-summary-box" style="position:sticky; top:24px;">
              <h3 class="summary-heading">Resumen Clínico</h3>

              <div class="summary-row-item">
                <i class="fa-solid fa-user"></i>
                <div>
                  <small>Paciente</small>
                  <strong>${form.nombre_completo || 'Sin especificar'}</strong>
                  ${form.expediente ? `<div style="font-size:11px; color:var(--primary); font-weight:700;">Exp. #${form.expediente}</div>` : ''}
                </div>
              </div>

              <div class="summary-row-item">
                <i class="fa-solid fa-phone"></i>
                <div>
                  <small>Teléfono</small>
                  <strong>${form.telefono || 'Sin teléfono'}</strong>
                </div>
              </div>

              <div class="summary-row-item">
                <i class="fa-solid fa-hospital"></i>
                <div>
                  <small>Sede de Atención</small>
                  <strong>${getClinicNameById(form.id_clinica)}</strong>
                </div>
              </div>

              <div class="summary-row-item">
                <i class="fa-solid fa-heart-pulse"></i>
                <div>
                  <small>Condición Médica</small>
                  <strong>
                    ${form.es_diabetico ? '<span style="color:#d32f2f;">• Pie Diabético</span><br>' : ''}
                    ${form.es_hipertenso ? '<span style="color:#f57c00;">• Hipertenso</span><br>' : ''}
                    ${!form.es_diabetico && !form.es_hipertenso ? 'Sin factores de riesgo registrados' : ''}
                  </strong>
                </div>
              </div>

              <div class="summary-row-item">
                <i class="fa-solid fa-notes-medical"></i>
                <div>
                  <small>Diagnósticos Cargados</small>
                  <strong>${form.diagnosticos.length} padecimiento(s)</strong>
                </div>
              </div>

              <div class="summary-row-item">
                <i class="fa-solid fa-hand-holding-medical"></i>
                <div>
                  <small>Procedimientos</small>
                  <strong>${form.tratamientos.length} aplicado(s)</strong>
                </div>
              </div>

              <div class="summary-row-item">
                <i class="fa-solid fa-user-doctor"></i>
                <div>
                  <small>Podólogo a Cargo</small>
                  <strong>${state.user}</strong>
                </div>
              </div>

              <button type="button" class="btn-primary-pill" onclick="document.getElementById('consulta-form').requestSubmit();">
                <i class="fa-solid fa-check"></i> Guardar Consulta
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ------------------------------------------
// 4.3. PANTALLA: AGENDA MÉDICA (CALENDARIO DINÁMICO)
// ------------------------------------------
function renderAgendaPage() {
  const hoy = new Date();
  const { month, year } = state.calendar;
  const nombreMes = NOMBRES_MESES[month];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDayOffset = new Date(year, month, 1).getDay();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const diff = getCalendarMonthDiff();
  let diffBadge = 'Mes actual';
  if (diff < 0) diffBadge = `${Math.abs(diff)} mes(es) antes`;
  else if (diff > 0) diffBadge = `+${diff} mes(es) adelante`;

  const isPrevDisabled = !canMoveCalendarPrev();
  const isNextDisabled = !canMoveCalendarNext();

  return `
    <div>
      <div class="calendar-wrapper">
        <div class="calendar-month-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <span style="font-size:10.5px; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:0.8px;">CALENDARIO CLÍNICO</span>
              <span class="calendar-limit-badge">${diffBadge}</span>
            </div>
            <h3 style="font-size:22px;">${nombreMes} ${year}</h3>
            <p style="font-size:12px; color:var(--text-muted);">${getCurrentClinicName()} · Límite de navegación: ±3 meses</p>
          </div>

          <div style="display:flex; gap:8px; align-items:center;">
            <button class="hero-btn-pill" style="padding:8px 14px; font-size:12px; background:var(--surface-alt); box-shadow:none;" onclick="resetCalendarToToday()">
              <i class="fa-regular fa-calendar-check" style="color:var(--primary);"></i> Hoy
            </button>
            <button class="icon-btn-pill ${isPrevDisabled ? 'disabled' : ''}" ${isPrevDisabled ? 'disabled' : ''} onclick="changeCalendarMonth(-1)" title="Mes anterior (máx. 3 meses atrás)">
              <i class="fa-solid fa-chevron-left"></i>
            </button>
            <button class="icon-btn-pill ${isNextDisabled ? 'disabled' : ''}" ${isNextDisabled ? 'disabled' : ''} onclick="changeCalendarMonth(1)" title="Mes siguiente (máx. 3 meses adelante)">
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>

        <div class="calendar-grid-table">
          ${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => `<div class="cal-day-label">${d}</div>`).join('')}

          ${Array.from({ length: startDayOffset }, (_, i) => {
            const prevDayNum = prevMonthDays - startDayOffset + 1 + i;
            return `
              <div class="cal-day-cell is-other-month">
                <b>${prevDayNum}</b>
              </div>
            `;
          }).join('')}

          ${Array.from({ length: daysInMonth }, (_, i) => {
            const dayNum = i + 1;
            const isToday = (dayNum === hoy.getDate() && month === hoy.getMonth() && year === hoy.getFullYear());
            const monthStr = String(month + 1).padStart(2, '0');
            const dayStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
            const datePrefix = `${year}-${monthStr}-${dayStr}`;

            const citasDelDia = state.appointments.filter(c => {
              const f = c.fecha_hora_inicio || c.fecha_hora || '';
              return f.startsWith(datePrefix) || f.includes(datePrefix);
            });

            return `
              <div class="cal-day-cell ${isToday ? 'is-today' : ''}" onclick="openDayModal(${dayNum}, ${month}, ${year})">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <b>${dayNum}</b>
                  ${isToday ? '<span style="font-size:9.5px; font-weight:800; color:var(--primary); text-transform:uppercase;">Hoy</span>' : ''}
                </div>
                <div>
                  ${citasDelDia.map(c => `
                    <div class="cal-event-pill" title="${c.paciente_nombre || 'Cita'} · ${c.hora || ''} ${c.ampm || ''}">
                      ${c.hora || '10:00'} ${(c.paciente_nombre || 'Cita').split(' ')[0]}
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// ------------------------------------------
// 4.4. PANTALLA: PACIENTES Y EXPEDIENTES
// ------------------------------------------
function renderPatientsPage() {
  const term = state.searchTerm.toLowerCase().trim();
  const filtered = state.patients.filter(p => {
    return (p.nombre_completo || '').toLowerCase().includes(term) ||
           (p.telefono || '').includes(term) ||
           (p.expediente && p.expediente.toString().toLowerCase().includes(term)) ||
           (p.No_expediente && p.No_expediente.toString().toLowerCase().includes(term)) ||
           (p.notas_alergias || '').toLowerCase().includes(term) ||
           (p.Notas || '').toLowerCase().includes(term) ||
           (p.Antecedentes_patologicos || '').toLowerCase().includes(term);
  });

  return `
    <div>
      <div class="patient-directory-card">
        <div class="section-header-row" style="margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 class="section-heading">Directorio de Pacientes</h3>
            <p style="font-size:12.5px; color:var(--text-muted);">Expedientes y control clínico de pacientes registrados en MySQL</p>
          </div>

          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn-primary-pill" style="width:auto; padding:10px 18px; background:var(--surface); color:var(--primary); border:1px solid var(--primary);" onclick="navigate('agendar')">
              <i class="fa-solid fa-calendar-plus"></i> Agendar Cita
            </button>
            <button class="btn-primary-pill" style="width:auto; padding:10px 18px;" onclick="navigate('consulta')">
              <i class="fa-solid fa-notes-medical"></i> Registrar Consulta
            </button>
          </div>
        </div>

        <div class="search-input-wrapper" style="margin-bottom:20px; max-width:540px;">
          <i class="fa-solid fa-magnifying-glass search-icon"></i>
          <input 
            type="text" 
            placeholder="Buscar por nombre, No. de Expediente (Ej. 2025140001), teléfono..." 
            value="${state.searchTerm}"
            oninput="state.searchTerm=this.value; renderPatientsTableOnly();"
          >
          ${state.searchTerm ? `
            <button class="search-clear-btn" onclick="state.searchTerm=''; renderPatientsTableOnly();">
              <i class="fa-solid fa-xmark"></i>
            </button>
          ` : ''}
        </div>

        <div id="patients-table-container">
          ${renderPatientsTableHtml(filtered)}
        </div>
      </div>
    </div>
  `;
}

function renderPatientsTableOnly() {
  const container = document.getElementById('patients-table-container');
  if (!container) return;
  const term = state.searchTerm.toLowerCase().trim();
  const filtered = state.patients.filter(p => {
    return (p.nombre_completo || '').toLowerCase().includes(term) ||
           (p.telefono || '').includes(term) ||
           (p.expediente && p.expediente.toString().toLowerCase().includes(term)) ||
           (p.No_expediente && p.No_expediente.toString().toLowerCase().includes(term)) ||
           (p.notas_alergias || '').toLowerCase().includes(term) ||
           (p.Notas || '').toLowerCase().includes(term) ||
           (p.Antecedentes_patologicos || '').toLowerCase().includes(term);
  });
  container.innerHTML = renderPatientsTableHtml(filtered);
}

function renderPatientsTableHtml(pacientes) {
  if (pacientes.length === 0) {
    return `
      <div style="text-align:center; padding:36px 16px; color:var(--text-muted);">
        <i class="fa-solid fa-users-slash" style="font-size:32px; margin-bottom:10px;"></i>
        <p>No se encontraron pacientes que coincidan con la búsqueda.</p>
      </div>
    `;
  }

  return `
    <div style="overflow-x:auto;">
      <table class="patients-list-table">
        <thead>
          <tr>
            <th>Paciente / Expediente</th>
            <th>Contacto</th>
            <th>Edad / Sexo</th>
            <th>Condición</th>
            <th>Última Atención</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          ${pacientes.map((p, idx) => {
            const fNac = (p.Fecha_nacimiento || p.fecha_nacimiento || '').split('T')[0];
            const edadCalculada = fNac ? (calcularEdad(fNac) || p.edad || '') : (p.edad || '');
            const sexoCalculado = p.sexo || (p.Sexo === 'M' ? 'Masculino' : p.Sexo === 'F' ? 'Femenino' : (p.Sexo || '—'));
            const expDisplay = p.expediente || p.No_expediente || 'Sin Exp';

            return `
              <tr>
                <td>
                  <div style="display:flex; align-items:center; gap:12px;">
                    <div class="patient-avatar-box tint-orange" style="width:36px; height:36px; font-size:14px; border-radius:var(--radius-xs);">
                      ${(p.nombre_completo || 'P')[0].toUpperCase()}
                    </div>
                    <div>
                      <strong style="color:var(--secondary); font-size:13.5px;">${p.nombre_completo}</strong>
                      <div style="font-size:11px; color:var(--primary); font-weight:700;">Exp. #${expDisplay}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div>${p.telefono || 'Sin teléfono'}</div>
                  <small style="font-size:10.5px; color:var(--text-muted);">${p.Municipio || p.municipio || ''}</small>
                </td>
                <td>${edadCalculada ? edadCalculada + ' años' : '—'} · ${sexoCalculado}</td>
                <td>
                  ${p.es_diabetico ? '<span class="micro-tag tag-diabetic">Pie Diabético</span> ' : ''}
                  ${p.es_hipertenso ? '<span class="micro-tag tag-hypertension">Hipertenso</span> ' : ''}
                  ${!p.es_diabetico && !p.es_hipertenso ? '<span class="micro-tag tag-regular">General</span>' : ''}
                </td>
                <td><span style="font-size:12px; color:var(--text-muted);">${(p.ultima_cita || 'Sin registro').slice(0, 16).replace('T', ' ')}</span></td>
                <td>
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="hero-btn-pill" style="padding:6px 10px; font-size:11px; background:var(--surface-alt); box-shadow:none;" onclick="openPatientModal('${expDisplay}')" title="Ver Ficha Clínica">
                      <i class="fa-solid fa-folder-open" style="color:var(--primary);"></i> Ficha
                    </button>
                    <button class="hero-btn-pill" style="padding:6px 10px; font-size:11px; background:var(--secondary); color:#ffffff; box-shadow:none;" onclick="Modules.openExpediente('${expDisplay}')" title="Abrir Expediente Clínico Electrónico" data-testid="btn-expediente-${expDisplay}">
                      <i class="fa-solid fa-file-medical"></i> Expediente
                    </button>
                    <button class="hero-btn-pill" style="padding:6px 10px; font-size:11px; background:var(--primary); color:#ffffff; box-shadow:none;" onclick="iniciarConsultaDirectaConPaciente(state.patients.find(x => (x.expediente||x.No_expediente)==='${expDisplay}') || state.patients[${idx}])" title="Atender Consulta Directa">
                      <i class="fa-solid fa-notes-medical"></i> Atender
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ------------------------------------------
// 4.5. PANTALLA: REPORTES Y MÉTRICAS
// ------------------------------------------
function renderReportsPage() {
  return `
    <div>
      <div class="patient-directory-card">
        <div class="section-header-row" style="margin-bottom:24px;">
          <div>
            <h3 class="section-heading">Reportes Clínicos y Productividad</h3>
            <p style="font-size:12.5px; color:var(--text-muted);">Estadísticas de atención y cobertura por consultorio</p>
          </div>

          <button class="btn-primary-pill" style="width:auto; padding:10px 18px;" onclick="toast('Generando reporte en PDF...')">
            <i class="fa-solid fa-download"></i> Exportar PDF
          </button>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:18px;">
          <div style="background:var(--surface-alt); padding:20px; border-radius:var(--radius-lg); border:1px solid var(--border-light);">
            <i class="fa-solid fa-stethoscope" style="font-size:24px; color:var(--primary); margin-bottom:10px;"></i>
            <h4 style="font-size:15px; font-weight:700; color:var(--secondary); margin-bottom:4px;">Tratamientos Principales</h4>
            <p style="font-size:12.5px; color:var(--text-muted);">65% Quiropodia preventiva y deslaminado. 35% Onicocriptosis y helomas.</p>
          </div>

          <div style="background:var(--surface-alt); padding:20px; border-radius:var(--radius-lg); border:1px solid var(--border-light);">
            <i class="fa-solid fa-heart-pulse" style="font-size:24px; color:var(--accent-rose); margin-bottom:10px;"></i>
            <h4 style="font-size:15px; font-weight:700; color:var(--secondary); margin-bottom:4px;">Control de Pie Diabético</h4>
            <p style="font-size:12.5px; color:var(--text-muted);">Protocolo preventivo con valoración de pulsos y sensibilidad en talones.</p>
          </div>

          <div style="background:var(--surface-alt); padding:20px; border-radius:var(--radius-lg); border:1px solid var(--border-light);">
            <i class="fa-solid fa-hospital" style="font-size:24px; color:var(--accent-mint); margin-bottom:10px;"></i>
            <h4 style="font-size:15px; font-weight:700; color:var(--secondary); margin-bottom:4px;">Afluencia por Sede</h4>
            <p style="font-size:12.5px; color:var(--text-muted);">DIF Lomas de Tecámac concentra la mayor demanda de consultas matutinas.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ------------------------------------------
// 4.6. PANTALLAS COMPLEMENTARIAS: INVENTARIO Y RECETAS (FALLBACK)
// ------------------------------------------
function renderInventarioFallbackPage() {
  return `
    <div style="padding: 24px;">
      <div class="page-head" style="margin-bottom: 20px;">
        <div>
          <h2 class="page-title"><i class="fa-solid fa-boxes-stacked" aria-hidden="true"></i> Inventario</h2>
          <p class="page-sub">Control de insumos médicos y materiales podológicos</p>
        </div>
      </div>
      <section class="module" id="inventario-root" aria-live="polite">
        <div class="ece-card glass" style="padding: 30px; text-align: center;">
          <i class="fa-solid fa-spinner fa-spin" style="font-size: 28px; color: var(--primary); margin-bottom: 12px;"></i>
          <p style="color: var(--text-muted);">Cargando módulo de inventario...</p>
        </div>
      </section>
    </div>
  `;
}

function renderRecetasFallbackPage() {
  return `
    <div style="padding: 24px;">
      <div class="page-head" style="margin-bottom: 20px;">
        <div>
          <h2 class="page-title"><i class="fa-solid fa-prescription" aria-hidden="true"></i> Recetas Médicas</h2>
          <p class="page-sub">Prescripciones podológicas y exportación a PDF</p>
        </div>
      </div>
      <section class="module" id="recetas-root" aria-live="polite">
        <div class="ece-card glass" style="padding: 30px; text-align: center;">
          <i class="fa-solid fa-spinner fa-spin" style="font-size: 28px; color: var(--primary); margin-bottom: 12px;"></i>
          <p style="color: var(--text-muted);">Cargando módulo de recetas...</p>
        </div>
      </section>
    </div>
  `;
}

// ------------------------------------------
// 4.7. PANTALLA: LOGIN BOUTIQUE
// ------------------------------------------
function renderLoginPage() {
  if (window.Modules && typeof window.Modules.renderLogin === 'function') {
    return window.Modules.renderLogin();
  }
  return `
    <div class="login-root">
      <div class="login-card-boutique">
        <div class="login-logo-box">
          <i class="fa-solid fa-stethoscope"></i>
        </div>

        <h2 style="font-family:var(--font-serif); font-size:24px; color:var(--secondary); margin-bottom:4px;">Elite Foot Care</h2>
        <p style="font-size:12.5px; color:var(--text-muted); margin-bottom:24px;">Gestión Podológica Especializada</p>

        <form onsubmit="loginSubmit(event)">
          <div class="form-field-group" style="text-align:left;">
            <label>Usuario Podólogo (Email)</label>
            <input type="text" id="login-user" required value="Angel Hernandez" placeholder="doctor@clinica.mx">
          </div>

          <div class="form-field-group" style="text-align:left;">
            <label>Contraseña</label>
            <div style="position:relative;">
              <input type="password" id="login-password" required value="podologia2026" placeholder="••••••••">
              <button type="button" onclick="togglePasswordVisibility()" style="position:absolute; right:14px; top:50%; transform:translateY(-50%); color:var(--text-subtle);">
                <i class="fa-solid fa-eye" id="pass-toggle-icon"></i>
              </button>
            </div>
          </div>

          <button type="submit" class="btn-primary-pill" style="margin-top:20px;">
            <span>Ingresar al Consultorio</span>
            <i class="fa-solid fa-arrow-right"></i>
          </button>
        </form>
      </div>
    </div>
  `;
}

// ==========================================
// 5. FUNCIÓN PRINCIPAL DE RENDERIZADO
// ==========================================

function render() {
  const app = document.getElementById('app');
  if (!app) return;

  // Verificación y protección de rutas con el módulo de seguridad
  if (window.Modules && typeof window.Modules.guard === 'function') {
    state.page = window.Modules.guard(state.page);
  }

  if (state.page === 'login') {
    app.className = 'login-root';
    app.innerHTML = renderLoginPage();
    if (window.Modules && typeof window.Modules.afterRender === 'function') {
      window.Modules.afterRender('login');
    }
    return;
  }

  app.className = 'app';

  // Si la página es atendida por los módulos avanzados (Dashboard Analítico, Agenda, ECE, Inventario, Recetas)
  let mainContent = window.Modules && typeof window.Modules.renderPage === 'function' ? window.Modules.renderPage(state.page) : null;

  if (state.page === 'inicio') {
    if (mainContent) {
      // Integrar el topbar editorial con saludo y buscador sobre el Dashboard Analítico moderno
      mainContent = `
        ${renderTopbar()}
        ${mainContent}
      `;
    } else {
      mainContent = renderHomePage();
    }
  } else if (!mainContent) {
    if (state.page === 'agenda') mainContent = renderAgendaPage();
    else if (state.page === 'pacientes') mainContent = renderPatientsPage();
    else if (state.page === 'consulta') mainContent = renderConsultaPage();
    else if (state.page === 'agendar') mainContent = renderBookingPage();
    else if (state.page === 'reportes') mainContent = renderReportsPage();
    else if (state.page === 'inventario') mainContent = renderInventarioFallbackPage();
    else if (state.page === 'recetas') mainContent = renderRecetasFallbackPage();
    else mainContent = renderHomePage();
  }

  app.innerHTML = `
    ${renderSidebar()}
    <main class="main">
      ${mainContent}
    </main>
    ${renderBottomNav()}
  `;

  // Montar componentes y escuchadores de los módulos avanzados
  if (window.Modules && typeof window.Modules.afterRender === 'function') {
    window.Modules.afterRender(state.page);
  }
}

// ==========================================
// 6. INICIALIZACIÓN
// ==========================================

async function initApp() {
  // Conectar bridge de módulos si está presente
  if (window.Modules) {
    window.Modules.connect({
      state,
      render,
      navigate,
      bootData: async () => {
        await fetchClinicas();
        await fetchPacientes();
        await fetchCitas();
      },
      clinicName: getCurrentClinicName,
      iniciarConsulta: vincularCitaAConsulta,
      iniciarConsultaConPaciente: iniciarConsultaDirectaConPaciente,
      refreshLegacyCitas: fetchCitas
    });
    state.page = window.Modules.initialPage();
  }

  // 1. Cargar datos base y renderizar de inmediato
  cargarCitasDemoSiVacio();
  render();

  // 2. Sincronizar en segundo plano con el Backend si está activo
  try {
    await fetchClinicas();
    await fetchPacientes();
    await fetchCitas();
  } catch (err) {
    console.warn('Modo offline / datos locales cargados:', err);
  }
  render();
}

if (window.Modules) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
} else {
  window.addEventListener('modules:ready', () => {
    initApp();
  }, { once: true });
  // Fallback por si modules tarda o no se cargó como ES module
  setTimeout(() => {
    if (!window.__appInitialized) {
      window.__appInitialized = true;
      initApp();
    }
  }, 100);
}