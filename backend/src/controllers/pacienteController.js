const db = require('../config/db');
const { parseNombreCompleto } = require('../utils/nameParser');

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

// Normalizador universal de entidad Paciente para retrocompatibilidad total (snake_case, PascalCase, camelCase)
function formatearPaciente(p) {
  if (!p) return p;

  const rawFechaNac = p.fecha_nacimiento || p.Fecha_nacimiento || p.fechaNacimiento || null;
  let fechaNacFormatted = null;
  if (rawFechaNac) {
    if (rawFechaNac instanceof Date) {
      const y = rawFechaNac.getFullYear();
      const m = String(rawFechaNac.getMonth() + 1).padStart(2, '0');
      const d = String(rawFechaNac.getDate()).padStart(2, '0');
      fechaNacFormatted = `${y}-${m}-${d}`;
    } else {
      const s = String(rawFechaNac).trim();
      if (s.includes('T')) {
        fechaNacFormatted = s.split('T')[0].trim();
      } else if (s.includes('/')) {
        const parts = s.split('/');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            fechaNacFormatted = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          } else if (parts[2].length === 4) {
            fechaNacFormatted = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
      } else {
        fechaNacFormatted = s.slice(0, 10);
      }
    }
  }

  const calleDir = p.calle_direccion || p.Calle_direccion || p.direccion || p.calle || p.domicilio || null;
  const mun = p.Municipio || p.municipio || p.ciudad || p.Ciudad || p.alcaldia || p.Alcaldia || 'Tecámac';

  function parseBooleanLike(val) {
    if (val === null || val === undefined) return false;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val === 1;
    if (typeof val === 'string') {
      const str = val.trim().toLowerCase();
      return str === '1' || str === 'true' || str === 'si' || str === 's' || str === 't';
    }
    if (Buffer.isBuffer(val)) {
      return val.length > 0 && val[0] === 1;
    }
    if (typeof val === 'object' && val.type === 'Buffer' && Array.isArray(val.data)) {
      return val.data.length > 0 && val.data[0] === 1;
    }
    return Boolean(val);
  }

  const rawDiab = p.es_diabetico !== undefined ? p.es_diabetico : (p.Es_diabetico !== undefined ? p.Es_diabetico : (p.esDiabetico !== undefined ? p.esDiabetico : p.diabetico));
  const rawHiper = p.es_hipertenso !== undefined ? p.es_hipertenso : (p.Es_hipertenso !== undefined ? p.Es_hipertenso : (p.esHipertenso !== undefined ? p.esHipertenso : p.hipertenso));

  const isDiab = parseBooleanLike(rawDiab);
  const isHiper = parseBooleanLike(rawHiper);

  const calz = p.calzado !== undefined ? p.calzado : (p.Calzado !== undefined ? p.Calzado : null);
  const ocup = p.ocupacion || p.Ocupacion || null;
  const exp = p.No_expediente || p.expediente || p.id_paciente;
  const nomCompleto = p.nombre_completo || `${p.Nombres || p.nombres || ''} ${p.ape_paterno || p.apePaterno || ''} ${p.ape_materno || p.apeMaterno || ''}`.trim();

  return {
    ...p,
    No_expediente: exp,
    expediente: exp,
    id_paciente: exp,
    nombre_completo: nomCompleto,
    fecha_nacimiento: fechaNacFormatted,
    Fecha_nacimiento: fechaNacFormatted,
    calle_direccion: calleDir,
    Calle_direccion: calleDir,
    direccion: calleDir,
    calle: calleDir,
    Municipio: mun,
    municipio: mun,
    calzado: calz,
    Calzado: calz,
    ocupacion: ocup,
    Ocupacion: ocup,
    es_diabetico: isDiab ? 1 : 0,
    Es_diabetico: isDiab ? 1 : 0,
    esDiabetico: isDiab,
    es_hipertenso: isHiper ? 1 : 0,
    Es_hipertenso: isHiper ? 1 : 0,
    esHipertenso: isHiper
  };
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
    res.json(resultado.rows.map(formatearPaciente));
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

    const paciente = formatearPaciente(pacienteRes.rows[0]);

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
      Fecha_registro,
      clinica_id
    } = req.body;

    // Normalización de entradas para admitir tanto snake_case como PascalCase
    Nombres = Nombres || req.body.nombres;
    ape_paterno = ape_paterno || req.body.apePaterno || req.body.apellidos;
    ape_materno = ape_materno !== undefined ? ape_materno : req.body.apeMaterno;
    nombre_completo = nombre_completo || req.body.paciente_nombre || req.body.nombre;

    const fechaNacFinal = req.body.Fecha_nacimiento || req.body.fecha_nacimiento || req.body.fechaNacimiento || null;
    const calleFinal = req.body.Calle_direccion || req.body.calle_direccion || req.body.direccion || req.body.calle || null;
    const munFinal = req.body.Municipio || req.body.municipio || req.body.ciudad || req.body.Ciudad || 'Tecámac';
    const calzadoFinal = req.body.Calzado !== undefined ? req.body.Calzado : req.body.calzado;
    const ocupacionFinal = req.body.Ocupacion || req.body.ocupacion || null;
    const antPatFinal = req.body.Antecedentes_patologicos || req.body.antecedentes_patologicos || null;
    const notasFinal = req.body.Notas || req.body.notas || req.body.notas_alergias || null;
    const rawSexo = req.body.Sexo || req.body.sexo;
    const sexoFinal = rawSexo ? (String(rawSexo).trim().toUpperCase().startsWith('M') ? 'M' : (String(rawSexo).trim().toUpperCase().startsWith('F') ? 'F' : 'O')) : 'F';

    function parseBooleanLike(val) {
      if (val === null || val === undefined) return false;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'number') return val === 1;
      if (typeof val === 'string') {
        const str = val.trim().toLowerCase();
        return str === '1' || str === 'true' || str === 'si' || str === 's' || str === 't';
      }
      if (Buffer.isBuffer(val)) {
        return val.length > 0 && val[0] === 1;
      }
      if (typeof val === 'object' && val.type === 'Buffer' && Array.isArray(val.data)) {
        return val.data.length > 0 && val.data[0] === 1;
      }
      return Boolean(val);
    }

    const rawDiab = req.body.es_diabetico !== undefined ? req.body.es_diabetico : (req.body.Es_diabetico !== undefined ? req.body.Es_diabetico : (req.body.esDiabetico !== undefined ? req.body.esDiabetico : req.body.diabetico));
    const rawHiper = req.body.es_hipertenso !== undefined ? req.body.es_hipertenso : (req.body.Es_hipertenso !== undefined ? req.body.Es_hipertenso : (req.body.esHipertenso !== undefined ? req.body.esHipertenso : req.body.hipertenso));

    const diabFinal = parseBooleanLike(rawDiab) ? 1 : 0;
    const hiperFinal = parseBooleanLike(rawHiper) ? 1 : 0;

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
        fechaNacFinal,
        sexoFinal,
        calzadoFinal || null,
        calleFinal,
        munFinal,
        ocupacionFinal,
        diabFinal,
        hiperFinal,
        antPatFinal,
        notasFinal,
        fechaRegFinal
      ]
    );

    const pacienteCreado = formatearPaciente({
      No_expediente,
      expediente: No_expediente,
      id_paciente: No_expediente,
      Nombres,
      ape_paterno,
      ape_materno,
      nombre_completo: `${Nombres} ${ape_paterno} ${ape_materno || ''}`.trim(),
      telefono,
      fecha_nacimiento: fechaNacFinal,
      Fecha_nacimiento: fechaNacFinal,
      Sexo: sexoFinal,
      calzado: calzadoFinal,
      Calzado: calzadoFinal,
      calle_direccion: calleFinal,
      Calle_direccion: calleFinal,
      direccion: calleFinal,
      Municipio: munFinal,
      municipio: munFinal,
      ocupacion: ocupacionFinal,
      Ocupacion: ocupacionFinal,
      es_diabetico: diabFinal,
      es_hipertenso: hiperFinal,
      Antecedentes_patologicos: antPatFinal,
      Notas: notasFinal,
      notas_alergias: notasFinal,
      Fecha_registro: fechaRegFinal
    });

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
    clinica_id
  } = req.body;

  try {
    // 1. Buscar EXCLUSIVAMENTE por No_expediente (el teléfono no se usa para búsqueda para evitar mezclar familiares)
    const expABuscar = No_expediente || req.body.expediente;
    if (expABuscar) {
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
        [expABuscar]
      );

      if (existe.rows.length > 0) {
        return res.json({
          mensaje: 'Paciente existente encontrado',
          paciente: formatearPaciente(existe.rows[0])
        });
      }
    }

    // 2. Si no existe, crear uno nuevo con su propio expediente único
    let nom = Nombres || req.body.nombres;
    let apeP = ape_paterno || req.body.apePaterno || req.body.apellidos;
    let apeM = ape_materno !== undefined ? ape_materno : req.body.apeMaterno;
    const nomComp = nombre_completo || req.body.paciente_nombre || req.body.nombre;

    if ((!nom || !apeP) && nomComp) {
      const parsed = parseNombreCompleto(nomComp);
      nom = parsed.nombres;
      apeP = parsed.apePaterno;
      apeM = parsed.apeMaterno;
    }

    const expGenerado = expABuscar || (await generarNoExpediente(clinica_id || 14));
    const fechaRegistro = new Date().toISOString().split('T')[0];
    const rawSexo = req.body.sexo || req.body.Sexo || null;
    const sexoChar = rawSexo ? (String(rawSexo).trim().toUpperCase().startsWith('M') ? 'M' : (String(rawSexo).trim().toUpperCase().startsWith('F') ? 'F' : 'O')) : 'F';
    const notasVal = req.body.Notas || req.body.notas || req.body.notas_alergias || null;
    const fechaNacVal = req.body.Fecha_nacimiento || req.body.fecha_nacimiento || req.body.fechaNacimiento || null;
    const calleVal = req.body.Calle_direccion || req.body.calle_direccion || req.body.direccion || req.body.calle || null;
    const munVal = req.body.Municipio || req.body.municipio || req.body.ciudad || req.body.Ciudad || 'Tecámac';

    function parseBooleanLike(val) {
      if (val === null || val === undefined) return false;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'number') return val === 1;
      if (typeof val === 'string') {
        const str = val.trim().toLowerCase();
        return str === '1' || str === 'true' || str === 'si' || str === 's' || str === 't';
      }
      return Boolean(val);
    }

    const rawDiab = req.body.es_diabetico !== undefined ? req.body.es_diabetico : (req.body.Es_diabetico !== undefined ? req.body.Es_diabetico : req.body.esDiabetico);
    const rawHiper = req.body.es_hipertenso !== undefined ? req.body.es_hipertenso : (req.body.Es_hipertenso !== undefined ? req.body.Es_hipertenso : req.body.esHipertenso);

    const isDiab = parseBooleanLike(rawDiab) ? 1 : 0;
    const isHiper = parseBooleanLike(rawHiper) ? 1 : 0;

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
        isDiab,
        isHiper,
        notasVal,
        fechaRegistro
      ]
    );

    const nuevoPaciente = formatearPaciente({
      No_expediente: expGenerado,
      expediente: expGenerado,
      id_paciente: expGenerado,
      Nombres: nom,
      ape_paterno: apeP,
      ape_materno: apeM,
      nombre_completo: `${nom} ${apeP} ${apeM || ''}`.trim(),
      telefono,
      Fecha_nacimiento: fechaNacVal,
      fecha_nacimiento: fechaNacVal,
      Sexo: sexoChar,
      Calle_direccion: calleVal,
      calle_direccion: calleVal,
      direccion: calleVal,
      Municipio: munVal,
      municipio: munVal,
      es_diabetico: isDiab,
      es_hipertenso: isHiper,
      Notas: notasVal,
      notas_alergias: notasVal,
      Fecha_registro: fechaRegistro
    });

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

  const nombres = req.body.Nombres || req.body.nombres;
  const apePaterno = req.body.ape_paterno || req.body.apePaterno;
  const apeMaterno = req.body.ape_materno !== undefined ? req.body.ape_materno : req.body.apeMaterno;
  const telefono = req.body.telefono;
  const fechaNac = req.body.Fecha_nacimiento || req.body.fecha_nacimiento || req.body.fechaNacimiento;
  const sexo = req.body.Sexo || req.body.sexo;
  const calzado = req.body.Calzado !== undefined ? req.body.Calzado : req.body.calzado;
  const calle = req.body.Calle_direccion !== undefined ? req.body.Calle_direccion : (req.body.calle_direccion !== undefined ? req.body.calle_direccion : req.body.direccion);
  const mun = req.body.Municipio !== undefined ? req.body.Municipio : req.body.municipio;
  const ocupacion = req.body.Ocupacion !== undefined ? req.body.Ocupacion : req.body.ocupacion;
  const antPat = req.body.Antecedentes_patologicos !== undefined ? req.body.Antecedentes_patologicos : req.body.antecedentes_patologicos;
  const notas = req.body.Notas !== undefined ? req.body.Notas : (req.body.notas !== undefined ? req.body.notas : req.body.notas_alergias);

  function parseBooleanLike(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'boolean') return val ? 1 : 0;
    if (typeof val === 'number') return val === 1 ? 1 : 0;
    if (typeof val === 'string') {
      const str = val.trim().toLowerCase();
      return (str === '1' || str === 'true' || str === 'si' || str === 's' || str === 't') ? 1 : 0;
    }
    return Boolean(val) ? 1 : 0;
  }

  const rawDiab = req.body.es_diabetico !== undefined ? req.body.es_diabetico : (req.body.Es_diabetico !== undefined ? req.body.Es_diabetico : req.body.esDiabetico);
  const rawHiper = req.body.es_hipertenso !== undefined ? req.body.es_hipertenso : (req.body.Es_hipertenso !== undefined ? req.body.Es_hipertenso : req.body.esHipertenso);

  const diabVal = parseBooleanLike(rawDiab);
  const hiperVal = parseBooleanLike(rawHiper);

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
        nombres || null,
        apePaterno || null,
        apeMaterno !== undefined ? apeMaterno : null,
        telefono || null,
        fechaNac || null,
        sexo || null,
        calzado !== undefined && calzado !== null ? calzado : null,
        calle || null,
        mun || null,
        ocupacion || null,
        diabVal,
        hiperVal,
        antPat || null,
        notas || null,
        no_expediente
      ]
    );

    // Consultar el paciente actualizado para retornar datos normalizados
    const [act] = await db.pool.query(
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

    const pacienteActualizado = act && act.length > 0 ? formatearPaciente(act[0]) : null;

    res.json({
      mensaje: 'Paciente actualizado correctamente',
      no_expediente,
      paciente: pacienteActualizado
    });
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