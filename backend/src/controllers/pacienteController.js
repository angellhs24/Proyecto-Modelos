const db = require('../config/db');

// Función auxiliar para separar un nombre completo en Nombres, ape_paterno, ape_materno
function parseNombreCompleto(nombreCompleto = '') {
  const parts = nombreCompleto.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') {
    return { nombres: 'Sin Nombre', apePaterno: 'Sin Apellido', apeMaterno: null };
  }
  if (parts.length === 1) {
    return { nombres: parts[0], apePaterno: 'Sin Apellido', apeMaterno: null };
  }
  if (parts.length === 2) {
    return { nombres: parts[0], apePaterno: parts[1], apeMaterno: null };
  }
  if (parts.length === 3) {
    return { nombres: parts[0], apePaterno: parts[1], apeMaterno: parts[2] };
  }
  // 4 o más palabras: ej. "Maria del Carmen Garcia Perez" o "Juan Carlos Hernandez Gomez"
  const apeMaterno = parts[parts.length - 1];
  const apePaterno = parts[parts.length - 2];
  const nombres = parts.slice(0, parts.length - 2).join(' ');
  return { nombres, apePaterno, apeMaterno };
}

// Generador de número de expediente automático si no se especifica
async function generarNoExpediente(clinicaId = 14) {
  const anio = new Date().getFullYear();
  const clinicaStr = String(clinicaId).padStart(2, '0').slice(-2);
  const prefijo = `${anio}${clinicaStr}`;

  try {
    const res = await db.query(
      `SELECT MAX(No_expediente) AS max_exp FROM Pacientes WHERE CAST(No_expediente AS CHAR) LIKE ?`,
      [`${prefijo}%`]
    );

    const maxExp = res.rows[0]?.max_exp;
    if (maxExp) {
      const consecutivo = parseInt(String(maxExp).slice(-4), 10) + 1;
      return `${prefijo}${String(consecutivo).padStart(4, '0')}`;
    }
    return `${prefijo}0001`;
  } catch {
    return `${anio}${clinicaStr}${Math.floor(1000 + Math.random() * 9000)}`;
  }
}

// Obtener lista de pacientes con búsqueda opcional
const obtenerPacientes = async (req, res) => {
  const { q } = req.query;

  try {
    let sql = `
      SELECT p.*,
             TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS nombre_completo,
             p.No_expediente AS expediente,
             p.No_expediente AS id_paciente,
             p.Notas AS notas_alergias,
             CASE 
               WHEN p.Fecha_nacimiento IS NOT NULL THEN TIMESTAMPDIFF(YEAR, p.Fecha_nacimiento, CURDATE())
               ELSE NULL 
             END AS edad,
             (SELECT MAX(c.fecha_hora) FROM Consultas c WHERE c.fk_no_expediente = p.No_expediente) AS ultima_cita
      FROM Pacientes p
    `;
    const params = [];

    if (q) {
      sql += `
        WHERE p.No_expediente LIKE ?
           OR p.Nombres LIKE ?
           OR p.ape_paterno LIKE ?
           OR p.ape_materno LIKE ?
           OR p.telefono LIKE ?
           OR p.Notas LIKE ?
      `;
      const term = `%${q}%`;
      params.push(term, term, term, term, term, term);
    }

    sql += ` ORDER BY p.Fecha_registro DESC, p.No_expediente DESC`;

    const resultado = await db.query(sql, params);
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener pacientes:', error);
    res.status(500).json({ error: 'Error al obtener los pacientes' });
  }
};

// Obtener un paciente específico por No_expediente con su historial de consultas
const obtenerPacientePorExpediente = async (req, res) => {
  const { no_expediente } = req.params;

  try {
    const pacienteRes = await db.query(
      `SELECT p.*,
              TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS nombre_completo,
              p.No_expediente AS expediente,
              p.No_expediente AS id_paciente,
              p.Notas AS notas_alergias,
              CASE 
                WHEN p.Fecha_nacimiento IS NOT NULL THEN TIMESTAMPDIFF(YEAR, p.Fecha_nacimiento, CURDATE())
                ELSE NULL 
              END AS edad
       FROM Pacientes p
       WHERE p.No_expediente = ?`,
      [no_expediente]
    );

    if (pacienteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const paciente = pacienteRes.rows[0];

    // Consultas del paciente
    const consultasRes = await db.query(
      `SELECT c.*, cl.Nombre AS clinica_nombre, 
              TRIM(CONCAT(pod.Nombre, ' ', pod.ape_paterno, ' ', COALESCE(pod.ape_materno, ''))) AS podologo_nombre
       FROM Consultas c
       LEFT JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
       LEFT JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
       WHERE c.fk_no_expediente = ?
       ORDER BY c.fecha_hora DESC`,
      [no_expediente]
    );

    paciente.consultas = consultasRes.rows;
    res.json(paciente);
  } catch (error) {
    console.error('Error al obtener detalle del paciente:', error);
    res.status(500).json({ error: 'Error al consultar el expediente' });
  }
};

// Crear paciente
const crearPaciente = async (req, res) => {
  try {
    let {
      No_expediente,
      Nombres,
      ape_paterno,
      ape_materno,
      nombre_completo,
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
      Notas,
      notas_alergias,
      Fecha_registro,
      clinica_id
    } = req.body;

    // Si viene nombre_completo y no vienen Nombres/ape_paterno separados
    if ((!Nombres || !ape_paterno) && nombre_completo) {
      const parsed = parseNombreCompleto(nombre_completo);
      Nombres = Nombres || parsed.nombres;
      ape_paterno = ape_paterno || parsed.apePaterno;
      ape_materno = ape_materno || parsed.apeMaterno;
    }

    if (!Nombres || !ape_paterno) {
      return res.status(400).json({ error: 'Nombre y apellido paterno son requeridos' });
    }

    if (!No_expediente) {
      No_expediente = await generarNoExpediente(clinica_id || 14);
    }

    const fechaRegFinal = Fecha_registro || new Date().toISOString().split('T')[0];
    const notasFinal = Notas || notas_alergias || null;
    const sexoFinal = Sexo ? Sexo[0].toUpperCase() : 'F';

    await db.query(
      `INSERT INTO Pacientes (
        No_expediente, Nombres, ape_paterno, ape_materno, telefono,
        Fecha_nacimiento, Sexo, Calzado, Calle_direccion, Municipio,
        Ocupacion, es_diabetico, es_hipertenso, Antecedentes_patologicos,
        Notas, Fecha_registro
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        No_expediente,
        Nombres,
        ape_paterno,
        ape_materno || null,
        telefono || null,
        Fecha_nacimiento || null,
        sexoFinal,
        Calzado || null,
        Calle_direccion || null,
        Municipio || null,
        Ocupacion || null,
        es_diabetico ? 1 : 0,
        es_hipertenso ? 1 : 0,
        Antecedentes_patologicos || null,
        notasFinal,
        fechaRegFinal
      ]
    );

    const pacienteCreado = {
      No_expediente,
      expediente: No_expediente,
      id_paciente: No_expediente,
      Nombres,
      ape_paterno,
      ape_materno,
      nombre_completo: `${Nombres} ${ape_paterno} ${ape_materno || ''}`.trim(),
      telefono,
      Fecha_nacimiento,
      Sexo: sexoFinal,
      Calzado,
      Calle_direccion,
      Municipio,
      Ocupacion,
      es_diabetico: !!es_diabetico,
      es_hipertenso: !!es_hipertenso,
      Antecedentes_patologicos,
      Notas: notasFinal,
      notas_alergias: notasFinal,
      Fecha_registro: fechaRegFinal
    };

    res.status(201).json({
      mensaje: 'Paciente registrado exitosamente',
      paciente: pacienteCreado
    });
  } catch (error) {
    console.error('Error al registrar paciente:', error);
    res.status(500).json({ error: 'Error al registrar el paciente' });
  }
};

// Buscar o registrar paciente exprés (usado en el modal/formulario de agendamiento)
const buscarOCrearPaciente = async (req, res) => {
  const {
    No_expediente,
    nombre_completo,
    Nombres,
    ape_paterno,
    ape_materno,
    telefono,
    es_diabetico,
    es_hipertenso,
    notas_alergias,
    Notas,
    edad,
    sexo,
    clinica_id
  } = req.body;

  try {
    // 1. Buscar EXCLUSIVAMENTE por No_expediente (el teléfono no se usa para búsqueda para evitar mezclar familiares)
    if (No_expediente) {
      const existe = await db.query(
        `SELECT p.*,
                TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS nombre_completo,
                p.No_expediente AS expediente,
                p.No_expediente AS id_paciente,
                p.Notas AS notas_alergias,
                CASE 
                  WHEN p.Fecha_nacimiento IS NOT NULL THEN TIMESTAMPDIFF(YEAR, p.Fecha_nacimiento, CURDATE())
                  ELSE NULL 
                END AS edad
         FROM Pacientes p 
         WHERE p.No_expediente = ?
         LIMIT 1`,
        [No_expediente]
      );

      if (existe.rows.length > 0) {
        return res.json({
          mensaje: 'Paciente existente encontrado',
          paciente: existe.rows[0]
        });
      }
    }

    // 2. Si no existe, crear uno nuevo con su propio expediente único
    let nom = Nombres;
    let apeP = ape_paterno;
    let apeM = ape_materno;

    if ((!nom || !apeP) && nombre_completo) {
      const parsed = parseNombreCompleto(nombre_completo);
      nom = parsed.nombres;
      apeP = parsed.apePaterno;
      apeM = parsed.apeMaterno;
    }

    const expGenerado = No_expediente || (await generarNoExpediente(clinica_id || 14));
    const fechaRegistro = new Date().toISOString().split('T')[0];
    const rawSexo = sexo || req.body.Sexo || null;
    const sexoChar = rawSexo ? (String(rawSexo).trim().toUpperCase().startsWith('M') ? 'M' : (String(rawSexo).trim().toUpperCase().startsWith('F') ? 'F' : 'O')) : 'F';
    const notasVal = Notas || notas_alergias || null;
    const fechaNacVal = req.body.Fecha_nacimiento || req.body.fecha_nacimiento || null;
    const calleVal = req.body.Calle_direccion || req.body.calle_direccion || null;
    const munVal = req.body.Municipio || req.body.municipio || null;

    await db.query(
      `INSERT INTO Pacientes (
        No_expediente, Nombres, ape_paterno, ape_materno, telefono,
        Fecha_nacimiento, Sexo, Calle_direccion, Municipio,
        es_diabetico, es_hipertenso, Notas, Fecha_registro
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        expGenerado,
        nom || 'Paciente',
        apeP || 'Sin Apellido',
        apeM || null,
        telefono || null,
        fechaNacVal,
        sexoChar,
        calleVal,
        munVal,
        es_diabetico ? 1 : 0,
        es_hipertenso ? 1 : 0,
        notasVal,
        fechaRegistro
      ]
    );

    const nuevoPaciente = {
      No_expediente: expGenerado,
      expediente: expGenerado,
      id_paciente: expGenerado,
      Nombres: nom,
      ape_paterno: apeP,
      ape_materno: apeM,
      nombre_completo: `${nom} ${apeP} ${apeM || ''}`.trim(),
      telefono,
      Fecha_nacimiento: fechaNacVal,
      Sexo: sexoChar,
      Calle_direccion: calleVal,
      Municipio: munVal,
      es_diabetico: !!es_diabetico,
      es_hipertenso: !!es_hipertenso,
      Notas: notasVal,
      notas_alergias: notasVal,
      Fecha_registro: fechaRegistro
    };

    res.status(201).json({
      mensaje: 'Paciente nuevo registrado con éxito',
      paciente: nuevoPaciente
    });
  } catch (error) {
    console.error('Error al procesar paciente:', error);
    res.status(500).json({ error: 'Error al procesar el paciente' });
  }
};

// Actualizar información de paciente
const actualizarPaciente = async (req, res) => {
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
    await db.query(
      `UPDATE Pacientes SET
        Nombres = COALESCE(?, Nombres),
        ape_paterno = COALESCE(?, ape_paterno),
        ape_materno = COALESCE(?, ape_materno),
        telefono = COALESCE(?, telefono),
        Fecha_nacimiento = COALESCE(?, Fecha_nacimiento),
        Sexo = COALESCE(?, Sexo),
        Calzado = COALESCE(?, Calzado),
        Calle_direccion = COALESCE(?, Calle_direccion),
        Municipio = COALESCE(?, Municipio),
        Ocupacion = COALESCE(?, Ocupacion),
        es_diabetico = COALESCE(?, es_diabetico),
        es_hipertenso = COALESCE(?, es_hipertenso),
        Antecedentes_patologicos = COALESCE(?, Antecedentes_patologicos),
        Notas = COALESCE(?, Notas)
       WHERE No_expediente = ?`,
      [
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
        es_diabetico !== undefined ? (es_diabetico ? 1 : 0) : null,
        es_hipertenso !== undefined ? (es_hipertenso ? 1 : 0) : null,
        Antecedentes_patologicos,
        Notas,
        no_expediente
      ]
    );

    res.json({ mensaje: 'Paciente actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar paciente:', error);
    res.status(500).json({ error: 'Error al actualizar paciente' });
  }
};

// Eliminar paciente
const eliminarPaciente = async (req, res) => {
  const { no_expediente } = req.params;
  try {
    await db.query('DELETE FROM Pacientes WHERE No_expediente = ?', [no_expediente]);
    res.json({ mensaje: 'Paciente eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar paciente:', error);
    res.status(500).json({ error: 'No se puede eliminar el paciente porque tiene consultas asociadas' });
  }
};

module.exports = {
  obtenerPacientes,
  obtenerPacientePorExpediente,
  crearPaciente,
  buscarOCrearPaciente,
  actualizarPaciente,
  eliminarPaciente
};