const db = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoria');

// Obtener logs de auditoría con filtros y paginación
const obtenerLogs = async (req, res) => {
  try {
    const { tabla, usuario, q, limit = 100, offset = 0 } = req.query;

    let sql = `
      SELECT 
        Log_id,
        usuario_responsable,
        accion_realizada,
        tabla_afectada,
        fecha_hora,
        direccion_ip
      FROM Bitacora_Auditoria
      WHERE 1=1
    `;
    const params = [];

    if (tabla) {
      sql += ` AND tabla_afectada = ?`;
      params.push(tabla);
    }

    if (usuario) {
      sql += ` AND usuario_responsable LIKE ?`;
      params.push(`%${usuario}%`);
    }

    if (q) {
      sql += ` AND (accion_realizada LIKE ? OR usuario_responsable LIKE ? OR tabla_afectada LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    sql += ` ORDER BY fecha_hora DESC, Log_id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const resultado = await db.query(sql, params);

    // Contar total para métricas
    const totalRes = await db.query(`SELECT COUNT(*) AS total FROM Bitacora_Auditoria`);
    const total = totalRes.rows[0]?.total || 0;

    res.json({
      total,
      logs: resultado.rows
    });
  } catch (error) {
    console.error('Error al obtener bitácora de auditoría:', error);
    res.status(500).json({ error: 'Error al obtener la bitácora de auditoría' });
  }
};

// Crear log manual de auditoría (opcional)
const crearLog = async (req, res) => {
  const { usuario_responsable, accion_realizada, tabla_afectada, direccion_ip } = req.body;

  if (!accion_realizada) {
    return res.status(400).json({ error: 'El campo accion_realizada es obligatorio' });
  }

  try {
    const ip = direccion_ip || req.ip || '127.0.0.1';
    await registrarAuditoria({
      usuario_responsable: usuario_responsable || 'Usuario',
      accion_realizada,
      tabla_afectada: tabla_afectada || 'General',
      direccion_ip: ip
    });

    req.auditoriaManual = true; // evitar doble registro
    res.status(201).json({ mensaje: 'Registro de auditoría guardado con éxito' });
  } catch (error) {
    console.error('Error al registrar log de auditoría:', error);
    res.status(500).json({ error: 'Error al registrar en la bitácora' });
  }
};

// Obtener estadísticas de auditoría para el dashboard de seguridad
const obtenerEstadisticas = async (req, res) => {
  try {
    const [total, hoy, porTabla, usuarios] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total FROM Bitacora_Auditoria`),
      db.query(`SELECT COUNT(*) AS hoy FROM Bitacora_Auditoria WHERE DATE(fecha_hora) = CURDATE()`),
      db.query(`
        SELECT tabla_afectada, COUNT(*) AS count 
        FROM Bitacora_Auditoria 
        GROUP BY tabla_afectada 
        ORDER BY count DESC 
        LIMIT 6
      `),
      db.query(`SELECT COUNT(DISTINCT usuario_responsable) AS usuarios_unicos FROM Bitacora_Auditoria`)
    ]);

    res.json({
      total: total.rows[0]?.total || 0,
      hoy: hoy.rows[0]?.hoy || 0,
      usuarios_activos: usuarios.rows[0]?.usuarios_unicos || 0,
      actividad_por_tabla: porTabla.rows
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de auditoría:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de auditoría' });
  }
};

module.exports = {
  obtenerLogs,
  crearLog,
  obtenerEstadisticas
};
