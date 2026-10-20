const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('../config/db');

// Ruta del archivo de persistencia local para metadatos del Admin (estados de baja, recepcionistas, avisos)
const DATA_DIR = path.join(__dirname, '../data');
const ADMIN_DATA_FILE = path.join(DATA_DIR, 'admin_store.json');

// Inicializar directorio y archivo si no existen
function asegurarDirectorioData() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ADMIN_DATA_FILE)) {
    const initialData = {
      podologos_meta: {
        'A-54906': { activo: true, fecha_alta: '2025-01-15', notas_admin: 'Podóloga Especialista - Titular' },
        'B-24267': { activo: true, fecha_alta: '2025-02-10', notas_admin: 'Podólogo Cirujano y Biomecánica' },
        'C-12345': { activo: true, fecha_alta: '2025-06-01', notas_admin: 'Podóloga General' }
      },
      recepcionistas: [
        {
          id: 1,
          nombre: 'María',
          ape_paterno: 'López',
          ape_materno: 'Hernández',
          email: 'recepcion@elitefoot.com',
          telefono: '5544332211',
          fk_clinica_id: 14,
          clinica_nombre: 'DIF Lomas de Tecámac',
          turno: 'Matutino (8:00 - 15:00)',
          activo: true,
          fecha_alta: '2025-03-01'
        },
        {
          id: 2,
          nombre: 'Carlos',
          ape_paterno: 'Morales',
          ape_materno: 'Vázquez',
          email: 'carlos.recepcion@elitefoot.com',
          telefono: '5577889900',
          fk_clinica_id: 28,
          clinica_nombre: 'Casa Héroes Tecámac',
          turno: 'Vespertino (14:00 - 20:00)',
          activo: true,
          fecha_alta: '2025-05-12'
        },
        {
          id: 3,
          nombre: 'Elena',
          ape_paterno: 'Sánchez',
          ape_materno: 'Cruz',
          email: 'elena.recep@elitefoot.com',
          telefono: '5511223344',
          fk_clinica_id: 35,
          clinica_nombre: 'Casa Adulto Mayor Flores',
          turno: 'Completo (9:00 - 18:00)',
          activo: false,
          fecha_alta: '2024-11-20',
          motivo_baja: 'Permiso temporal de maternidad'
        }
      ],
      avisos: [
        {
          id: 'aviso-1',
          no_expediente: 2026140001,
          paciente_nombre: 'Rosa María Martínez',
          telefono: '5541238970',
          tipo: 'recordatorio_cita',
          tipo_label: 'Recordatorio de Cita',
          canal: 'whatsapp',
          asunto: 'Cita Podológica Programada',
          mensaje: 'Estimada Rosa María, le recordamos su cita de podología preventiva programada para mañana a las 10:00 AM en DIF Lomas de Tecámac.',
          enlace_whatsapp: 'https://api.whatsapp.com/send?phone=525541238970&text=Estimada%20Rosa%20Mar%C3%ADa%2C%20le%20recordamos%20su%20cita%20de%20podolog%C3%ADa%20preventiva%20programada%20para%20ma%C3%B1ana%20a%20las%2010%3A00%20AM%20en%20DIF%20Lomas%20de%20Tec%C3%A1mac.',
          fecha_envio: '2026-10-14 09:30',
          enviado_por: 'Administrador General'
        },
        {
          id: 'aviso-2',
          no_expediente: 2026140002,
          paciente_nombre: 'Juan Carlos Ruiz',
          telefono: '5533221144',
          tipo: 'pie_diabetico',
          tipo_label: 'Control de Pie Diabético',
          canal: 'whatsapp',
          asunto: 'Chequeo Trimestral Preventivo',
          mensaje: 'Hola Juan Carlos, por protocolo de salud para pacientes con Diabetes, le sugerimos agendar su valoración trimestral de sensibilidad y corte profiláctico.',
          enlace_whatsapp: 'https://api.whatsapp.com/send?phone=525533221144&text=Hola%20Juan%20Carlos%2C%20por%20protocolo%20de%20salud%20para%20pacientes%20con%20Diabetes%2C%20le%20sugerimos%20agendar%20su%20valoraci%C3%B3n%20trimestral.',
          fecha_envio: '2026-10-13 16:45',
          enviado_por: 'Administrador General'
        }
      ]
    };
    fs.writeFileSync(ADMIN_DATA_FILE, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

function leerAdminStore() {
  asegurarDirectorioData();
  try {
    const raw = fs.readFileSync(ADMIN_DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error al leer admin_store.json:', e);
    return { podologos_meta: {}, recepcionistas: [], avisos: [] };
  }
}

function guardarAdminStore(data) {
  asegurarDirectorioData();
  try {
    fs.writeFileSync(ADMIN_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error al guardar admin_store.json:', e);
  }
}

// --------------------------------------------------------------------------
// 1. MÉTRICAS GENERALES DEL SISTEMA (DASHBOARD ADMIN)
// --------------------------------------------------------------------------
const obtenerMetricas = async (req, res) => {
  try {
    const store = leerAdminStore();

    // Consultas a MySQL
    const [podosDb] = await db.pool.query('SELECT Cedula_podologo FROM Podologos');
    const [pacientesDb] = await db.pool.query(`
      SELECT 
        COUNT(DISTINCT CONCAT(LOWER(TRIM(Nombres)), '|', LOWER(TRIM(ape_paterno)), '|', LOWER(TRIM(COALESCE(ape_materno, ''))), '|', COALESCE(telefono, ''))) AS total,
        COUNT(DISTINCT CASE WHEN es_diabetico = 1 THEN CONCAT(LOWER(TRIM(Nombres)), '|', LOWER(TRIM(ape_paterno)), '|', LOWER(TRIM(COALESCE(ape_materno, ''))), '|', COALESCE(telefono, '')) END) AS diabeticos,
        COUNT(DISTINCT CASE WHEN es_hipertenso = 1 THEN CONCAT(LOWER(TRIM(Nombres)), '|', LOWER(TRIM(ape_paterno)), '|', LOWER(TRIM(COALESCE(ape_materno, ''))), '|', COALESCE(telefono, '')) END) AS hipertensos
      FROM Pacientes
    `);
    const [clinicasDb] = await db.pool.query('SELECT Clinica_id, Activa FROM Clinicas');

    // Podólogos activos vs dados de baja
    const podologosMeta = store.podologos_meta || {};
    let podosActivos = 0;
    let podosBaja = 0;

    podosDb.forEach((p) => {
      const meta = podologosMeta[p.Cedula_podologo];
      if (meta && meta.activo === false) {
        podosBaja++;
      } else {
        podosActivos++;
      }
    });

    // Recepcionistas
    const receps = store.recepcionistas || [];
    const recepsActivos = receps.filter((r) => r.activo !== false).length;
    const recepsBaja = receps.filter((r) => r.activo === false).length;

    // Pacientes
    const pacStats = pacientesDb[0] || { total: 0, diabeticos: 0, hipertensos: 0 };

    // Clínicas
    const clinicasActivas = clinicasDb.filter((c) => c.Activa === 1 || c.Activa === null || c.Activa === true).length;
    const clinicasBaja = clinicasDb.filter((c) => c.Activa === 0 || c.Activa === false).length;

    res.json({
      podologos: {
        total: podosDb.length,
        activos: podosActivos,
        baja: podosBaja
      },
      recepcionistas: {
        total: receps.length,
        activos: recepsActivos,
        baja: recepsBaja
      },
      pacientes: {
        total: Number(pacStats.total) || 0,
        diabeticos: Number(pacStats.diabeticos) || 0,
        hipertensos: Number(pacStats.hipertensos) || 0
      },
      avisos: {
        total: (store.avisos || []).length,
        ultimos: (store.avisos || []).slice(0, 5)
      },
      clinicas: {
        total: clinicasDb.length,
        activas: clinicasActivas,
        baja: clinicasBaja
      }
    });
  } catch (error) {
    console.error('Error al obtener métricas de admin:', error);
    res.status(500).json({ error: 'Error al obtener métricas del administrador' });
  }
};

// --------------------------------------------------------------------------
// 2. GESTIÓN DE PODÓLOGOS (LISTAR, CREAR, BAJA/REACTIVAR, EDITAR)
// --------------------------------------------------------------------------
const obtenerPodologosAdmin = async (req, res) => {
  try {
    const store = leerAdminStore();
    const metaMap = store.podologos_meta || {};

    const [rows] = await db.pool.query(`
      SELECT Cedula_podologo, Nombre, ape_paterno, ape_materno, 
             TRIM(CONCAT(Nombre, ' ', ape_paterno, ' ', COALESCE(ape_materno, ''))) AS nombre_completo,
             Telefono_pod, Email, turno
      FROM Podologos 
      ORDER BY Nombre ASC
    `);

    const podologos = rows.map((p) => {
      const meta = metaMap[p.Cedula_podologo] || { activo: true, fecha_alta: '2025-01-01' };
      return {
        ...p,
        activo: meta.activo !== false,
        fecha_alta: meta.fecha_alta || '2025-01-01',
        notas_admin: meta.notas_admin || ''
      };
    });

    res.json(podologos);
  } catch (error) {
    console.error('Error al listar podólogos admin:', error);
    res.status(500).json({ error: 'Error al obtener la lista de podólogos' });
  }
};

const crearPodologoAdmin = async (req, res) => {
  const {
    Cedula_podologo,
    Nombre,
    ape_paterno,
    ape_materno,
    Telefono_pod,
    Email,
    email,
    Password_hash,
    password,
    turno
  } = req.body;

  const cedula = (Cedula_podologo || '').trim();
  const nombre = (Nombre || '').trim();
  const apeP = (ape_paterno || '').trim();
  const apeM = (ape_materno || '').trim() || null;
  const tel = (Telefono_pod || '').trim() || null;
  const correo = (Email || email || '').trim().toLowerCase();
  const rawPass = Password_hash || password || 'podo123';
  const turnoVal = (turno || 'C').slice(0, 1).toUpperCase();

  if (!cedula || !nombre || !apeP || !correo) {
    return res.status(400).json({ error: 'Cédula, nombre, apellido paterno y correo electrónico son obligatorios' });
  }

  try {
    // 1. Cifrado seguro de contraseña con Bcrypt
    const passHash = (rawPass.startsWith('$2a$') || rawPass.startsWith('$2b$'))
      ? rawPass
      : await bcrypt.hash(rawPass, 10);

    // 2. Insertar en tabla MySQL Podologos
    await db.pool.query(
      `INSERT INTO Podologos (Cedula_podologo, Nombre, ape_paterno, ape_materno, Telefono_pod, Email, Password_hash, turno)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cedula, nombre, apeP, apeM, tel, correo, passHash, turnoVal]
    );

    // 2. Guardar estado activo en store de admin
    const store = leerAdminStore();
    if (!store.podologos_meta) store.podologos_meta = {};
    store.podologos_meta[cedula] = {
      activo: true,
      fecha_alta: new Date().toISOString().split('T')[0],
      notas_admin: 'Registrado desde Panel de Administración'
    };
    guardarAdminStore(store);

    res.status(201).json({
      mensaje: 'Podólogo registrado exitosamente',
      podologo: {
        Cedula_podologo: cedula,
        Nombre: nombre,
        ape_paterno: apeP,
        ape_materno: apeM,
        nombre_completo: `${nombre} ${apeP} ${apeM || ''}`.trim(),
        Telefono_pod: tel,
        Email: correo,
        turno: turnoVal,
        activo: true
      }
    });
  } catch (error) {
    console.error('Error al crear podólogo:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un podólogo con esa cédula profesional o correo electrónico' });
    }
    res.status(500).json({ error: 'Error en base de datos al registrar podólogo' });
  }
};

const cambiarEstadoPodologo = async (req, res) => {
  const { cedula } = req.params;
  const { activo, motivo } = req.body;

  try {
    const store = leerAdminStore();
    if (!store.podologos_meta) store.podologos_meta = {};

    const metaActual = store.podologos_meta[cedula] || { activo: true };
    const nuevoEstado = typeof activo === 'boolean' ? activo : !metaActual.activo;

    store.podologos_meta[cedula] = {
      ...metaActual,
      activo: nuevoEstado,
      fecha_modificacion: new Date().toISOString().split('T')[0],
      motivo_baja: nuevoEstado ? null : (motivo || 'Baja temporal administrativa')
    };

    guardarAdminStore(store);

    res.json({
      mensaje: nuevoEstado ? 'Podólogo reactivado exitosamente' : 'Podólogo dado de baja temporal',
      cedula,
      activo: nuevoEstado,
      motivo: store.podologos_meta[cedula].motivo_baja
    });
  } catch (error) {
    console.error('Error al cambiar estado de podólogo:', error);
    res.status(500).json({ error: 'Error al cambiar el estado del podólogo' });
  }
};

const actualizarPodologoAdmin = async (req, res) => {
  const { cedula } = req.params;
  const { Nombre, ape_paterno, ape_materno, Telefono_pod, Email, turno } = req.body;

  try {
    await db.pool.query(
      `UPDATE Podologos 
       SET Nombre = COALESCE(?, Nombre),
           ape_paterno = COALESCE(?, ape_paterno),
           ape_materno = ?,
           Telefono_pod = COALESCE(?, Telefono_pod),
           Email = COALESCE(?, Email),
           turno = COALESCE(?, turno)
       WHERE Cedula_podologo = ?`,
      [Nombre, ape_paterno, ape_materno || null, Telefono_pod, Email, turno, cedula]
    );

    res.json({ mensaje: 'Datos del podólogo actualizados exitosamente' });
  } catch (error) {
    console.error('Error al actualizar podólogo:', error);
    res.status(500).json({ error: 'Error al actualizar datos del podólogo' });
  }
};

// --------------------------------------------------------------------------
// 3. GESTIÓN DE RECEPCIONISTAS (LISTAR, CREAR, BAJA/REACTIVAR, EDITAR)
// --------------------------------------------------------------------------
const obtenerRecepcionistasAdmin = async (req, res) => {
  try {
    const store = leerAdminStore();
    res.json(store.recepcionistas || []);
  } catch (error) {
    console.error('Error al obtener recepcionistas:', error);
    res.status(500).json({ error: 'Error al obtener la lista de recepcionistas' });
  }
};

const crearRecepcionistaAdmin = async (req, res) => {
  const { nombre, ape_paterno, ape_materno, email, telefono, fk_clinica_id, turno, clinica_nombre } = req.body;

  if (!nombre || !ape_paterno || !email) {
    return res.status(400).json({ error: 'Nombre, apellido paterno y correo son obligatorios' });
  }

  try {
    const store = leerAdminStore();
    const receps = store.recepcionistas || [];

    const nuevoId = receps.length > 0 ? Math.max(...receps.map((r) => r.id || 0)) + 1 : 1;

    const nuevaRecep = {
      id: nuevoId,
      nombre: nombre.trim(),
      ape_paterno: ape_paterno.trim(),
      ape_materno: (ape_materno || '').trim(),
      email: email.trim().toLowerCase(),
      telefono: (telefono || '').trim(),
      fk_clinica_id: parseInt(fk_clinica_id, 10) || 14,
      clinica_nombre: clinica_nombre || 'DIF Lomas de Tecámac',
      turno: turno || 'Matutino (8:00 - 15:00)',
      activo: true,
      fecha_alta: new Date().toISOString().split('T')[0]
    };

    receps.push(nuevaRecep);
    store.recepcionistas = receps;
    guardarAdminStore(store);

    res.status(201).json({
      mensaje: 'Recepcionista registrada exitosamente',
      recepcionista: nuevaRecep
    });
  } catch (error) {
    console.error('Error al registrar recepcionista:', error);
    res.status(500).json({ error: 'Error al guardar recepcionista' });
  }
};

const cambiarEstadoRecepcionista = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { activo, motivo } = req.body;

  try {
    const store = leerAdminStore();
    const receps = store.recepcionistas || [];
    const index = receps.findIndex((r) => r.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Recepcionista no encontrada' });
    }

    const nuevoEstado = typeof activo === 'boolean' ? activo : !receps[index].activo;
    receps[index].activo = nuevoEstado;
    if (!nuevoEstado) {
      receps[index].motivo_baja = motivo || 'Baja temporal administrativa';
    } else {
      delete receps[index].motivo_baja;
    }

    store.recepcionistas = receps;
    guardarAdminStore(store);

    res.json({
      mensaje: nuevoEstado ? 'Recepcionista reactivada exitosamente' : 'Recepcionista dada de baja temporal',
      recepcionista: receps[index]
    });
  } catch (error) {
    console.error('Error al cambiar estado de recepcionista:', error);
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
};

const actualizarRecepcionistaAdmin = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { nombre, ape_paterno, ape_materno, email, telefono, fk_clinica_id, turno, clinica_nombre } = req.body;

  try {
    const store = leerAdminStore();
    const receps = store.recepcionistas || [];
    const index = receps.findIndex((r) => r.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Recepcionista no encontrada' });
    }

    receps[index] = {
      ...receps[index],
      nombre: nombre ? nombre.trim() : receps[index].nombre,
      ape_paterno: ape_paterno ? ape_paterno.trim() : receps[index].ape_paterno,
      ape_materno: ape_materno !== undefined ? ape_materno.trim() : receps[index].ape_materno,
      email: email ? email.trim().toLowerCase() : receps[index].email,
      telefono: telefono !== undefined ? telefono.trim() : receps[index].telefono,
      fk_clinica_id: fk_clinica_id ? parseInt(fk_clinica_id, 10) : receps[index].fk_clinica_id,
      turno: turno || receps[index].turno,
      clinica_nombre: clinica_nombre || receps[index].clinica_nombre
    };

    store.recepcionistas = receps;
    guardarAdminStore(store);

    res.json({ mensaje: 'Datos de recepcionista actualizados exitosamente', recepcionista: receps[index] });
  } catch (error) {
    console.error('Error al actualizar recepcionista:', error);
    res.status(500).json({ error: 'Error al actualizar recepcionista' });
  }
};

// --------------------------------------------------------------------------
// 4. GESTIÓN Y MODIFICACIÓN DE PACIENTES / CLIENTES
// --------------------------------------------------------------------------
const obtenerPacientesAdmin = async (req, res) => {
  const { q, condicion } = req.query;

  try {
    let sql = `
      SELECT p.*,
             TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS nombre_completo,
             p.No_expediente AS expediente,
             p.Notas AS notas_alergias,
             CASE 
               WHEN p.Fecha_nacimiento IS NOT NULL THEN TIMESTAMPDIFF(YEAR, p.Fecha_nacimiento, CURDATE())
               ELSE NULL 
             END AS edad,
             (SELECT COUNT(*) FROM Consultas c WHERE c.fk_no_expediente = p.No_expediente) AS total_consultas,
             (SELECT MAX(c.fecha_hora) FROM Consultas c WHERE c.fk_no_expediente = p.No_expediente) AS ultima_cita
      FROM Pacientes p
      WHERE 1=1
    `;
    const params = [];

    if (q) {
      sql += ` AND (p.No_expediente LIKE ? OR p.Nombres LIKE ? OR p.ape_paterno LIKE ? OR p.telefono LIKE ? OR p.Notas LIKE ?)`;
      const term = `%${q}%`;
      params.push(term, term, term, term, term);
    }

    if (condicion === 'diabetico') {
      sql += ` AND p.es_diabetico = 1`;
    } else if (condicion === 'hipertenso') {
      sql += ` AND p.es_hipertenso = 1`;
    }

    sql += ` ORDER BY p.Fecha_registro DESC, p.No_expediente DESC`;

    const [rows] = await db.pool.query(sql, params);

    // DEDUPLICACIÓN INTELIGENTE: Asegurar que los pacientes no se repitan por nombre
    const mapPacientesUnicos = new Map();
    rows.forEach((p) => {
      const nombreNorm = (p.Nombres || '').toLowerCase().trim();
      const paternoNorm = (p.ape_paterno || '').toLowerCase().trim();
      const maternoNorm = (p.ape_materno || '').toLowerCase().trim();
      const telNorm = (p.telefono || '').replace(/\D/g, '');
      const clave = `${nombreNorm}|${paternoNorm}|${maternoNorm}|${telNorm}`;

      // Si no existe, conservarlo
      if (!mapPacientesUnicos.has(clave)) {
        mapPacientesUnicos.set(clave, p);
      }
    });

    const listaUnica = Array.from(mapPacientesUnicos.values());
    res.json(listaUnica);
  } catch (error) {
    console.error('Error al listar pacientes admin:', error);
    res.status(500).json({ error: 'Error al consultar catálogo de pacientes' });
  }
};

const actualizarPacienteAdmin = async (req, res) => {
  const { no_expediente } = req.params;
  const {
    Nombres,
    ape_paterno,
    ape_materno,
    telefono,
    Fecha_nacimiento,
    Sexo,
    Calzado,
    Calle_direccion,
    Municipio,
    Ocupacion,
    es_diabetico,
    es_hipertenso,
    Antecedentes_patologicos,
    Notas
  } = req.body;

  try {
    await db.pool.query(
      `UPDATE Pacientes
       SET Nombres = COALESCE(?, Nombres),
           ape_paterno = COALESCE(?, ape_paterno),
           ape_materno = ?,
           telefono = COALESCE(?, telefono),
           Fecha_nacimiento = ?,
           Sexo = COALESCE(?, Sexo),
           Calzado = ?,
           Calle_direccion = ?,
           Municipio = ?,
           Ocupacion = ?,
           es_diabetico = ?,
           es_hipertenso = ?,
           Antecedentes_patologicos = ?,
           Notas = ?
       WHERE No_expediente = ?`,
      [
        Nombres,
        ape_paterno,
        ape_materno || null,
        telefono,
        Fecha_nacimiento || null,
        Sexo,
        Calzado ? parseFloat(Calzado) : null,
        Calle_direccion || null,
        Municipio || null,
        Ocupacion || null,
        es_diabetico ? 1 : 0,
        es_hipertenso ? 1 : 0,
        Antecedentes_patologicos || null,
        Notas || null,
        no_expediente
      ]
    );

    res.json({ mensaje: 'Expediente del paciente actualizado correctamente', no_expediente });
  } catch (error) {
    console.error('Error al actualizar paciente admin:', error);
    res.status(500).json({ error: 'Error al actualizar expediente del paciente' });
  }
};

// --------------------------------------------------------------------------
// 5. GESTIÓN DE ANUNCIOS Y COMUNICADOS EN LA PÁGINA WEB DE LA CLÍNICA
// --------------------------------------------------------------------------
const enviarAvisoPaciente = async (req, res) => {
  const { titulo, asunto, mensaje, tipo, ubicacion, cta_texto, cta_enlace, sec_texto, sec_enlace, activo, no_expediente, paciente_nombre } = req.body;

  const textoMensaje = mensaje || req.body.texto || '';
  const tituloAnuncio = titulo || asunto || 'Comunicado Oficial de la Clínica';

  if (!textoMensaje && !tituloAnuncio) {
    return res.status(400).json({ error: 'El título y el contenido del anuncio son obligatorios' });
  }

  try {
    const store = leerAdminStore();
    const avisos = store.avisos || [];

    const tipoLabels = {
      promocion: 'Promoción / Campaña Web',
      horario_especial: 'Horario Especial / Festivo',
      aviso_importante: 'Aviso Importante',
      novedad: 'Novedad de Sede / Tratamiento',
      mantenimiento: 'Mantenimiento / Servicio',
      general: 'Aviso General'
    };

    const ubicacionLabels = {
      barra_superior: 'Barra Superior (Cintillo)',
      hero_banner: 'Banner Principal (Inicio)',
      modal_emergente: 'Ventana Emergente (Popup)',
      modulo_citas: 'Módulo de Agendamiento'
    };

    const nuevoAviso = {
      id: `anuncio-${Date.now()}`,
      titulo: tituloAnuncio,
      asunto: tituloAnuncio,
      mensaje: textoMensaje,
      tipo: tipo || 'aviso_importante',
      tipo_label: tipoLabels[tipo] || 'Anuncio Web',
      ubicacion: ubicacion || 'hero_banner',
      ubicacion_label: ubicacionLabels[ubicacion] || 'Banner Principal (Inicio)',
      cta_texto: cta_texto !== undefined ? cta_texto : 'Agendar Cita',
      cta_enlace: cta_enlace || '#agendar',
      sec_texto: sec_texto !== undefined ? sec_texto : 'Ver Servicios',
      sec_enlace: sec_enlace || '#servicios',
      activo: activo !== false,
      fecha_envio: new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }),
      fecha_creacion: new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }),
      publicado_por: req.user?.nombre_completo || 'Administrador General'
    };

    avisos.unshift(nuevoAviso);
    store.avisos = avisos;
    guardarAdminStore(store);

    res.status(201).json({
      mensaje: 'Anuncio registrado y publicado exitosamente en la página web',
      aviso: nuevoAviso
    });
  } catch (error) {
    console.error('Error al registrar anuncio web:', error);
    res.status(500).json({ error: 'Error al registrar anuncio para la web' });
  }
};

const toggleEstadoAviso = async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;
  try {
    const store = leerAdminStore();
    const avisos = store.avisos || [];
    const index = avisos.findIndex((a) => a.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Anuncio no encontrado' });
    }
    avisos[index].activo = activo !== undefined ? activo : !avisos[index].activo;
    store.avisos = avisos;
    guardarAdminStore(store);
    res.json({
      mensaje: `Anuncio ${avisos[index].activo ? 'activado' : 'pausado'} en la página web`,
      aviso: avisos[index]
    });
  } catch (error) {
    console.error('Error al actualizar estado del anuncio:', error);
    res.status(500).json({ error: 'Error al cambiar estado del anuncio' });
  }
};

const eliminarAviso = async (req, res) => {
  const { id } = req.params;
  try {
    const store = leerAdminStore();
    let avisos = store.avisos || [];
    const longitudInicial = avisos.length;
    avisos = avisos.filter((a) => a.id !== id);
    if (avisos.length === longitudInicial) {
      return res.status(404).json({ error: 'Anuncio no encontrado' });
    }
    store.avisos = avisos;
    guardarAdminStore(store);
    res.json({ mensaje: 'Anuncio eliminado de la página web exitosamente' });
  } catch (error) {
    console.error('Error al eliminar anuncio:', error);
    res.status(500).json({ error: 'Error al eliminar anuncio' });
  }
};

const obtenerHistorialAvisos = async (req, res) => {
  try {
    const store = leerAdminStore();
    res.json(store.avisos || []);
  } catch (error) {
    console.error('Error al obtener historial de avisos:', error);
    res.status(500).json({ error: 'Error al consultar historial de avisos' });
  }
};

// --------------------------------------------------------------------------
// 6. GESTIÓN DE CLÍNICAS / SEDES (LISTAR, ALTA, BAJA/REACTIVAR, EDITAR)
// --------------------------------------------------------------------------
const obtenerClinicasAdmin = async (req, res) => {
  try {
    const [rows] = await db.pool.query(
      `SELECT Clinica_id, Nombre, Calle_clinica, Municipio_clinica, Telefono, 
              COALESCE(Activa, 1) AS Activa
       FROM Clinicas 
       ORDER BY Clinica_id ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al listar clínicas admin:', error);
    res.status(500).json({ error: 'Error al consultar catálogo de clínicas' });
  }
};

const crearClinicaAdmin = async (req, res) => {
  const { Nombre, Calle_clinica, Municipio_clinica, Telefono } = req.body;

  if (!Nombre || !Nombre.trim()) {
    return res.status(400).json({ error: 'El nombre de la clínica o sede es obligatorio' });
  }

  try {
    const [result] = await db.pool.query(
      `INSERT INTO Clinicas (Nombre, Calle_clinica, Municipio_clinica, Telefono, Activa)
       VALUES (?, ?, ?, ?, 1)`,
      [
        Nombre.trim(),
        Calle_clinica ? Calle_clinica.trim() : null,
        Municipio_clinica ? Municipio_clinica.trim() : 'Tecámac',
        Telefono ? Telefono.trim() : null
      ]
    );

    res.status(201).json({
      mensaje: 'Clínica dada de alta exitosamente',
      clinica: {
        Clinica_id: result.insertId,
        Nombre: Nombre.trim(),
        Calle_clinica: Calle_clinica || '',
        Municipio_clinica: Municipio_clinica || 'Tecámac',
        Telefono: Telefono || '',
        Activa: 1
      }
    });
  } catch (error) {
    console.error('Error al dar de alta clínica:', error);
    res.status(500).json({ error: 'Error al registrar la clínica en base de datos' });
  }
};

const cambiarEstadoClinica = async (req, res) => {
  const { id } = req.params;
  const { activa } = req.body;

  try {
    const [actuales] = await db.pool.query('SELECT Clinica_id, Nombre, Activa FROM Clinicas WHERE Clinica_id = ?', [id]);
    if (!actuales || actuales.length === 0) {
      return res.status(404).json({ error: 'Clínica no encontrada' });
    }

    const actual = actuales[0];
    const nuevoEstado = typeof activa === 'boolean' ? (activa ? 1 : 0) : (actual.Activa === 1 ? 0 : 1);

    await db.pool.query('UPDATE Clinicas SET Activa = ? WHERE Clinica_id = ?', [nuevoEstado, id]);

    res.json({
      mensaje: nuevoEstado === 1 ? 'Sede clínica reactivada exitosamente' : 'Sede clínica dada de baja temporal',
      Clinica_id: Number(id),
      Activa: nuevoEstado
    });
  } catch (error) {
    console.error('Error al cambiar estado de clínica:', error);
    res.status(500).json({ error: 'Error al cambiar estado de la sede' });
  }
};

const actualizarClinicaAdmin = async (req, res) => {
  const { id } = req.params;
  const { Nombre, Calle_clinica, Municipio_clinica, Telefono } = req.body;

  if (!Nombre || !Nombre.trim()) {
    return res.status(400).json({ error: 'El nombre de la clínica es obligatorio' });
  }

  try {
    await db.pool.query(
      `UPDATE Clinicas 
       SET Nombre = ?,
           Calle_clinica = ?,
           Municipio_clinica = ?,
           Telefono = ?
       WHERE Clinica_id = ?`,
      [
        Nombre.trim(),
        Calle_clinica ? Calle_clinica.trim() : null,
        Municipio_clinica ? Municipio_clinica.trim() : 'Tecámac',
        Telefono ? Telefono.trim() : null,
        id
      ]
    );

    res.json({ mensaje: 'Datos de la sede clínica actualizados exitosamente', Clinica_id: Number(id) });
  } catch (error) {
    console.error('Error al actualizar clínica:', error);
    res.status(500).json({ error: 'Error al actualizar datos de la clínica' });
  }
};

module.exports = {
  obtenerMetricas,
  obtenerPodologosAdmin,
  crearPodologoAdmin,
  cambiarEstadoPodologo,
  actualizarPodologoAdmin,
  obtenerRecepcionistasAdmin,
  crearRecepcionistaAdmin,
  cambiarEstadoRecepcionista,
  actualizarRecepcionistaAdmin,
  obtenerPacientesAdmin,
  actualizarPacienteAdmin,
  enviarAvisoPaciente,
  obtenerHistorialAvisos,
  toggleEstadoAviso,
  eliminarAviso,
  obtenerClinicasAdmin,
  crearClinicaAdmin,
  cambiarEstadoClinica,
  actualizarClinicaAdmin
};
