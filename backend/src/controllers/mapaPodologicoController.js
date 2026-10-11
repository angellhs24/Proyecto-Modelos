const db = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoria');

/**
 * Obtener detalles del mapa podológico (todos o filtrados por consulta)
 */
const obtenerDetallesMapa = async (req, res) => {
  try {
    const { fk_consulta_id, expediente } = req.query;

    let sql = `
      SELECT 
        m.Mapa_id,
        m.Mapa_id AS id,
        m.fk_consulta_id,
        m.zona_pie,
        m.tipo_lesion,
        m.observaciones,
        c.fecha_hora AS fecha_consulta,
        p.No_expediente AS expediente,
        TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente_nombre
      FROM Detalles_Mapa_Podologico m
      INNER JOIN Consultas c ON m.fk_consulta_id = c.Consulta_id
      INNER JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
      WHERE 1=1
    `;
    const params = [];

    if (fk_consulta_id) {
      sql += ` AND m.fk_consulta_id = ?`;
      params.push(fk_consulta_id);
    }

    if (expediente) {
      sql += ` AND p.No_expediente = ?`;
      params.push(expediente);
    }

    sql += ` ORDER BY m.Mapa_id ASC`;

    const resultado = await db.query(sql, params);
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener detalles del mapa podológico:', error);
    res.status(500).json({ error: 'Error al consultar las lesiones del mapa podológico' });
  }
};

/**
 * Obtener lesiones registradas para una consulta específica
 */
const obtenerPorConsulta = async (req, res) => {
  const { consulta_id } = req.params;

  try {
    const resultado = await db.query(
      `SELECT 
        Mapa_id,
        Mapa_id AS id,
        fk_consulta_id,
        zona_pie,
        tipo_lesion,
        observaciones
      FROM Detalles_Mapa_Podologico
      WHERE fk_consulta_id = ?
      ORDER BY Mapa_id ASC`,
      [consulta_id]
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener mapa por consulta:', error);
    res.status(500).json({ error: 'Error al consultar las lesiones de la consulta' });
  }
};

/**
 * Registrar una lesión individual o un lote (batch) de lesiones en el mapa podológico
 */
const crearDetalleMapa = async (req, res) => {
  let {
    fk_consulta_id,
    expediente,
    zona_pie,
    tipo_lesion,
    observaciones,
    lesiones = []
  } = req.body;

  try {
    // Si no viene fk_consulta_id directo pero sí expediente, vincular con la última consulta
    if (!fk_consulta_id && expediente) {
      const consultaExistente = await db.query(
        `SELECT Consulta_id FROM Consultas WHERE fk_no_expediente = ? ORDER BY fecha_hora DESC LIMIT 1`,
        [expediente]
      );

      if (consultaExistente.rows.length > 0) {
        fk_consulta_id = consultaExistente.rows[0].Consulta_id;
      } else {
        const clinicaDefecto = await db.query(`SELECT Clinica_id FROM Clinicas LIMIT 1`);
        const podologoDefecto = await db.query(`SELECT Cedula_podologo FROM Podologos LIMIT 1`);
        const clinicaId = clinicaDefecto.rows[0]?.Clinica_id || 1;
        const podologoId = podologoDefecto.rows[0]?.Cedula_podologo || '0000001';

        const nuevaConsultaId = `CON${expediente}${Date.now().toString().slice(-4)}`;
        await db.query(
          `INSERT INTO Consultas (
            Consulta_id, fk_no_expediente, fk_clinica_id, fk_cedula_podologo,
            fecha_hora, estado, motivo_o_notas
          ) VALUES (?, ?, ?, ?, NOW(), 'Completada', 'Exploración Plantar y Mapa Podológico')`,
          [nuevaConsultaId, expediente, clinicaId, podologoId]
        );
        fk_consulta_id = nuevaConsultaId;
      }
    }

    if (!fk_consulta_id) {
      return res.status(400).json({ error: 'Se requiere fk_consulta_id o expediente del paciente' });
    }

    const usuarioResponsable = req.headers['x-usuario'] || 'Dr. Podólogo Titular';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    // Inserción en lote si viene un arreglo de lesiones
    if (Array.isArray(lesiones) && lesiones.length > 0) {
      const insertados = [];
      for (const item of lesiones) {
        if (!item.zona_pie || !item.tipo_lesion) continue;

        const resInsert = await db.query(
          `INSERT INTO Detalles_Mapa_Podologico (
            fk_consulta_id,
            zona_pie,
            tipo_lesion,
            observaciones
          ) VALUES (?, ?, ?, ?)`,
          [fk_consulta_id, item.zona_pie, item.tipo_lesion, item.observaciones || null]
        );

        insertados.push({
          Mapa_id: resInsert.rows?.insertId || resInsert.fields?.insertId,
          zona_pie: item.zona_pie,
          tipo_lesion: item.tipo_lesion
        });
      }

      await registrarAuditoria({
        usuario_responsable: usuarioResponsable,
        accion_realizada: `Registro de odontograma podológico en Consulta ${fk_consulta_id} con ${insertados.length} lesión(es)`,
        tabla_afectada: 'Detalles_Mapa_Podologico',
        direccion_ip: ip
      });
      req.auditoriaManual = true;

      return res.status(201).json({
        mensaje: `${insertados.length} marcas registradas exitosamente en el mapa podológico`,
        fk_consulta_id,
        lesiones: insertados
      });
    }

    // Inserción individual
    if (!zona_pie || !tipo_lesion) {
      return res.status(400).json({ error: 'Los campos zona_pie y tipo_lesion son obligatorios' });
    }

    const insertRes = await db.query(
      `INSERT INTO Detalles_Mapa_Podologico (
        fk_consulta_id,
        zona_pie,
        tipo_lesion,
        observaciones
      ) VALUES (?, ?, ?, ?)`,
      [fk_consulta_id, zona_pie, tipo_lesion, observaciones || null]
    );

    const mapaId = insertRes.rows?.insertId || insertRes.fields?.insertId;

    await registrarAuditoria({
      usuario_responsable: usuarioResponsable,
      accion_realizada: `Lesión registrada en mapa podológico: ${tipo_lesion} en ${zona_pie} (Consulta: ${fk_consulta_id})`,
      tabla_afectada: 'Detalles_Mapa_Podologico',
      direccion_ip: ip
    });
    req.auditoriaManual = true;

    res.status(201).json({
      mensaje: 'Lesión registrada correctamente en el mapa',
      Mapa_id: mapaId,
      id: mapaId,
      fk_consulta_id,
      zona_pie,
      tipo_lesion,
      observaciones
    });
  } catch (error) {
    console.error('Error al registrar lesión en mapa podológico:', error);
    res.status(500).json({ error: 'Error al registrar la lesión en el mapa' });
  }
};

/**
 * Actualizar una lesión del mapa podológico
 */
const actualizarDetalleMapa = async (req, res) => {
  const { id } = req.params;
  const { zona_pie, tipo_lesion, observaciones } = req.body;

  try {
    const lesionRes = await db.query(`SELECT * FROM Detalles_Mapa_Podologico WHERE Mapa_id = ?`, [id]);
    if (lesionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Detalle de mapa no encontrado' });
    }

    const act = lesionRes.rows[0];
    const zonaFinal = zona_pie || act.zona_pie;
    const tipoFinal = tipo_lesion || act.tipo_lesion;
    const obsFinal = observaciones !== undefined ? observaciones : act.observaciones;

    await db.query(
      `UPDATE Detalles_Mapa_Podologico SET
        zona_pie = ?,
        tipo_lesion = ?,
        observaciones = ?
      WHERE Mapa_id = ?`,
      [zonaFinal, tipoFinal, obsFinal, id]
    );

    const usuarioResponsable = req.headers['x-usuario'] || 'Dr. Podólogo Titular';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    await registrarAuditoria({
      usuario_responsable: usuarioResponsable,
      accion_realizada: `Actualización de marca en mapa podológico #${id}: ${tipoFinal} en ${zonaFinal}`,
      tabla_afectada: 'Detalles_Mapa_Podologico',
      direccion_ip: ip
    });
    req.auditoriaManual = true;

    res.json({ mensaje: 'Detalle de mapa actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar detalle de mapa:', error);
    res.status(500).json({ error: 'Error al actualizar el detalle del mapa' });
  }
};

/**
 * Eliminar una lesión específica del mapa podológico
 */
const eliminarDetalleMapa = async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(`DELETE FROM Detalles_Mapa_Podologico WHERE Mapa_id = ?`, [id]);

    const usuarioResponsable = req.headers['x-usuario'] || 'Dr. Podólogo Titular';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    await registrarAuditoria({
      usuario_responsable: usuarioResponsable,
      accion_realizada: `Eliminación de marca en mapa podológico #${id}`,
      tabla_afectada: 'Detalles_Mapa_Podologico',
      direccion_ip: ip
    });
    req.auditoriaManual = true;

    res.json({ mensaje: 'Lesión eliminada correctamente del mapa' });
  } catch (error) {
    console.error('Error al eliminar detalle de mapa:', error);
    res.status(500).json({ error: 'Error al eliminar la lesión del mapa' });
  }
};

/**
 * Limpiar todas las lesiones del mapa de una consulta
 */
const limpiarMapaPorConsulta = async (req, res) => {
  const { consulta_id } = req.params;

  try {
    await db.query(`DELETE FROM Detalles_Mapa_Podologico WHERE fk_consulta_id = ?`, [consulta_id]);

    const usuarioResponsable = req.headers['x-usuario'] || 'Dr. Podólogo Titular';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    await registrarAuditoria({
      usuario_responsable: usuarioResponsable,
      accion_realizada: `Reinicio / Limpieza completa del mapa podológico de la Consulta ${consulta_id}`,
      tabla_afectada: 'Detalles_Mapa_Podologico',
      direccion_ip: ip
    });
    req.auditoriaManual = true;

    res.json({ mensaje: 'Mapa podológico de la consulta limpiado correctamente' });
  } catch (error) {
    console.error('Error al limpiar mapa de consulta:', error);
    res.status(500).json({ error: 'Error al reiniciar el mapa podológico' });
  }
};

module.exports = {
  obtenerDetallesMapa,
  obtenerPorConsulta,
  crearDetalleMapa,
  actualizarDetalleMapa,
  eliminarDetalleMapa,
  limpiarMapaPorConsulta
};
