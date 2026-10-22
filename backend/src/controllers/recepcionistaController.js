const db = require('../config/db');

// Generador de número de expediente automático
async function generarNoExpediente(clinicaId = 1) {
  const anio = new Date().getFullYear();
  const clinicaStr = String(clinicaId).padStart(2, '0').slice(-2);
  const prefijo = `${anio}${clinicaStr}`;

  try {
    const [res] = await db.pool.query(
      `SELECT MAX(No_expediente) AS max_exp FROM Pacientes WHERE CAST(No_expediente AS CHAR) LIKE ?`,
      [`${prefijo}%`]
    );

    const maxExp = res[0]?.max_exp;
    if (maxExp) {
      const consecutivo = parseInt(String(maxExp).slice(-4), 10) + 1;
      return parseInt(`${prefijo}${String(consecutivo).padStart(4, '0')}`, 10);
    }
    return parseInt(`${prefijo}0001`, 10);
  } catch {
    return parseInt(`${prefijo}${Math.floor(1000 + Math.random() * 9000)}`, 10);
  }
}

/**
 * -------------------------------------------------------------
 * 1. REGISTRO DE PACIENTES (Solo datos de contacto)
 * -------------------------------------------------------------
 * Por directriz de RBAC, la recepcionista solo tiene permitido
 * insertar datos de contacto e identificación.
 * Todos los campos clínicos (es_diabetico, es_hipertenso,
 * Antecedentes_patologicos, Notas, Calzado) son explícitamente
 * omitidos y forzados a valores por defecto o nulos.
 */
const registrarPacienteContacto = async (req, res) => {
  const {
    Nombres,
    ape_paterno,
    ape_materno,
    telefono,
    Fecha_nacimiento,
    Sexo,
    Calle_direccion,
    Municipio,
    Ocupacion
  } = req.body;

  if (!Nombres || !ape_paterno) {
    return res.status(400).json({ error: 'Nombres y Apellido Paterno son obligatorios' });
  }

  try {
    const clinicaId = req.user?.fk_clinica_id || 1;
    const noExpediente = req.body.No_expediente
      ? parseInt(req.body.No_expediente, 10)
      : await generarNoExpediente(clinicaId);

    // SQL que excluye categóricamente cualquier historial clínico
    const sql = `
      INSERT INTO Pacientes (
        No_expediente,
        fk_usuario_id,
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
        Notas,
        Fecha_registro
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, FALSE, FALSE, NULL, NULL, CURDATE())
    `;

    await db.pool.query(sql, [
      noExpediente,
      Nombres.trim(),
      ape_paterno.trim(),
      ape_materno ? ape_materno.trim() : null,
      telefono ? telefono.trim() : null,
      Fecha_nacimiento || null,
      Sexo ? Sexo.toUpperCase().slice(0, 1) : null,
      Calle_direccion ? Calle_direccion.trim() : null,
      Municipio ? Municipio.trim() : null,
      Ocupacion ? Ocupacion.trim() : null
    ]);

    res.status(201).json({
      mensaje: 'Paciente registrado exitosamente (Exclusivamente datos de contacto)',
      paciente: {
        No_expediente: noExpediente,
        Nombres,
        ape_paterno,
        ape_materno,
        telefono,
        Fecha_nacimiento,
        Sexo,
        Calle_direccion,
        Municipio,
        Ocupacion,
        Fecha_registro: new Date().toISOString().split('T')[0]
      }
    });
  } catch (error) {
    console.error('Error al registrar paciente desde recepción:', error);
    res.status(500).json({ error: 'Error al registrar el paciente en la base de datos' });
  }
};

/**
 * Listar pacientes para la agenda y cobros (solo datos de contacto)
 */
const obtenerPacientesContacto = async (req, res) => {
  const { q } = req.query;
  try {
    let sql = `
      SELECT No_expediente, Nombres, ape_paterno, ape_materno,
             TRIM(CONCAT(Nombres, ' ', ape_paterno, ' ', COALESCE(ape_materno, ''))) AS nombre_completo,
             telefono, Fecha_nacimiento, Sexo, Calle_direccion, Municipio, Ocupacion, Fecha_registro
      FROM Pacientes
    `;
    const params = [];

    if (q) {
      sql += ` WHERE Nombres LIKE ? OR ape_paterno LIKE ? OR ape_materno LIKE ? OR telefono LIKE ? OR CAST(No_expediente AS CHAR) LIKE ?`;
      const term = `%${q}%`;
      params.push(term, term, term, term, term);
    }

    sql += ` ORDER BY No_expediente DESC LIMIT 50`;

    const [rows] = await db.pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al listar pacientes:', error);
    res.status(500).json({ error: 'Error al consultar pacientes' });
  }
};

/**
 * Obtener un paciente específico (solo datos de contacto)
 */
const obtenerPacienteContactoPorExpediente = async (req, res) => {
  const { expediente } = req.params;
  try {
    const [rows] = await db.pool.query(
      `SELECT No_expediente, Nombres, ape_paterno, ape_materno,
              TRIM(CONCAT(Nombres, ' ', ape_paterno, ' ', COALESCE(ape_materno, ''))) AS nombre_completo,
              telefono, Fecha_nacimiento, Sexo, Calle_direccion, Municipio, Ocupacion,
              es_diabetico, es_hipertenso, Antecedentes_patologicos, Notas, Fecha_registro
       FROM Pacientes
       WHERE No_expediente = ?`,
      [expediente]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const p = rows[0];
    const rawFechaNac = p.Fecha_nacimiento || p.fecha_nacimiento || null;
    const fechaNacFormatted = rawFechaNac ? String(rawFechaNac).split('T')[0].trim() : null;
    const calleDir = p.Calle_direccion || p.calle_direccion || p.direccion || '';
    const mun = p.Municipio || p.municipio || 'Tecámac';
    const isDiab = Boolean(p.es_diabetico === 1 || p.es_diabetico === '1' || p.es_diabetico === true || p.es_diabetico === 'true');
    const isHiper = Boolean(p.es_hipertenso === 1 || p.es_hipertenso === '1' || p.es_hipertenso === true || p.es_hipertenso === 'true');

    res.json({
      ...p,
      expediente: p.No_expediente,
      fecha_nacimiento: fechaNacFormatted,
      Fecha_nacimiento: fechaNacFormatted,
      calle_direccion: calleDir,
      Calle_direccion: calleDir,
      direccion: calleDir,
      Municipio: mun,
      municipio: mun,
      es_diabetico: isDiab ? 1 : 0,
      es_hipertenso: isHiper ? 1 : 0,
      esDiabetico: isDiab,
      esHipertenso: isHiper
    });
  } catch (error) {
    console.error('Error al obtener paciente:', error);
    res.status(500).json({ error: 'Error al consultar el paciente' });
  }
};

/**
 * -------------------------------------------------------------
 * 2. AGENDA GLOBAL (CRUD de Consultas de todos los médicos)
 * -------------------------------------------------------------
 */

// Listar todas las consultas con filtros
const obtenerConsultasGlobal = async (req, res) => {
  const { fecha, podologo, estado, clinica } = req.query;

  try {
    let sql = `
      SELECT c.Consulta_id, c.fk_no_expediente, c.fk_clinica_id, c.fk_cedula_podologo,
             c.fecha_hora, c.estado, c.motivo_o_notas,
             TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente_nombre,
             p.telefono AS paciente_telefono,
             TRIM(CONCAT(pod.Nombre, ' ', pod.ape_paterno)) AS podologo_nombre,
             cl.Nombre AS clinica_nombre,
             pag.Pago_id, pag.estado_pago, pag.monto, pag.metodo_pago
      FROM Consultas c
      JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
      JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
      JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
      LEFT JOIN Pagos pag ON c.Consulta_id = pag.fk_consulta_id
      WHERE 1=1
    `;
    const params = [];

    if (fecha) {
      sql += ` AND DATE(c.fecha_hora) = ?`;
      params.push(fecha);
    }
    if (podologo) {
      sql += ` AND c.fk_cedula_podologo = ?`;
      params.push(podologo);
    }
    if (estado) {
      sql += ` AND c.estado = ?`;
      params.push(estado);
    }
    if (clinica) {
      sql += ` AND c.fk_clinica_id = ?`;
      params.push(clinica);
    }

    sql += ` ORDER BY c.fecha_hora ASC`;

    const [rows] = await db.pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener agenda global:', error);
    res.status(500).json({ error: 'Error al consultar la agenda global' });
  }
};

// Crear una nueva consulta/cita médica
const crearConsulta = async (req, res) => {
  const {
    fk_no_expediente,
    fk_clinica_id,
    fk_cedula_podologo,
    fecha_hora,
    estado = 'Programada',
    motivo_o_notas
  } = req.body;

  if (!fk_no_expediente || !fk_cedula_podologo || !fecha_hora) {
    return res.status(400).json({ error: 'Expediente, podólogo y fecha/hora son obligatorios' });
  }

  try {
    const clinicaId = fk_clinica_id || req.user?.fk_clinica_id || 1;
    const consultaId = req.body.Consulta_id || `CNS-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const sql = `
      INSERT INTO Consultas (
        Consulta_id,
        fk_no_expediente,
        fk_clinica_id,
        fk_cedula_podologo,
        fecha_hora,
        estado,
        motivo_o_notas,
        Peso,
        Altura,
        tipo_pisada,
        alineacion,
        observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL)
    `;

    await db.pool.query(sql, [
      consultaId,
      fk_no_expediente,
      clinicaId,
      fk_cedula_podologo,
      fecha_hora,
      estado,
      motivo_o_notas || null
    ]);

    res.status(201).json({
      mensaje: 'Consulta agendada exitosamente en la Agenda Global',
      consulta: {
        Consulta_id: consultaId,
        fk_no_expediente,
        fk_clinica_id: clinicaId,
        fk_cedula_podologo,
        fecha_hora,
        estado,
        motivo_o_notas
      }
    });
  } catch (error) {
    console.error('Error al agendar consulta:', error);
    res.status(500).json({ error: 'Error al agendar la consulta' });
  }
};

// Actualizar o reprogramar una consulta existente
const actualizarConsulta = async (req, res) => {
  const { id } = req.params;
  const {
    fk_cedula_podologo,
    fk_clinica_id,
    fecha_hora,
    estado,
    motivo_o_notas
  } = req.body;

  try {
    // Verificar si existe la consulta
    const [existente] = await db.pool.query(
      `SELECT Consulta_id FROM Consultas WHERE Consulta_id = ?`,
      [id]
    );

    if (existente.length === 0) {
      return res.status(404).json({ error: 'Consulta no encontrada' });
    }

    const campos = [];
    const params = [];

    if (fk_cedula_podologo !== undefined) {
      campos.push('fk_cedula_podologo = ?');
      params.push(fk_cedula_podologo);
    }
    if (fk_clinica_id !== undefined) {
      campos.push('fk_clinica_id = ?');
      params.push(fk_clinica_id);
    }
    if (fecha_hora !== undefined) {
      campos.push('fecha_hora = ?');
      params.push(fecha_hora);
    }
    if (estado !== undefined) {
      campos.push('estado = ?');
      params.push(estado);
    }
    if (motivo_o_notas !== undefined) {
      campos.push('motivo_o_notas = ?');
      params.push(motivo_o_notas);
    }

    if (campos.length === 0) {
      return res.status(400).json({ error: 'No se enviaron datos para actualizar' });
    }

    params.push(id);
    const sql = `UPDATE Consultas SET ${campos.join(', ')} WHERE Consulta_id = ?`;

    await db.pool.query(sql, params);

    res.json({
      mensaje: 'Consulta actualizada correctamente',
      Consulta_id: id
    });
  } catch (error) {
    console.error('Error al actualizar consulta:', error);
    res.status(500).json({ error: 'Error al actualizar la consulta' });
  }
};

// Cancelar o eliminar consulta
const eliminarConsulta = async (req, res) => {
  const { id } = req.params;
  try {
    // Si tiene pagos o relaciones, podemos marcarla como Cancelada o eliminarla
    const [existente] = await db.pool.query(
      `SELECT Consulta_id FROM Consultas WHERE Consulta_id = ?`,
      [id]
    );

    if (existente.length === 0) {
      return res.status(404).json({ error: 'Consulta no encontrada' });
    }

    await db.pool.query(
      `UPDATE Consultas SET estado = 'Cancelada' WHERE Consulta_id = ?`,
      [id]
    );

    res.json({ mensaje: 'Consulta cancelada exitosamente', Consulta_id: id });
  } catch (error) {
    console.error('Error al cancelar consulta:', error);
    res.status(500).json({ error: 'Error al procesar la cancelación de la consulta' });
  }
};

// Catálogos para el formulario de agendamiento
const obtenerCatalogosAgenda = async (req, res) => {
  try {
    const [podologos] = await db.pool.query(
      `SELECT Cedula_podologo, Nombre, ape_paterno, ape_materno,
              TRIM(CONCAT(Nombre, ' ', ape_paterno, ' ', COALESCE(ape_materno, ''))) AS nombre_completo,
              Telefono_pod
       FROM Podologos
       ORDER BY Nombre ASC`
    );

    const [clinicas] = await db.pool.query(
      `SELECT Clinica_id, Nombre, Calle_clinica, Municipio_clinica, Telefono
       FROM Clinicas
       WHERE Activa = TRUE
       ORDER BY Nombre ASC`
    );

    res.json({ podologos, clinicas });
  } catch (error) {
    console.error('Error al obtener catálogos:', error);
    res.status(500).json({ error: 'Error al obtener catálogos' });
  }
};

/**
 * -------------------------------------------------------------
 * 3. MÓDULO DE COBROS (Tabla Pagos con fk_recepcionista_id)
 * -------------------------------------------------------------
 */

// Listar consultas pendientes de cobro
const obtenerConsultasPendientesCobro = async (req, res) => {
  try {
    const sql = `
      SELECT c.Consulta_id, c.fecha_hora, c.estado, c.motivo_o_notas,
             p.No_expediente,
             TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente_nombre,
             p.telefono AS paciente_telefono,
             TRIM(CONCAT(pod.Nombre, ' ', pod.ape_paterno)) AS podologo_nombre,
             pag.Pago_id, pag.monto, pag.metodo_pago,
             COALESCE(pag.estado_pago, 'Pendiente') AS estado_pago
      FROM Consultas c
      JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
      JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
      LEFT JOIN Pagos pag ON c.Consulta_id = pag.fk_consulta_id
      WHERE (pag.Pago_id IS NULL OR pag.estado_pago = 'Pendiente')
        AND c.estado != 'Cancelada'
      ORDER BY c.fecha_hora DESC
    `;

    const [rows] = await db.pool.query(sql);
    res.json(rows);
  } catch (error) {
    console.error('Error al consultar cobros pendientes:', error);
    res.status(500).json({ error: 'Error al consultar cobros pendientes' });
  }
};

// Historial general de pagos procesados
const obtenerHistorialCobros = async (req, res) => {
  try {
    const sql = `
      SELECT pag.Pago_id, pag.fk_consulta_id, pag.fk_recepcionista_id,
             pag.monto, pag.metodo_pago, pag.estado_pago, pag.fecha_pago,
             c.fecha_hora AS consulta_fecha, c.estado AS consulta_estado,
             p.No_expediente,
             TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente_nombre,
             TRIM(CONCAT(r.Nombre, ' ', r.ape_paterno)) AS recepcionista_nombre,
             TRIM(CONCAT(pod.Nombre, ' ', pod.ape_paterno)) AS podologo_nombre
      FROM Pagos pag
      JOIN Consultas c ON pag.fk_consulta_id = c.Consulta_id
      JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
      JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
      LEFT JOIN Recepcionistas r ON pag.fk_recepcionista_id = r.Recepcionista_id
      ORDER BY pag.fecha_pago DESC
      LIMIT 100
    `;

    const [rows] = await db.pool.query(sql);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener historial de pagos:', error);
    res.status(500).json({ error: 'Error al consultar historial de pagos' });
  }
};

// Procesar o registrar un cobro (Asignando su fk_recepcionista_id)
const procesarCobro = async (req, res) => {
  const {
    fk_consulta_id,
    monto,
    metodo_pago = 'Efectivo',
    estado_pago = 'Completado'
  } = req.body;

  if (!fk_consulta_id || monto === undefined || monto === null) {
    return res.status(400).json({ error: 'ID de Consulta y Monto son obligatorios' });
  }

  // Identificar el ID de la recepcionista conectada en sesión
  const recepcionistaId = req.user?.recepcionista_id || req.user?.Recepcionista_id || req.body.fk_recepcionista_id || 1;

  try {
    // Verificar si la consulta existe
    const [consulta] = await db.pool.query(
      `SELECT Consulta_id, fk_no_expediente FROM Consultas WHERE Consulta_id = ?`,
      [fk_consulta_id]
    );

    if (consulta.length === 0) {
      return res.status(404).json({ error: 'Consulta no encontrada para procesar el pago' });
    }

    // Verificar si ya existe un registro de pago previo para esta consulta
    const [pagoExistente] = await db.pool.query(
      `SELECT Pago_id FROM Pagos WHERE fk_consulta_id = ?`,
      [fk_consulta_id]
    );

    let pagoIdFinal;

    if (pagoExistente.length > 0) {
      pagoIdFinal = pagoExistente[0].Pago_id;
      await db.pool.query(
        `UPDATE Pagos
         SET fk_recepcionista_id = ?,
             monto = ?,
             metodo_pago = ?,
             estado_pago = ?,
             fecha_pago = NOW()
         WHERE Pago_id = ?`,
        [recepcionistaId, parseFloat(monto), metodo_pago, estado_pago, pagoIdFinal]
      );
    } else {
      pagoIdFinal = req.body.Pago_id || `PAG-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      await db.pool.query(
        `INSERT INTO Pagos (
          Pago_id,
          fk_consulta_id,
          fk_recepcionista_id,
          monto,
          metodo_pago,
          estado_pago,
          fecha_pago
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [pagoIdFinal, fk_consulta_id, recepcionistaId, parseFloat(monto), metodo_pago, estado_pago]
      );
    }

    res.status(201).json({
      mensaje: 'Pago procesado exitosamente por Recepción',
      pago: {
        Pago_id: pagoIdFinal,
        fk_consulta_id,
        fk_recepcionista_id: recepcionistaId,
        monto: parseFloat(monto),
        metodo_pago,
        estado_pago,
        fecha_pago: new Date()
      }
    });
  } catch (error) {
    console.error('Error al procesar cobro:', error);
    res.status(500).json({ error: 'Error al registrar el cobro en la base de datos' });
  }
};

// Generar recibo o comprobante de pago
const obtenerDetalleRecibo = async (req, res) => {
  const { id } = req.params;
  try {
    const sql = `
      SELECT pag.Pago_id, pag.monto, pag.metodo_pago, pag.estado_pago, pag.fecha_pago,
             c.Consulta_id, c.fecha_hora,
             p.No_expediente,
             TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente_nombre,
             p.telefono AS paciente_telefono,
             TRIM(CONCAT(pod.Nombre, ' ', pod.ape_paterno)) AS podologo_nombre,
             cl.Nombre AS clinica_nombre, cl.Calle_clinica, cl.Municipio_clinica, cl.Telefono AS clinica_telefono,
             TRIM(CONCAT(r.Nombre, ' ', r.ape_paterno)) AS recepcionista_nombre
      FROM Pagos pag
      JOIN Consultas c ON pag.fk_consulta_id = c.Consulta_id
      JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
      JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
      JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
      LEFT JOIN Recepcionistas r ON pag.fk_recepcionista_id = r.Recepcionista_id
      WHERE pag.Pago_id = ?
    `;

    const [rows] = await db.pool.query(sql, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Recibo de pago no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener recibo:', error);
    res.status(500).json({ error: 'Error al consultar el comprobante de pago' });
  }
};

module.exports = {
  registrarPacienteContacto,
  obtenerPacientesContacto,
  obtenerPacienteContactoPorExpediente,
  obtenerConsultasGlobal,
  crearConsulta,
  actualizarConsulta,
  eliminarConsulta,
  obtenerCatalogosAgenda,
  obtenerConsultasPendientesCobro,
  obtenerHistorialCobros,
  procesarCobro,
  obtenerDetalleRecibo
};
