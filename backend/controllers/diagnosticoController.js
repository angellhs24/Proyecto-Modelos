const db = require('../config/db');

// Obtener diagnósticos por consulta
const obtenerDiagnosticosPorConsulta = async (req, res) => {
  const { consulta_id } = req.params;
  try {
    const resultado = await db.query(
      `SELECT * FROM Diagnosticos WHERE fk_consulta_id = ? ORDER BY Diagnostico_id ASC`,
      [consulta_id]
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener diagnósticos:', error);
    res.status(500).json({ error: 'Error al obtener los diagnósticos' });
  }
};

// Crear diagnóstico
const crearDiagnostico = async (req, res) => {
  const {
    Diagnostico_id,
    fk_consulta_id,
    padecimiento,
    pie_izquierdo,
    pie_derecho,
    tipo_diagnostico,
    detalles_adicionales
  } = req.body;

  if (!fk_consulta_id || !padecimiento) {
    return res.status(400).json({ error: 'Consulta ID y padecimiento son obligatorios' });
  }

  try {
    const diagIdFinal = Diagnostico_id || `DX${fk_consulta_id}${Date.now().toString().slice(-4)}`;

    await db.query(
      `INSERT INTO Diagnosticos (
        Diagnostico_id, fk_consulta_id, padecimiento, pie_izquierdo, pie_derecho, tipo_diagnostico, detalles_adicionales
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        diagIdFinal,
        fk_consulta_id,
        padecimiento,
        pie_izquierdo ? 1 : 0,
        pie_derecho ? 1 : 0,
        tipo_diagnostico || 'Preventivo',
        detalles_adicionales || null
      ]
    );

    res.status(201).json({
      mensaje: 'Diagnóstico registrado con éxito',
      Diagnostico_id: diagIdFinal
    });
  } catch (error) {
    console.error('Error al crear diagnóstico:', error);
    res.status(500).json({ error: 'Error al registrar el diagnóstico' });
  }
};

// Eliminar diagnóstico
const eliminarDiagnostico = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM Diagnosticos WHERE Diagnostico_id = ?', [id]);
    res.json({ mensaje: 'Diagnóstico eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar diagnóstico:', error);
    res.status(500).json({ error: 'Error al eliminar el diagnóstico' });
  }
};

module.exports = {
  obtenerDiagnosticosPorConsulta,
  crearDiagnostico,
  eliminarDiagnostico
};
