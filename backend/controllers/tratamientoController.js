const db = require('../config/db');

// Obtener tratamientos por consulta
const obtenerTratamientosPorConsulta = async (req, res) => {
  const { consulta_id } = req.params;
  try {
    const resultado = await db.query(
      `SELECT * FROM Tratamientos WHERE fk_consulta_id = ? ORDER BY fecha_inicio DESC, Tratamiento_id ASC`,
      [consulta_id]
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener tratamientos:', error);
    res.status(500).json({ error: 'Error al obtener los tratamientos' });
  }
};

// Crear tratamiento
const crearTratamiento = async (req, res) => {
  const {
    Tratamiento_id,
    fk_consulta_id,
    procedimiento_servicio,
    pie_izquierdo,
    pie_derecho,
    tratamiento_aplicado,
    fecha_inicio,
    fecha_fin,
    frecuencia
  } = req.body;

  if (!fk_consulta_id || !procedimiento_servicio) {
    return res.status(400).json({ error: 'Consulta ID y procedimiento son obligatorios' });
  }

  try {
    const tratIdFinal = Tratamiento_id || `TR${fk_consulta_id}${Date.now().toString().slice(-4)}`;
    const fechaInicioFinal = fecha_inicio || new Date().toISOString().split('T')[0];

    await db.query(
      `INSERT INTO Tratamientos (
        Tratamiento_id, fk_consulta_id, procedimiento_servicio, pie_izquierdo, pie_derecho,
        tratamiento_aplicado, fecha_inicio, fecha_fin, frecuencia
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tratIdFinal,
        fk_consulta_id,
        procedimiento_servicio,
        pie_izquierdo ? 1 : 0,
        pie_derecho ? 1 : 0,
        tratamiento_aplicado || null,
        fechaInicioFinal,
        fecha_fin || null,
        frecuencia || 'Control periódico'
      ]
    );

    res.status(201).json({
      mensaje: 'Tratamiento registrado con éxito',
      Tratamiento_id: tratIdFinal
    });
  } catch (error) {
    console.error('Error al registrar tratamiento:', error);
    res.status(500).json({ error: 'Error al registrar el tratamiento' });
  }
};

// Eliminar tratamiento
const eliminarTratamiento = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM Tratamientos WHERE Tratamiento_id = ?', [id]);
    res.json({ mensaje: 'Tratamiento eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar tratamiento:', error);
    res.status(500).json({ error: 'Error al eliminar el tratamiento' });
  }
};

module.exports = {
  obtenerTratamientosPorConsulta,
  crearTratamiento,
  eliminarTratamiento
};
