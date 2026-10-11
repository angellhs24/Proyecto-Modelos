const db = require('../config/db');

/**
 * -------------------------------------------------------------
 * 1. AGENDA PERSONAL DEL PODÓLOGO (Solo sus consultas asignadas)
 * -------------------------------------------------------------
 * Filtra estrictamente por la cédula del podólogo que tiene sesión activa.
 */
const obtenerAgendaPersonal = async (req, res) => {
  try {
    const cedula = req.user?.cedula || req.user?.Cedula_podologo;

    if (!cedula) {
      return res.status(403).json({ error: 'No se encontró la cédula profesional asociada a este usuario podólogo' });
    }

    const { fecha, estado } = req.query;

    let sql = `
      SELECT c.Consulta_id, c.fk_no_expediente, c.fk_clinica_id, c.fk_cedula_podologo,
             c.fecha_hora, c.estado, c.motivo_o_notas,
             c.Peso, c.Altura, c.tipo_pisada, c.alineacion, c.observaciones,
             TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente_nombre,
             p.telefono AS paciente_telefono,
             p.Fecha_nacimiento, p.Sexo,
             p.es_diabetico, p.es_hipertenso,
             TIMESTAMPDIFF(YEAR, p.Fecha_nacimiento, CURDATE()) AS paciente_edad,
             cl.Nombre AS clinica_nombre
      FROM Consultas c
      JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
      JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
      WHERE c.fk_cedula_podologo = ?
    `;
    const params = [cedula];

    if (fecha) {
      sql += ` AND DATE(c.fecha_hora) = ?`;
      params.push(fecha);
    }

    if (estado) {
      sql += ` AND c.estado = ?`;
      params.push(estado);
    }

    sql += ` ORDER BY c.fecha_hora ASC`;

    const [rows] = await db.pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener agenda personal del podólogo:', error);
    res.status(500).json({ error: 'Error al consultar agenda personal' });
  }
};

// Actualizar estado de consulta (ej. 'En atención', 'Finalizada')
const actualizarEstadoConsulta = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  const cedula = req.user?.cedula || req.user?.Cedula_podologo;

  if (!estado) {
    return res.status(400).json({ error: 'El estado es obligatorio' });
  }

  try {
    const [result] = await db.pool.query(
      `UPDATE Consultas
       SET estado = ?
       WHERE Consulta_id = ? AND fk_cedula_podologo = ?`,
      [estado, id, cedula]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Consulta no encontrada o no pertenece a este podólogo' });
    }

    res.json({ mensaje: `Estado de consulta actualizado a "${estado}"`, Consulta_id: id });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al actualizar estado de la consulta' });
  }
};

// Registrar o actualizar exploración física y somatometría de la consulta
const registrarExploracionFisica = async (req, res) => {
  const { id } = req.params;
  const { Peso, Altura, tipo_pisada, alineacion, observaciones } = req.body;
  const cedula = req.user?.cedula || req.user?.Cedula_podologo;

  try {
    const [result] = await db.pool.query(
      `UPDATE Consultas
       SET Peso = ?,
           Altura = ?,
           tipo_pisada = ?,
           alineacion = ?,
           observaciones = ?
       WHERE Consulta_id = ? AND fk_cedula_podologo = ?`,
      [
        Peso ? parseFloat(Peso) : null,
        Altura ? parseFloat(Altura) : null,
        tipo_pisada || null,
        alineacion || null,
        observaciones || null,
        id,
        cedula
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Consulta no encontrada o no pertenece a este podólogo' });
    }

    res.json({ mensaje: 'Exploración física guardada correctamente', Consulta_id: id });
  } catch (error) {
    console.error('Error al registrar exploración física:', error);
    res.status(500).json({ error: 'Error al guardar la exploración física' });
  }
};

/**
 * -------------------------------------------------------------
 * 2. EXPEDIENTE CLÍNICO
 * -------------------------------------------------------------
 */

// Obtener expediente clínico completo del paciente
const obtenerExpedienteClinico = async (req, res) => {
  const { expediente } = req.params;

  try {
    // 1. Datos del Paciente (incluyendo antecedentes patológicos y clínicos)
    const [pacientes] = await db.pool.query(
      `SELECT No_expediente, Nombres, ape_paterno, ape_materno,
              TRIM(CONCAT(Nombres, ' ', ape_paterno, ' ', COALESCE(ape_materno, ''))) AS nombre_completo,
              telefono, Fecha_nacimiento, Sexo, Calzado, Calle_direccion, Municipio, Ocupacion,
              es_diabetico, es_hipertenso, Antecedentes_patologicos, Notas, Fecha_registro,
              TIMESTAMPDIFF(YEAR, Fecha_nacimiento, CURDATE()) AS edad
       FROM Pacientes
       WHERE No_expediente = ?`,
      [expediente]
    );

    if (pacientes.length === 0) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    const paciente = pacientes[0];

    // 2. Historial de Consultas del Paciente
    const [consultas] = await db.pool.query(
      `SELECT c.Consulta_id, c.fecha_hora, c.estado, c.motivo_o_notas,
              c.Peso, c.Altura, c.tipo_pisada, c.alineacion, c.observaciones,
              TRIM(CONCAT(pod.Nombre, ' ', pod.ape_paterno)) AS podologo_nombre,
              cl.Nombre AS clinica_nombre
       FROM Consultas c
       JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
       JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
       WHERE c.fk_no_expediente = ?
       ORDER BY c.fecha_hora DESC`,
      [expediente]
    );

    // 3. Diagnósticos acumulados del paciente
    const [diagnosticos] = await db.pool.query(
      `SELECT d.*, c.fecha_hora AS fecha_consulta
       FROM Diagnosticos d
       JOIN Consultas c ON d.fk_consulta_id = c.Consulta_id
       WHERE c.fk_no_expediente = ?
       ORDER BY c.fecha_hora DESC`,
      [expediente]
    );

    // 4. Tratamientos acumulados del paciente
    const [tratamientos] = await db.pool.query(
      `SELECT t.*, c.fecha_hora AS fecha_consulta
       FROM Tratamientos t
       JOIN Consultas c ON t.fk_consulta_id = c.Consulta_id
       WHERE c.fk_no_expediente = ?
       ORDER BY c.fecha_hora DESC`,
      [expediente]
    );

    // 5. Hallazgos del mapa podológico acumulados
    const [mapaHallazgos] = await db.pool.query(
      `SELECT m.*, c.fecha_hora AS fecha_consulta
       FROM Detalles_Mapa_Podologico m
       JOIN Consultas c ON m.fk_consulta_id = c.Consulta_id
       WHERE c.fk_no_expediente = ?
       ORDER BY c.fecha_hora DESC`,
      [expediente]
    );

    // 6. Recetas emitidas
    const [recetas] = await db.pool.query(
      `SELECT r.Receta_id, r.fk_consulta_id, r.indicaciones_generales, r.fecha_emision,
              c.fecha_hora AS fecha_consulta
       FROM Recetas r
       JOIN Consultas c ON r.fk_consulta_id = c.Consulta_id
       WHERE c.fk_no_expediente = ?
       ORDER BY r.fecha_emision DESC`,
      [expediente]
    );

    res.json({
      paciente,
      consultas,
      diagnosticos,
      tratamientos,
      mapaHallazgos,
      recetas
    });
  } catch (error) {
    console.error('Error al obtener expediente clínico:', error);
    res.status(500).json({ error: 'Error al consultar expediente clínico' });
  }
};

// Actualizar información clínica y antecedentes del paciente
const actualizarHistorialClinico = async (req, res) => {
  const { expediente } = req.params;
  const {
    es_diabetico,
    es_hipertenso,
    Antecedentes_patologicos,
    Notas,
    Calzado
  } = req.body;

  try {
    const [result] = await db.pool.query(
      `UPDATE Pacientes
       SET es_diabetico = ?,
           es_hipertenso = ?,
           Antecedentes_patologicos = ?,
           Notas = ?,
           Calzado = ?
       WHERE No_expediente = ?`,
      [
        es_diabetico === true || es_diabetico === 1,
        es_hipertenso === true || es_hipertenso === 1,
        Antecedentes_patologicos || null,
        Notas || null,
        Calzado ? parseFloat(Calzado) : null,
        expediente
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    res.json({ mensaje: 'Historial clínico del paciente actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar historial clínico:', error);
    res.status(500).json({ error: 'Error al actualizar historial clínico' });
  }
};

// CRUD Diagnósticos por consulta
const obtenerDiagnosticosConsulta = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.pool.query(
      `SELECT * FROM Diagnosticos WHERE fk_consulta_id = ? ORDER BY Diagnostico_id DESC`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener diagnósticos:', error);
    res.status(500).json({ error: 'Error al consultar diagnósticos' });
  }
};

const agregarDiagnostico = async (req, res) => {
  const { id } = req.params;
  const {
    padecimiento,
    pie_izquierdo = false,
    pie_derecho = false,
    tipo_diagnostico = 'Presuntivo',
    detalles_adicionales
  } = req.body;

  if (!padecimiento) {
    return res.status(400).json({ error: 'El nombre del padecimiento es obligatorio' });
  }

  try {
    const diagId = req.body.Diagnostico_id || `DX-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    await db.pool.query(
      `INSERT INTO Diagnosticos (
        Diagnostico_id,
        fk_consulta_id,
        padecimiento,
        pie_izquierdo,
        pie_derecho,
        tipo_diagnostico,
        detalles_adicionales
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        diagId,
        id,
        padecimiento.trim(),
        Boolean(pie_izquierdo),
        Boolean(pie_derecho),
        tipo_diagnostico || 'Clínico',
        detalles_adicionales || null
      ]
    );

    res.status(201).json({
      mensaje: 'Diagnóstico registrado exitosamente',
      diagnostico: {
        Diagnostico_id: diagId,
        fk_consulta_id: id,
        padecimiento,
        pie_izquierdo,
        pie_derecho,
        tipo_diagnostico,
        detalles_adicionales
      }
    });
  } catch (error) {
    console.error('Error al agregar diagnóstico:', error);
    res.status(500).json({ error: 'Error al registrar el diagnóstico' });
  }
};

const eliminarDiagnostico = async (req, res) => {
  const { diagId } = req.params;
  try {
    await db.pool.query(`DELETE FROM Diagnosticos WHERE Diagnostico_id = ?`, [diagId]);
    res.json({ mensaje: 'Diagnóstico eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar diagnóstico:', error);
    res.status(500).json({ error: 'Error al eliminar el diagnóstico' });
  }
};

// CRUD Tratamientos por consulta
const obtenerTratamientosConsulta = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.pool.query(
      `SELECT * FROM Tratamientos WHERE fk_consulta_id = ? ORDER BY Tratamiento_id DESC`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener tratamientos:', error);
    res.status(500).json({ error: 'Error al consultar tratamientos' });
  }
};

const agregarTratamiento = async (req, res) => {
  const { id } = req.params;
  const {
    procedimiento_servicio,
    pie_izquierdo = false,
    pie_derecho = false,
    tratamiento_aplicado,
    fecha_inicio,
    fecha_fin,
    frecuencia
  } = req.body;

  if (!procedimiento_servicio) {
    return res.status(400).json({ error: 'El nombre del procedimiento o servicio es obligatorio' });
  }

  try {
    const tratId = req.body.Tratamiento_id || `TRT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    await db.pool.query(
      `INSERT INTO Tratamientos (
        Tratamiento_id,
        fk_consulta_id,
        procedimiento_servicio,
        pie_izquierdo,
        pie_derecho,
        tratamiento_aplicado,
        fecha_inicio,
        fecha_fin,
        frecuencia
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tratId,
        id,
        procedimiento_servicio.trim(),
        Boolean(pie_izquierdo),
        Boolean(pie_derecho),
        tratamiento_aplicado || null,
        fecha_inicio || new Date().toISOString().split('T')[0],
        fecha_fin || null,
        frecuencia || null
      ]
    );

    res.status(201).json({
      mensaje: 'Tratamiento registrado exitosamente',
      tratamiento: {
        Tratamiento_id: tratId,
        fk_consulta_id: id,
        procedimiento_servicio,
        pie_izquierdo,
        pie_derecho,
        tratamiento_aplicado,
        fecha_inicio,
        fecha_fin,
        frecuencia
      }
    });
  } catch (error) {
    console.error('Error al agregar tratamiento:', error);
    res.status(500).json({ error: 'Error al registrar el tratamiento' });
  }
};

const eliminarTratamiento = async (req, res) => {
  const { tratId } = req.params;
  try {
    await db.pool.query(`DELETE FROM Tratamientos WHERE Tratamiento_id = ?`, [tratId]);
    res.json({ mensaje: 'Tratamiento eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar tratamiento:', error);
    res.status(500).json({ error: 'Error al eliminar el tratamiento' });
  }
};

// Recetas por consulta
const obtenerRecetasConsulta = async (req, res) => {
  const { id } = req.params;
  try {
    const [recetas] = await db.pool.query(
      `SELECT * FROM Recetas WHERE fk_consulta_id = ? ORDER BY fecha_emision DESC`,
      [id]
    );

    for (const r of recetas) {
      const [detalles] = await db.pool.query(
        `SELECT * FROM Detalles_Receta WHERE fk_receta_id = ?`,
        [r.Receta_id]
      );
      r.detalles = detalles;
    }

    res.json(recetas);
  } catch (error) {
    console.error('Error al obtener recetas:', error);
    res.status(500).json({ error: 'Error al consultar recetas médicas' });
  }
};

const crearReceta = async (req, res) => {
  const { id } = req.params;
  const { indicaciones_generales, medicamentos = [] } = req.body;

  try {
    const recetaId = req.body.Receta_id || `REC-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    await db.pool.query(
      `INSERT INTO Recetas (Receta_id, fk_consulta_id, indicaciones_generales, fecha_emision)
       VALUES (?, ?, ?, NOW())`,
      [recetaId, id, indicaciones_generales || 'Seguir indicaciones especificadas']
    );

    if (Array.isArray(medicamentos) && medicamentos.length > 0) {
      for (const med of medicamentos) {
        if (med.medicamento && med.dosis) {
          await db.pool.query(
            `INSERT INTO Detalles_Receta (
              fk_receta_id, medicamento, dosis, via_administracion, frecuencia, duracion
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              recetaId,
              med.medicamento,
              med.dosis,
              med.via_administracion || 'Tópica',
              med.frecuencia || 'Cada 12 horas',
              med.duracion || '7 días'
            ]
          );
        }
      }
    }

    res.status(201).json({
      mensaje: 'Receta podológica emitida con éxito',
      Receta_id: recetaId
    });
  } catch (error) {
    console.error('Error al emitir receta:', error);
    res.status(500).json({ error: 'Error al emitir la receta podológica' });
  }
};

/**
 * -------------------------------------------------------------
 * 3. MAPA PODOLÓGICO INTERACTIVO (Detalles_Mapa_Podologico)
 * -------------------------------------------------------------
 */

// Obtener todas las lesiones registradas en el mapa para una consulta
const obtenerMapaConsulta = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.pool.query(
      `SELECT Mapa_id, fk_consulta_id, zona_pie, tipo_lesion, observaciones
       FROM Detalles_Mapa_Podologico
       WHERE fk_consulta_id = ?
       ORDER BY Mapa_id ASC`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener mapa podológico:', error);
    res.status(500).json({ error: 'Error al consultar detalles del mapa podológico' });
  }
};

// Registrar una nueva lesión en el mapa podológico interactivo
const registrarDetalleMapa = async (req, res) => {
  const { id } = req.params;
  const { zona_pie, tipo_lesion, observaciones } = req.body;

  if (!zona_pie || !tipo_lesion) {
    return res.status(400).json({ error: 'Zona del pie y Tipo de Lesión son obligatorios' });
  }

  try {
    const [result] = await db.pool.query(
      `INSERT INTO Detalles_Mapa_Podologico (
        fk_consulta_id,
        zona_pie,
        tipo_lesion,
        observaciones
      ) VALUES (?, ?, ?, ?)`,
      [id, zona_pie.trim(), tipo_lesion.trim(), observaciones ? observaciones.trim() : null]
    );

    res.status(201).json({
      mensaje: 'Hallazgo podológico registrado en el Mapa',
      detalle: {
        Mapa_id: result.insertId,
        fk_consulta_id: id,
        zona_pie,
        tipo_lesion,
        observaciones
      }
    });
  } catch (error) {
    console.error('Error al registrar detalle en mapa podológico:', error);
    res.status(500).json({ error: 'Error al guardar el hallazgo en el mapa podológico' });
  }
};

// Eliminar lesión del mapa
const eliminarDetalleMapa = async (req, res) => {
  const { mapaId } = req.params;
  try {
    await db.pool.query(
      `DELETE FROM Detalles_Mapa_Podologico WHERE Mapa_id = ?`,
      [mapaId]
    );
    res.json({ mensaje: 'Hallazgo eliminado del mapa podológico', Mapa_id: mapaId });
  } catch (error) {
    console.error('Error al eliminar hallazgo del mapa:', error);
    res.status(500).json({ error: 'Error al eliminar el registro del mapa podológico' });
  }
};

module.exports = {
  obtenerAgendaPersonal,
  actualizarEstadoConsulta,
  registrarExploracionFisica,
  obtenerExpedienteClinico,
  actualizarHistorialClinico,
  obtenerDiagnosticosConsulta,
  agregarDiagnostico,
  eliminarDiagnostico,
  obtenerTratamientosConsulta,
  agregarTratamiento,
  eliminarTratamiento,
  obtenerRecetasConsulta,
  crearReceta,
  obtenerMapaConsulta,
  registrarDetalleMapa,
  eliminarDetalleMapa
};
