const db = require('../config/db');

// Obtener documentos por consulta
const obtenerDocumentosPorConsulta = async (req, res) => {
  const { consulta_id } = req.params;
  try {
    const resultado = await db.query(
      `SELECT * FROM Documentos_escaneados WHERE fk_consulta_id = ? ORDER BY fecha_subida DESC, Documento_id ASC`,
      [consulta_id]
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener documentos:', error);
    res.status(500).json({ error: 'Error al obtener los documentos' });
  }
};

// Registrar documento escaneado
const crearDocumento = async (req, res) => {
  const {
    Documento_id,
    fk_consulta_id,
    tipo_documento,
    url_archivo,
    fecha_subida
  } = req.body;

  if (!fk_consulta_id || !url_archivo) {
    return res.status(400).json({ error: 'Consulta ID y URL del archivo son requeridos' });
  }

  try {
    const docIdFinal = Documento_id || `DOC${fk_consulta_id}${Date.now().toString().slice(-4)}`;
    const fechaFinal = fecha_subida || new Date().toISOString().split('T')[0];

    await db.query(
      `INSERT INTO Documentos_escaneados (
        Documento_id, fk_consulta_id, tipo_documento, url_archivo, fecha_subida
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        docIdFinal,
        fk_consulta_id,
        tipo_documento || 'Consentimiento Informado',
        url_archivo,
        fechaFinal
      ]
    );

    res.status(201).json({
      mensaje: 'Documento registrado con éxito',
      Documento_id: docIdFinal
    });
  } catch (error) {
    console.error('Error al registrar documento:', error);
    res.status(500).json({ error: 'Error al registrar el documento' });
  }
};

// Eliminar documento
const eliminarDocumento = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM Documentos_escaneados WHERE Documento_id = ?', [id]);
    res.json({ mensaje: 'Documento eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar documento:', error);
    res.status(500).json({ error: 'Error al eliminar el documento' });
  }
};

module.exports = {
  obtenerDocumentosPorConsulta,
  crearDocumento,
  eliminarDocumento
};
