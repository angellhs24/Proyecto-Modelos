const db = require('../config/db');

// Obtener todas las clínicas (opcionalmente filtradas por activas)
const obtenerClinicas = async (req, res) => {
  try {
    const { todas } = req.query;
    const sql = todas === 'true'
      ? `SELECT Clinica_id, Clinica_id AS id_clinica, Nombre, Nombre AS nombre, 
                Calle_clinica, Municipio_clinica, 
                CONCAT_WS(', ', Calle_clinica, Municipio_clinica) AS direccion, 
                Telefono, Telefono AS telefono, Activa 
         FROM Clinicas 
         ORDER BY Clinica_id ASC`
      : `SELECT Clinica_id, Clinica_id AS id_clinica, Nombre, Nombre AS nombre, 
                Calle_clinica, Municipio_clinica, 
                CONCAT_WS(', ', Calle_clinica, Municipio_clinica) AS direccion, 
                Telefono, Telefono AS telefono, Activa 
         FROM Clinicas 
         WHERE Activa = 1 
         ORDER BY Clinica_id ASC`;

    const resultado = await db.query(sql);
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener clínicas:', error);
    res.status(500).json({ error: 'Error al obtener las clínicas' });
  }
};

// Obtener una clínica por ID
const obtenerClinicaPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await db.query(
      `SELECT Clinica_id, Clinica_id AS id_clinica, Nombre, Nombre AS nombre, 
              Calle_clinica, Municipio_clinica, 
              CONCAT_WS(', ', Calle_clinica, Municipio_clinica) AS direccion, 
              Telefono, Telefono AS telefono, Activa 
       FROM Clinicas 
       WHERE Clinica_id = ?`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Clínica no encontrada' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al obtener clínica:', error);
    res.status(500).json({ error: 'Error al obtener la clínica' });
  }
};

// Registrar una nueva clínica
const crearClinica = async (req, res) => {
  const { Nombre, nombre, Calle_clinica, calle_clinica, direccion, Municipio_clinica, municipio_clinica, Telefono, telefono, Activa, activa } = req.body;

  const nombreFinal = Nombre || nombre;
  const calleFinal = Calle_clinica || calle_clinica || direccion || null;
  const municipioFinal = Municipio_clinica || municipio_clinica || null;
  const telFinal = Telefono || telefono || null;
  const activaFinal = Activa !== undefined ? Activa : (activa !== undefined ? activa : 1);

  if (!nombreFinal) {
    return res.status(400).json({ error: 'El nombre de la clínica es obligatorio' });
  }

  try {
    const resultado = await db.query(
      `INSERT INTO Clinicas (Nombre, Calle_clinica, Municipio_clinica, Telefono, Activa) 
       VALUES (?, ?, ?, ?, ?)`,
      [nombreFinal, calleFinal, municipioFinal, telFinal, activaFinal]
    );

    res.status(201).json({
      mensaje: 'Clínica registrada con éxito',
      Clinica_id: resultado.rows.insertId,
      id_clinica: resultado.rows.insertId,
      clinica: {
        Clinica_id: resultado.rows.insertId,
        Nombre: nombreFinal,
        Calle_clinica: calleFinal,
        Municipio_clinica: municipioFinal,
        Telefono: telFinal,
        Activa: activaFinal
      }
    });
  } catch (error) {
    console.error('Error al crear clínica:', error);
    res.status(500).json({ error: 'Error al registrar la clínica' });
  }
};

// Actualizar una clínica
const actualizarClinica = async (req, res) => {
  const { id } = req.params;
  const { Nombre, Calle_clinica, Municipio_clinica, Telefono, Activa } = req.body;

  try {
    await db.query(
      `UPDATE Clinicas 
       SET Nombre = COALESCE(?, Nombre),
           Calle_clinica = COALESCE(?, Calle_clinica),
           Municipio_clinica = COALESCE(?, Municipio_clinica),
           Telefono = COALESCE(?, Telefono),
           Activa = COALESCE(?, Activa)
       WHERE Clinica_id = ?`,
      [Nombre, Calle_clinica, Municipio_clinica, Telefono, Activa, id]
    );

    res.json({ mensaje: 'Clínica actualizada con éxito' });
  } catch (error) {
    console.error('Error al actualizar clínica:', error);
    res.status(500).json({ error: 'Error al actualizar la clínica' });
  }
};

// Desactivar o eliminar clínica
const eliminarClinica = async (req, res) => {
  const { id } = req.params;
  try {
    // Soft delete para mantener integridad referencial
    await db.query('UPDATE Clinicas SET Activa = 0 WHERE Clinica_id = ?', [id]);
    res.json({ mensaje: 'Clínica desactivada correctamente' });
  } catch (error) {
    console.error('Error al eliminar clínica:', error);
    res.status(500).json({ error: 'Error al procesar la eliminación' });
  }
};

module.exports = {
  obtenerClinicas,
  obtenerClinicaPorId,
  crearClinica,
  actualizarClinica,
  eliminarClinica
};