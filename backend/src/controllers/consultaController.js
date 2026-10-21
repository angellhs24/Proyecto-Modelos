const db = require('../config/db');
const { parseNombreCompleto } = require('../utils/nameParser');

// Normalizar fechas y horas para formato estándar MySQL DATETIME (YYYY-MM-DD HH:MM:SS)
function normalizarFechaHoraMySQL(input) {
  if (!input) return null;
  if (input instanceof Date) {
    const y = input.getFullYear();
    const m = String(input.getMonth() + 1).padStart(2, '0');
    const d = String(input.getDate()).padStart(2, '0');
    const hh = String(input.getHours()).padStart(2, '0');
    const mm = String(input.getMinutes()).padStart(2, '0');
    const ss = String(input.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }

  const str = String(input).trim();

  // Formato "YYYY-MM-DD hh:mm[:ss] AM|PM" (ej: "2026-09-28 11:00 AM", "2026-09-28 02:30 PM")
  const ampmRegex = /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i;
  const ampmMatch = str.match(ampmRegex);
  if (ampmMatch) {
    const [, datePart, hoursStr, minsStr, secsStr, modifier] = ampmMatch;
    let hours = parseInt(hoursStr, 10);
    const mins = minsStr;
    const secs = secsStr || '00';
    const mod = modifier.toUpperCase();

    if (mod === 'PM' && hours < 12) {
      hours += 12;
    } else if (mod === 'AM' && hours === 12) {
      hours = 0;
    }

    const hh = String(hours).padStart(2, '0');
    return `${datePart} ${hh}:${mins}:${secs}`;
  }

  // Formato "YYYY-MM-DD HH:mm:ss"
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(str)) {
    return str;
  }

  // Formato "YYYY-MM-DD HH:mm"
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(str)) {
    return `${str}:00`;
  }

  // Formato ISO "YYYY-MM-DDTHH:mm:ss"
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
    }
  }

  return str;
}

// Generador de ID para consultas (Ej: CON2026140001)
async function generarConsultaId(clinicaId = 14) {
  const anio = new Date().getFullYear();
  const clinicaStr = String(clinicaId).padStart(2, '0').slice(-2);
  const prefijo = `CON${anio}${clinicaStr}`;

  try {
    const res = await db.query(
      `SELECT MAX(Consulta_id) AS max_id FROM Consultas WHERE Consulta_id LIKE ?`,
      [`${prefijo}%`]
    );

    const maxId = res.rows[0]?.max_id;
    if (maxId) {
      const consecutivo = parseInt(maxId.slice(-4), 10) + 1;
      return `${prefijo}${String(consecutivo).padStart(4, '0')}`;
    }
    return `${prefijo}0001`;
  } catch {
    return `${prefijo}${Math.floor(1000 + Math.random() * 9000)}`;
  }
}

// Obtener todas las consultas con filtros opcionales
const obtenerConsultas = async (req, res) => {
  const { clinica_id, id_clinica, fecha, estado, expediente } = req.query;
  const clinicaFiltro = clinica_id || id_clinica;

  try {
    let sql = `
      SELECT c.*,
             c.Consulta_id AS id_cita,
             c.fecha_hora AS fecha_hora_inicio,
             DATE_FORMAT(c.fecha_hora, '%H:%i') AS hora_24,
             DATE_FORMAT(c.fecha_hora, '%h:%i') AS hora,
             DATE_FORMAT(c.fecha_hora, '%p') AS ampm,
             c.motivo_o_notas AS motivo,
             c.fk_clinica_id AS id_clinica,
             p.No_expediente AS expediente,
             p.No_expediente AS id_paciente,
             TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente_nombre,
             p.telefono AS paciente_telefono,
             p.es_diabetico,
             p.es_hipertenso,
             p.Notas AS notas_alergias,
             CASE 
               WHEN p.Fecha_nacimiento IS NOT NULL THEN TIMESTAMPDIFF(YEAR, p.Fecha_nacimiento, CURDATE())
               ELSE NULL 
             END AS paciente_edad,
             p.Sexo AS paciente_sexo,
             cl.Nombre AS clinica_nombre,
             TRIM(CONCAT(pod.Nombre, ' ', pod.ape_paterno, ' ', COALESCE(pod.ape_materno, ''))) AS podologo_nombre
      FROM Consultas c
      INNER JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
      INNER JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
      INNER JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
      WHERE 1=1
    `;
    const params = [];

    if (clinicaFiltro) {
      sql += ` AND c.fk_clinica_id = ?`;
      params.push(clinicaFiltro);
    }
    if (fecha) {
      sql += ` AND DATE(c.fecha_hora) = ?`;
      params.push(fecha);
    }
    if (estado) {
      sql += ` AND c.estado = ?`;
      params.push(estado);
    }
    if (expediente) {
      sql += ` AND c.fk_no_expediente = ?`;
      params.push(expediente);
    }
    const podologoFiltro = req.query.podologo_cedula || req.query.cedula_podologo || req.query.cedula;
    if (podologoFiltro) {
      sql += ` AND c.fk_cedula_podologo = ?`;
      params.push(podologoFiltro);
    }

    sql += ` ORDER BY c.fecha_hora DESC`;

    const resultado = await db.query(sql, params);
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener consultas:', error);
    res.status(500).json({ error: 'Error al obtener las consultas' });
  }
};

// Consultar disponibilidad de horarios en tiempo real por clínica, especialista y fecha
const obtenerDisponibilidadHorarios = async (req, res) => {
  const { clinica_id, id_clinica, fecha, cedula_podologo, cedula } = req.query;
  const clinicaFinal = clinica_id || id_clinica;
  const podologoFinal = cedula_podologo || cedula;

  if (!fecha) {
    return res.status(400).json({ error: 'El parámetro fecha (YYYY-MM-DD) es requerido' });
  }

  try {
    let sql = `
      SELECT c.Consulta_id,
             c.fk_clinica_id,
             c.fk_cedula_podologo,
             c.fecha_hora,
             DATE_FORMAT(c.fecha_hora, '%H:%i') AS hora_24,
             DATE_FORMAT(c.fecha_hora, '%h:%i %p') AS hora_12,
             c.estado,
             TRIM(CONCAT(pod.Nombre, ' ', pod.ape_paterno, ' ', COALESCE(pod.ape_materno, ''))) AS podologo_nombre,
             cl.Nombre AS clinica_nombre
      FROM Consultas c
      LEFT JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
      LEFT JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
      WHERE DATE(c.fecha_hora) = ?
        AND c.estado != 'Cancelada'
    `;
    const params = [fecha];

    if (podologoFinal) {
      // La disponibilidad se rige por la agenda del especialista seleccionado
      sql += ` AND c.fk_cedula_podologo = ?`;
      params.push(podologoFinal);
    } else if (clinicaFinal) {
      // Si no se eligió un podólogo específico, filtrar por las citas de la sede
      sql += ` AND c.fk_clinica_id = ?`;
      params.push(clinicaFinal);
    }

    const { rows } = await db.query(sql, params);

    // Normalizar horas ocupadas (ej. "10:00 AM", "02:00 PM")
    const horasOcupadas12 = rows.map((r) => r.hora_12 ? r.hora_12.trim().toUpperCase() : null).filter(Boolean);
    const horasOcupadas24 = rows.map((r) => r.hora_24 ? r.hora_24.trim() : null).filter(Boolean);

    res.json({
      fecha,
      clinica_id: clinicaFinal || null,
      cedula_podologo: podologoFinal || null,
      total_ocupadas: rows.length,
      horas_ocupadas: horasOcupadas12,
      horas_24_ocupadas: horasOcupadas24,
      detalles: rows
    });
  } catch (error) {
    console.error('Error al consultar disponibilidad:', error);
    res.status(500).json({ error: 'Error al consultar disponibilidad de horarios' });
  }
};

// Obtener consultas filtradas por clínica (para compatibilidad directa con frontend)
const obtenerConsultasPorClinica = async (req, res) => {
  const { id_clinica } = req.params;

  try {
    const sql = `
      SELECT c.*,
             c.Consulta_id AS id_cita,
             c.fecha_hora AS fecha_hora_inicio,
             DATE_FORMAT(c.fecha_hora, '%H:%i') AS hora_24,
             DATE_FORMAT(c.fecha_hora, '%h:%i') AS hora,
             DATE_FORMAT(c.fecha_hora, '%p') AS ampm,
             c.motivo_o_notas AS motivo,
             c.fk_clinica_id AS id_clinica,
             p.No_expediente AS expediente,
             p.No_expediente AS id_paciente,
             TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente_nombre,
             p.telefono AS paciente_telefono,
             p.es_diabetico,
             p.es_hipertenso,
             p.Notas AS notas_alergias,
             CASE 
               WHEN p.Fecha_nacimiento IS NOT NULL THEN TIMESTAMPDIFF(YEAR, p.Fecha_nacimiento, CURDATE())
               ELSE NULL 
             END AS paciente_edad,
             p.Sexo AS paciente_sexo,
             cl.Nombre AS clinica_nombre,
             TRIM(CONCAT(pod.Nombre, ' ', pod.ape_paterno, ' ', COALESCE(pod.ape_materno, ''))) AS podologo_nombre
      FROM Consultas c
      INNER JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
      INNER JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
      INNER JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
      WHERE c.fk_clinica_id = ?
      ORDER BY c.fecha_hora DESC
    `;

    const resultado = await db.query(sql, [id_clinica]);
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener consultas por clínica:', error);
    res.status(500).json({ error: 'Error al obtener las consultas de la sede' });
  }
};

// Obtener detalle completo de una consulta (con Diagnósticos, Tratamientos y Documentos)
const obtenerDetalleConsulta = async (req, res) => {
  const { id } = req.params;

  try {
    const consultaRes = await db.query(
      `SELECT c.*,
              c.Consulta_id AS id_cita,
              c.fecha_hora AS fecha_hora_inicio,
              TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente_nombre,
              p.telefono AS paciente_telefono,
              p.es_diabetico,
              p.es_hipertenso,
              p.Notas AS paciente_notas,
              cl.Nombre AS clinica_nombre,
              TRIM(CONCAT(pod.Nombre, ' ', pod.ape_paterno, ' ', COALESCE(pod.ape_materno, ''))) AS podologo_nombre
       FROM Consultas c
       INNER JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
       INNER JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
       INNER JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
       WHERE c.Consulta_id = ?`,
      [id]
    );

    if (consultaRes.rows.length === 0) {
      return res.status(404).json({ error: 'Consulta no encontrada' });
    }

    const consulta = consultaRes.rows[0];

    // Diagnósticos asociados
    const diagnosticosRes = await db.query(
      `SELECT * FROM Diagnosticos WHERE fk_consulta_id = ? ORDER BY Diagnostico_id ASC`,
      [id]
    );
    consulta.diagnosticos = diagnosticosRes.rows;

    // Tratamientos asociados
    const tratamientosRes = await db.query(
      `SELECT * FROM Tratamientos WHERE fk_consulta_id = ? ORDER BY Tratamiento_id ASC`,
      [id]
    );
    consulta.tratamientos = tratamientosRes.rows;

    // Documentos escaneados asociados
    const documentosRes = await db.query(
      `SELECT * FROM Documentos_escaneados WHERE fk_consulta_id = ? ORDER BY fecha_subida DESC`,
      [id]
    );
    consulta.documentos = documentosRes.rows;

    res.json(consulta);
  } catch (error) {
    console.error('Error al obtener detalle de consulta:', error);
    res.status(500).json({ error: 'Error al consultar el detalle' });
  }
};

// Crear una nueva consulta / cita
const crearConsulta = async (req, res) => {
  let {
    Consulta_id,
    fk_no_expediente,
    id_paciente,
    fk_clinica_id,
    id_clinica,
    fk_cedula_podologo,
    cedula_podologo,
    fecha_hora,
    fecha_hora_inicio,
    fecha,
    hora,
    estado,
    motivo_o_notas,
    motivo,
    Peso,
    Altura,
    tipo_pisada,
    alineacion,
    observaciones,
    diagnosticos,
    tratamientos
  } = req.body;

  try {
    let expedienteFinal = fk_no_expediente || id_paciente || req.body.expediente || req.body.No_expediente;
    const clinicaFinal = fk_clinica_id || id_clinica || req.body.clinica_id || req.body.sucursal_id || 14;

    const nom = req.body.nombre_completo || req.body.paciente_nombre || req.body.nombre || '';
    let parsed = { nombres: 'Paciente', apePaterno: 'Sin Apellido', apeMaterno: null };
    if (nom) {
      parsed = parseNombreCompleto(nom);
    }

    const nombres = req.body.nombres || req.body.Nombres || parsed.nombres || 'Paciente';
    const apePaterno = req.body.ape_paterno || req.body.apellidos || parsed.apePaterno || 'Sin Apellido';
    const apeMaterno = req.body.ape_materno !== undefined ? req.body.ape_materno : (parsed.apeMaterno || null);
    const tel = req.body.telefono || req.body.paciente_telefono || null;
    const fechaNac = req.body.Fecha_nacimiento || req.body.fecha_nacimiento || null;
    const calle = req.body.Calle_direccion || req.body.calle_direccion || null;
    const mun = req.body.Municipio || req.body.municipio || null;
    const ocup = req.body.Ocupacion || req.body.ocupacion || null;
    const antPat = req.body.Antecedentes_patologicos || req.body.antecedentes_patologicos || null;
    const diab = req.body.es_diabetico ? 1 : 0;
    const hiper = req.body.es_hipertenso ? 1 : 0;
    const notas = req.body.Notas || req.body.notas || req.body.motivo || req.body.notas_alergias || null;
    const sexoRaw = req.body.sexo || req.body.Sexo || null;
    const sexoChar = sexoRaw ? (String(sexoRaw).trim().toUpperCase().startsWith('M') ? 'M' : (String(sexoRaw).trim().toUpperCase().startsWith('F') ? 'F' : 'O')) : null;
    const calzado = req.body.Calzado || req.body.calzado || null;

    // Si es un paciente nuevo (sin No. de Expediente), generarlo automáticamente
    if (!expedienteFinal) {
      const anio = new Date().getFullYear();
      const clinicaStr = String(clinicaFinal).padStart(2, '0').slice(-2);
      const prefijo = `${anio}${clinicaStr}`;
      try {
        const resExp = await db.query(
          `SELECT MAX(No_expediente) AS max_exp FROM Pacientes WHERE CAST(No_expediente AS CHAR) LIKE ?`,
          [`${prefijo}%`]
        );
        const maxExp = resExp.rows[0]?.max_exp;
        if (maxExp) {
          const consecutivo = parseInt(String(maxExp).slice(-4), 10) + 1;
          expedienteFinal = Number(`${prefijo}${String(consecutivo).padStart(4, '0')}`);
        } else {
          expedienteFinal = Number(`${prefijo}0001`);
        }
      } catch {
        expedienteFinal = Number(`${anio}${clinicaStr}${Math.floor(1000 + Math.random() * 9000)}`);
      }
    }

    // Verificar si el paciente existe en Pacientes para evitar violación de Foreign Key
    const pacCheck = await db.query(
      'SELECT No_expediente FROM Pacientes WHERE No_expediente = ?',
      [expedienteFinal]
    );

    if (pacCheck.rows.length === 0) {
      // Paciente nuevo / Walk-in: darlo de alta automáticamente con todos los campos DDL
      await db.query(
        `INSERT INTO Pacientes (
          No_expediente, Nombres, ape_paterno, ape_materno, telefono,
          Fecha_nacimiento, Sexo, Calzado, Calle_direccion, Municipio,
          Ocupacion, es_diabetico, es_hipertenso, Antecedentes_patologicos,
          Notas, Fecha_registro
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
        [
          expedienteFinal,
          nombres,
          apePaterno,
          apeMaterno,
          tel,
          fechaNac,
          sexoChar || 'F',
          calzado,
          calle,
          mun,
          ocup,
          diab,
          hiper,
          antPat,
          notas
        ]
      );
    } else {
      // Paciente existente: actualizar sus datos clínicos del expediente
      await db.query(
        `UPDATE Pacientes SET
          telefono = COALESCE(?, telefono),
          Fecha_nacimiento = COALESCE(?, Fecha_nacimiento),
          Sexo = COALESCE(?, Sexo),
          Calle_direccion = COALESCE(?, Calle_direccion),
          Municipio = COALESCE(?, Municipio),
          Ocupacion = COALESCE(?, Ocupacion),
          Antecedentes_patologicos = COALESCE(?, Antecedentes_patologicos),
          Notas = COALESCE(?, Notas),
          es_diabetico = ?,
          es_hipertenso = ?
        WHERE No_expediente = ?`,
        [
          tel,
          fechaNac,
          sexoChar,
          calle,
          mun,
          ocup,
          antPat,
          notas,
          diab,
          hiper,
          expedienteFinal
        ]
      );
    }
    
    // Obtener podólogo por defecto si no se especificó
    let podologoFinal = fk_cedula_podologo || cedula_podologo;
    if (!podologoFinal) {
      const podRes = await db.query('SELECT Cedula_podologo FROM Podologos LIMIT 1');
      podologoFinal = podRes.rows[0]?.Cedula_podologo || 'A-54906';
    }

    // Formatear fecha y hora
    let fechaHoraFinal = fecha_hora || fecha_hora_inicio;
    if (!fechaHoraFinal && fecha) {
      fechaHoraFinal = hora ? `${fecha} ${hora}` : `${fecha} 10:00:00`;
    }

    if (!expedienteFinal || !fechaHoraFinal) {
      return res.status(400).json({ error: 'El expediente del paciente y la fecha/hora son obligatorios' });
    }

    fechaHoraFinal = normalizarFechaHoraMySQL(fechaHoraFinal);

    // Validar que el especialista seleccionado no tenga ya una cita confirmada en ese mismo horario
    let conflicto = { rows: [] };
    if (podologoFinal) {
      conflicto = await db.query(
        `SELECT c.Consulta_id, pod.Nombre, pod.ape_paterno
         FROM Consultas c
         LEFT JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
         WHERE c.fecha_hora = ? 
           AND c.fk_cedula_podologo = ?
           AND c.estado != 'Cancelada'
         LIMIT 1`,
        [fechaHoraFinal, podologoFinal]
      );
    } else if (clinicaFinal) {
      conflicto = await db.query(
        `SELECT c.Consulta_id, cl.Nombre AS clinica_nombre
         FROM Consultas c
         LEFT JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
         WHERE c.fecha_hora = ? 
           AND c.fk_clinica_id = ?
           AND c.estado != 'Cancelada'
         LIMIT 1`,
        [fechaHoraFinal, clinicaFinal]
      );
    }

    if (conflicto.rows.length > 0) {
      const row = conflicto.rows[0];
      const nombrePod = row.Nombre ? `El especialista ${row.Nombre} ${row.ape_paterno}` : 'El especialista seleccionado';
      return res.status(409).json({ 
        error: `${nombrePod} ya cuenta con una cita confirmada en este horario. Por favor selecciona otro horario o especialista disponible.` 
      });
    }

    const consultaIdFinal = Consulta_id || (await generarConsultaId(clinicaFinal));
    const estadoFinal = estado || 'Confirmada';
    const motivoFinal = motivo_o_notas || motivo || 'Revisión Podológica General';

    // Insertar consulta
    await db.query(
      `INSERT INTO Consultas (
        Consulta_id, fk_no_expediente, fk_clinica_id, fk_cedula_podologo,
        fecha_hora, estado, motivo_o_notas, Peso, Altura,
        tipo_pisada, alineacion, observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        consultaIdFinal,
        expedienteFinal,
        clinicaFinal,
        podologoFinal,
        fechaHoraFinal,
        estadoFinal,
        motivoFinal,
        Peso || null,
        Altura || null,
        tipo_pisada || 'Neutra',
        alineacion || 'Neutra',
        observaciones || null
      ]
    );



    // Insertar diagnósticos si vienen en la petición
    if (Array.isArray(diagnosticos) && diagnosticos.length > 0) {
      for (let i = 0; i < diagnosticos.length; i++) {
        const d = diagnosticos[i];
        const diagId = d.Diagnostico_id || `DX${consultaIdFinal}${String(i + 1).padStart(2, '0')}`;
        await db.query(
          `INSERT INTO Diagnosticos (
            Diagnostico_id, fk_consulta_id, padecimiento, pie_izquierdo, pie_derecho, tipo_diagnostico, detalles_adicionales
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            diagId,
            consultaIdFinal,
            d.padecimiento || 'Sin alteración clínica',
            d.pie_izquierdo ? 1 : 0,
            d.pie_derecho ? 1 : 0,
            d.tipo_diagnostico || 'Preventivo',
            d.detalles_adicionales || null
          ]
        );
      }
    }

    // Insertar tratamientos si vienen en la petición
    if (Array.isArray(tratamientos) && tratamientos.length > 0) {
      for (let j = 0; j < tratamientos.length; j++) {
        const t = tratamientos[j];
        const tratId = t.Tratamiento_id || `TR${consultaIdFinal}${String(j + 1).padStart(2, '0')}`;
        await db.query(
          `INSERT INTO Tratamientos (
            Tratamiento_id, fk_consulta_id, procedimiento_servicio, pie_izquierdo, pie_derecho, tratamiento_aplicado, fecha_inicio, fecha_fin, frecuencia
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tratId,
            consultaIdFinal,
            t.procedimiento_servicio || 'Profilaxis Preventiva',
            t.pie_izquierdo ? 1 : 0,
            t.pie_derecho ? 1 : 0,
            t.tratamiento_aplicado || null,
            t.fecha_inicio || new Date().toISOString().split('T')[0],
            t.fecha_fin || null,
            t.frecuencia || 'Control en 2 meses'
          ]
        );
      }
    }

    res.status(201).json({
      mensaje: 'Cita médica agendada correctamente',
      Consulta_id: consultaIdFinal,
      id_cita: consultaIdFinal,
      no_expediente: expedienteFinal,
      paciente: {
        No_expediente: expedienteFinal,
        Nombres: nombres,
        nombres: nombres,
        ape_paterno: apePaterno,
        ape_materno: apeMaterno,
        nombre: [nombres, apePaterno, apeMaterno].filter(Boolean).join(' '),
        nombre_completo: [nombres, apePaterno, apeMaterno].filter(Boolean).join(' '),
        telefono: tel
      },
      consulta: {
        Consulta_id: consultaIdFinal,
        fk_no_expediente: expedienteFinal,
        fk_clinica_id: clinicaFinal,
        fk_cedula_podologo: podologoFinal,
        fecha_hora: fechaHoraFinal,
        estado: estadoFinal,
        motivo_o_notas: motivoFinal
      }
    });
  } catch (error) {
    console.error('Error al agendar consulta:', error);
    res.status(500).json({ error: 'Error al registrar la consulta en el sistema' });
  }
};

// Actualizar consulta
const actualizarConsulta = async (req, res) => {
  const { id } = req.params;
  const {
    estado,
    motivo_o_notas,
    Peso,
    Altura,
    tipo_pisada,
    alineacion,
    observaciones,
    fecha_hora
  } = req.body;

  const fechaHoraNormalizada = fecha_hora ? normalizarFechaHoraMySQL(fecha_hora) : null;

  try {
    await db.query(
      `UPDATE Consultas SET
        estado = COALESCE(?, estado),
        motivo_o_notas = COALESCE(?, motivo_o_notas),
        Peso = COALESCE(?, Peso),
        Altura = COALESCE(?, Altura),
        tipo_pisada = COALESCE(?, tipo_pisada),
        alineacion = COALESCE(?, alineacion),
        observaciones = COALESCE(?, observaciones),
        fecha_hora = COALESCE(?, fecha_hora)
       WHERE Consulta_id = ?`,
      [
        estado,
        motivo_o_notas,
        Peso,
        Altura,
        tipo_pisada,
        alineacion,
        observaciones,
        fechaHoraNormalizada,
        id
      ]
    );

    res.json({ mensaje: 'Consulta actualizada con éxito' });
  } catch (error) {
    console.error('Error al actualizar consulta:', error);
    res.status(500).json({ error: 'Error al actualizar la consulta' });
  }
};

// Eliminar consulta
const eliminarConsulta = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM Consultas WHERE Consulta_id = ?', [id]);
    res.json({ mensaje: 'Consulta eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar consulta:', error);
    res.status(500).json({ error: 'Error al eliminar la consulta' });
  }
};

module.exports = {
  obtenerConsultas,
  obtenerDisponibilidadHorarios,
  obtenerConsultasPorClinica,
  obtenerDetalleConsulta,
  crearConsulta,
  actualizarConsulta,
  eliminarConsulta
};
