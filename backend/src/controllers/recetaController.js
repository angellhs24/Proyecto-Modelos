const db = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoria');

/**
 * Obtener todas las recetas médicas con sus medicamentos y datos del paciente/consulta
 */
const obtenerRecetas = async (req, res) => {
  try {
    const { fk_consulta_id, expediente } = req.query;

    let sql = `
      SELECT 
        r.Receta_id,
        r.Receta_id AS folio,
        r.fk_consulta_id,
        r.indicaciones_generales,
        r.indicaciones_generales AS indicaciones,
        r.fecha_emision,
        r.fecha_emision AS fecha,
        c.fk_no_expediente,
        p.No_expediente AS expediente,
        TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente,
        p.telefono AS paciente_telefono,
        p.Notas AS alergias,
        CASE 
          WHEN p.Fecha_nacimiento IS NOT NULL THEN TIMESTAMPDIFF(YEAR, p.Fecha_nacimiento, CURDATE())
          ELSE NULL 
        END AS edad,
        c.motivo_o_notas AS diagnostico,
        cl.Nombre AS clinica,
        pod.Nombre AS podologo_nombre,
        pod.Cedula_podologo AS podologo_cedula
      FROM Recetas r
      INNER JOIN Consultas c ON r.fk_consulta_id = c.Consulta_id
      INNER JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
      LEFT JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
      LEFT JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
      WHERE 1=1
    `;
    const params = [];

    if (fk_consulta_id) {
      sql += ` AND r.fk_consulta_id = ?`;
      params.push(fk_consulta_id);
    }

    if (expediente) {
      sql += ` AND p.No_expediente = ?`;
      params.push(expediente);
    }

    sql += ` ORDER BY r.fecha_emision DESC, r.Receta_id DESC`;

    const resultado = await db.query(sql, params);
    const recetas = resultado.rows;

    // Si hay recetas, consultar los medicamentos asociados
    if (recetas.length > 0) {
      const recetaIds = recetas.map((r) => r.Receta_id);
      const placeholders = recetaIds.map(() => '?').join(',');

      const detallesRes = await db.query(
        `SELECT 
          Detalle_id,
          fk_receta_id,
          medicamento,
          dosis,
          via_administracion,
          via_administracion AS via,
          frecuencia,
          duracion
        FROM Detalles_Receta
        WHERE fk_receta_id IN (${placeholders})
        ORDER BY Detalle_id ASC`,
        recetaIds
      );

      const detallesPorReceta = new Map();
      detallesRes.rows.forEach((d) => {
        if (!detallesPorReceta.has(d.fk_receta_id)) {
          detallesPorReceta.set(d.fk_receta_id, []);
        }
        detallesPorReceta.get(d.fk_receta_id).push(d);
      });

      recetas.forEach((r) => {
        const meds = detallesPorReceta.get(r.Receta_id) || [];
        r.medicamentos = meds;
        r.detalles = meds;
      });
    }

    res.json(recetas);
  } catch (error) {
    console.error('Error al obtener recetas:', error);
    res.status(500).json({ error: 'Error al obtener las recetas médicas' });
  }
};

/**
 * Obtener detalle de una receta por su ID
 */
const obtenerRecetaPorId = async (req, res) => {
  const { id } = req.params;

  try {
    const recetaRes = await db.query(
      `SELECT 
        r.Receta_id,
        r.Receta_id AS folio,
        r.fk_consulta_id,
        r.indicaciones_generales,
        r.indicaciones_generales AS indicaciones,
        r.fecha_emision,
        r.fecha_emision AS fecha,
        p.No_expediente AS expediente,
        TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente,
        p.telefono AS paciente_telefono,
        p.Notas AS alergias,
        cl.Nombre AS clinica,
        pod.Nombre AS podologo_nombre,
        pod.Cedula_podologo AS podologo_cedula
      FROM Recetas r
      INNER JOIN Consultas c ON r.fk_consulta_id = c.Consulta_id
      INNER JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
      LEFT JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
      LEFT JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
      WHERE r.Receta_id = ?`,
      [id]
    );

    if (recetaRes.rows.length === 0) {
      return res.status(404).json({ error: 'Receta no encontrada' });
    }

    const receta = recetaRes.rows[0];

    const detallesRes = await db.query(
      `SELECT 
        Detalle_id,
        fk_receta_id,
        medicamento,
        dosis,
        via_administracion,
        via_administracion AS via,
        frecuencia,
        duracion
      FROM Detalles_Receta
      WHERE fk_receta_id = ?
      ORDER BY Detalle_id ASC`,
      [id]
    );

    receta.medicamentos = detallesRes.rows;
    receta.detalles = detallesRes.rows;

    res.json(receta);
  } catch (error) {
    console.error('Error al obtener receta por ID:', error);
    res.status(500).json({ error: 'Error al consultar la receta' });
  }
};

/**
 * Emitir una nueva receta médica con sus medicamentos
 */
const crearReceta = async (req, res) => {
  let {
    Receta_id,
    folio,
    fk_consulta_id,
    expediente,
    indicaciones_generales,
    indicaciones,
    medicamentos = [],
    detalles = [],
    fecha_emision
  } = req.body;

  try {
    // Si no se proporcionó fk_consulta_id directo pero sí expediente
    if (!fk_consulta_id && expediente) {
      const consultaExistente = await db.query(
        `SELECT Consulta_id FROM Consultas WHERE fk_no_expediente = ? ORDER BY fecha_hora DESC LIMIT 1`,
        [expediente]
      );

      if (consultaExistente.rows.length > 0) {
        fk_consulta_id = consultaExistente.rows[0].Consulta_id;
      } else {
        // Obtener clínica y podólogo por defecto
        const clinicaDefecto = await db.query(`SELECT Clinica_id FROM Clinicas LIMIT 1`);
        const podologoDefecto = await db.query(`SELECT Cedula_podologo FROM Podologos LIMIT 1`);
        const clinicaId = clinicaDefecto.rows[0]?.Clinica_id || 1;
        const podologoId = podologoDefecto.rows[0]?.Cedula_podologo || '0000001';

        const nuevaConsultaId = `CON${expediente}${Date.now().toString().slice(-4)}`;
        await db.query(
          `INSERT INTO Consultas (
            Consulta_id, fk_no_expediente, fk_clinica_id, fk_cedula_podologo,
            fecha_hora, estado, motivo_o_notas
          ) VALUES (?, ?, ?, ?, NOW(), 'Completada', 'Emisión de Receta Médica')`,
          [nuevaConsultaId, expediente, clinicaId, podologoId]
        );
        fk_consulta_id = nuevaConsultaId;
      }
    }

    if (!fk_consulta_id) {
      return res.status(400).json({ error: 'Se requiere fk_consulta_id o expediente del paciente' });
    }

    // Generar ID o Folio si no viene
    const recetaIdFinal =
      Receta_id ||
      folio ||
      `RX-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    const indicacionesFinal = indicaciones_generales || indicaciones || 'Ninguna especificada';

    // Insertar en tabla Recetas
    await db.query(
      `INSERT INTO Recetas (
        Receta_id,
        fk_consulta_id,
        indicaciones_generales,
        fecha_emision
      ) VALUES (?, ?, ?, COALESCE(?, NOW()))`,
      [recetaIdFinal, fk_consulta_id, indicacionesFinal, fecha_emision || null]
    );

    // Unificar lista de medicamentos
    const meds = Array.isArray(medicamentos) && medicamentos.length > 0 ? medicamentos : detalles;

    if (Array.isArray(meds) && meds.length > 0) {
      for (const m of meds) {
        if (!m.medicamento) continue;
        await db.query(
          `INSERT INTO Detalles_Receta (
            fk_receta_id,
            medicamento,
            dosis,
            via_administracion,
            frecuencia,
            duracion
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            recetaIdFinal,
            m.medicamento,
            m.dosis || 'Dosis indicada',
            m.via_administracion || m.via || 'Tópica',
            m.frecuencia || 'Cada 12 horas',
            m.duracion || '7 días'
          ]
        );
      }
    }

    // Registrar en Bitácora de Auditoría
    const usuarioResponsable =
      req.headers['x-usuario'] ||
      req.body?.usuario_responsable ||
      'Dr. Podólogo Titular';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    await registrarAuditoria({
      usuario_responsable: usuarioResponsable,
      accion_realizada: `Receta médica emitida exitosamente (Folio: ${recetaIdFinal}) con ${meds.length} medicamento(s)`,
      tabla_afectada: 'Recetas',
      direccion_ip: ip
    });
    req.auditoriaManual = true;

    res.status(201).json({
      mensaje: 'Receta emitida correctamente',
      Receta_id: recetaIdFinal,
      folio: recetaIdFinal,
      fk_consulta_id,
      medicamentos: meds
    });
  } catch (error) {
    console.error('Error al crear receta:', error);
    res.status(500).json({ error: 'Error al emitir la receta médica' });
  }
};

/**
 * Actualizar una receta existente
 */
const actualizarReceta = async (req, res) => {
  const { id } = req.params;
  const { indicaciones_generales, indicaciones } = req.body;

  try {
    const indicFinal = indicaciones_generales !== undefined ? indicaciones_generales : indicaciones;

    await db.query(
      `UPDATE Recetas SET indicaciones_generales = ? WHERE Receta_id = ?`,
      [indicFinal, id]
    );

    const usuarioResponsable = req.headers['x-usuario'] || 'Dr. Podólogo Titular';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    await registrarAuditoria({
      usuario_responsable: usuarioResponsable,
      accion_realizada: `Actualización de indicaciones en Receta ${id}`,
      tabla_afectada: 'Recetas',
      direccion_ip: ip
    });
    req.auditoriaManual = true;

    res.json({ mensaje: 'Receta actualizada con éxito' });
  } catch (error) {
    console.error('Error al actualizar receta:', error);
    res.status(500).json({ error: 'Error al actualizar la receta médica' });
  }
};

/**
 * Eliminar una receta
 */
const eliminarReceta = async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(`DELETE FROM Recetas WHERE Receta_id = ?`, [id]);

    const usuarioResponsable = req.headers['x-usuario'] || 'Dr. Podólogo Titular';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    await registrarAuditoria({
      usuario_responsable: usuarioResponsable,
      accion_realizada: `Eliminación de Receta médica ${id}`,
      tabla_afectada: 'Recetas',
      direccion_ip: ip
    });
    req.auditoriaManual = true;

    res.json({ mensaje: 'Receta médica eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar receta:', error);
    res.status(500).json({ error: 'Error al eliminar la receta médica' });
  }
};

module.exports = {
  obtenerRecetas,
  obtenerRecetaPorId,
  crearReceta,
  actualizarReceta,
  eliminarReceta
};
