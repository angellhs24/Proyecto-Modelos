const db = require('../config/db');

/**
 * Registra una acción en la tabla Bitacora_Auditoria de MySQL.
 * @param {Object} param0
 * @param {number|string} [param0.fk_usuario_id]
 * @param {string} param0.accion_realizada
 * @param {string} param0.tabla_afectada
 * @param {string} [param0.direccion_ip]
 */
async function registrarAuditoria({
  fk_usuario_id = 1,
  accion_realizada = 'Acción no especificada',
  tabla_afectada = 'General',
  direccion_ip = '127.0.0.1'
}) {
  try {
    const usuarioId = parseInt(fk_usuario_id, 10) || 1;
    const accion = String(accion_realizada || 'Acción').slice(0, 255);
    const tabla = String(tabla_afectada || 'General').slice(0, 50);
    const ip = String(direccion_ip || '127.0.0.1').slice(0, 45);

    await db.query(
      `INSERT INTO Bitacora_Auditoria (
        fk_usuario_id,
        accion_realizada,
        tabla_afectada,
        fecha_hora,
        direccion_ip
      ) VALUES (?, ?, ?, NOW(), ?)`,
      [usuarioId, accion, tabla, ip]
    );
  } catch (error) {
    console.error('Error al registrar en Bitacora_Auditoria:', error.message);
  }
}

module.exports = {
  registrarAuditoria
};

