const db = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoria');

/**
 * Controlador de Pagos y Caja
 * Interfaz para Recepcionista (Rol ID: 3) y Administrador (Rol ID: 1)
 * Tablas vinculadas: Pagos, Consultas, Pacientes, Podologos, Clinicas, Recepcionistas.
 */

/**
 * GET /api/pagos o /api/pagos/pendientes
 * Listar consultas médicas que ya fueron atendidas o programadas pero cuyo estado_pago sigue como 'Pendiente'
 */
const obtenerConsultasPendientesPago = async (req, res) => {
  try {
    const { clinica_id, q } = req.query;

    let sql = `
      SELECT 
        c.Consulta_id,
        c.Consulta_id AS id,
        c.fk_no_expediente,
        c.fk_clinica_id,
        c.fecha_hora,
        c.estado AS estado_consulta,
        c.motivo_o_notas,
        p.No_expediente AS expediente,
        TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente_nombre,
        p.telefono AS paciente_telefono,
        TRIM(CONCAT(pod.Nombre, ' ', pod.ape_paterno)) AS podologo_nombre,
        pod.Cedula_podologo AS cedula_podologo,
        cl.Nombre AS clinica_nombre,
        COALESCE(pag.Pago_id, CONCAT('PAG-PEND-', c.Consulta_id)) AS Pago_id,
        COALESCE(pag.monto, 450.00) AS monto,
        COALESCE(pag.metodo_pago, 'Efectivo') AS metodo_pago,
        COALESCE(pag.estado_pago, 'Pendiente') AS estado_pago,
        pag.fecha_pago
      FROM Consultas c
      INNER JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
      LEFT JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
      LEFT JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
      LEFT JOIN Pagos pag ON c.Consulta_id = pag.fk_consulta_id
      WHERE (pag.Pago_id IS NULL OR pag.estado_pago = 'Pendiente' OR pag.estado_pago != 'Pagado')
        AND c.estado != 'Cancelada'
    `;
    const params = [];

    if (clinica_id) {
      sql += ` AND c.fk_clinica_id = ?`;
      params.push(clinica_id);
    }

    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      sql += ` AND (p.Nombres LIKE ? OR p.ape_paterno LIKE ? OR c.Consulta_id LIKE ? OR p.No_expediente LIKE ?)`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY c.fecha_hora DESC, c.Consulta_id DESC`;

    const [rows] = await db.pool.query(sql, params);

    // Formatear montos a números flotantes
    const pendientes = rows.map(r => ({
      ...r,
      monto: parseFloat(r.monto || 450.00)
    }));

    res.json(pendientes);
  } catch (error) {
    console.error('Error al obtener consultas pendientes de cobro:', error);
    res.status(500).json({ error: 'Error al consultar las cuentas pendientes de caja' });
  }
};

/**
 * POST /api/pagos o POST /api/pagos/cobrar o PUT /api/pagos/:id
 * Procesar un cobro:
 * Recibe:
 * - fk_consulta_id / consulta_id
 * - monto / monto_final
 * - metodo_pago ('Efectivo', 'Tarjeta', 'Transferencia')
 * Actualiza estado_pago a 'Pagado' y finaliza la consulta.
 */
const procesarCobro = async (req, res) => {
  const consultaId = req.body.fk_consulta_id || req.body.consulta_id || req.body.Consulta_id || req.params.id;
  const montoRaw = req.body.monto !== undefined ? req.body.monto : req.body.monto_final;
  const metodo_pago = req.body.metodo_pago || 'Efectivo';
  const notas = req.body.notas || req.body.motivo_o_notas || '';

  if (!consultaId) {
    return res.status(400).json({ error: 'El ID de la consulta médica es obligatorio para procesar el cobro.' });
  }

  const montoNum = parseFloat(montoRaw);
  if (isNaN(montoNum) || montoNum <= 0) {
    return res.status(400).json({ error: 'El monto a cobrar debe ser un número válido mayor a 0.' });
  }

  // Normalizar método de pago
  let metodoNormalizado = 'Efectivo';
  const metLower = (metodo_pago || '').toLowerCase();
  if (metLower.includes('tarjet') || metLower.includes('debito') || metLower.includes('credito') || metLower.includes('pos')) {
    metodoNormalizado = 'Tarjeta';
  } else if (metLower.includes('transf') || metLower.includes('spei') || metLower.includes('banc')) {
    metodoNormalizado = 'Transferencia';
  } else {
    metodoNormalizado = 'Efectivo';
  }

  try {
    // 1. Verificar existencia de la consulta médica
    const [consultaRows] = await db.pool.query(
      `SELECT c.Consulta_id, c.fk_no_expediente, c.estado,
              TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente_nombre,
              p.No_expediente
       FROM Consultas c
       JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
       WHERE c.Consulta_id = ?`,
      [consultaId]
    );

    if (consultaRows.length === 0) {
      return res.status(404).json({ error: `La consulta médica con ID "${consultaId}" no existe.` });
    }

    const consulta = consultaRows[0];

    // 2. Determinar fk_recepcionista_id
    let recepcionistaId = req.user?.recepcionista_id || req.user?.Recepcionista_id;
    if (!recepcionistaId) {
      const [recRows] = await db.pool.query(
        `SELECT Recepcionista_id FROM Recepcionistas WHERE fk_usuario_id = ? LIMIT 1`,
        [req.user?.id || req.user?.Usuario_id || 0]
      );
      recepcionistaId = recRows.length > 0 ? recRows[0].Recepcionista_id : 1;
    }

    // 3. Verificar si ya existe registro en Pagos para esta consulta
    const [pagosExistentes] = await db.pool.query(
      `SELECT Pago_id, estado_pago FROM Pagos WHERE fk_consulta_id = ?`,
      [consultaId]
    );

    let folioPago = '';
    const montoFormateado = montoNum.toFixed(2);

    if (pagosExistentes.length > 0) {
      folioPago = pagosExistentes[0].Pago_id;
      // Actualizar a estado 'Pagado'
      await db.pool.query(
        `UPDATE Pagos SET
          monto = ?,
          metodo_pago = ?,
          estado_pago = 'Pagado',
          fk_recepcionista_id = ?,
          fecha_pago = NOW()
        WHERE Pago_id = ?`,
        [montoFormateado, metodoNormalizado, recepcionistaId, folioPago]
      );
    } else {
      // Crear nuevo registro con folio único
      folioPago = `PAG-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      await db.pool.query(
        `INSERT INTO Pagos (
          Pago_id,
          fk_consulta_id,
          fk_recepcionista_id,
          monto,
          metodo_pago,
          estado_pago,
          fecha_pago
        ) VALUES (?, ?, ?, ?, ?, 'Pagado', NOW())`,
        [folioPago, consultaId, recepcionistaId, montoFormateado, metodoNormalizado]
      );
    }

    // 4. Actualizar estado de la consulta a 'Finalizada' si estaba en atención o programada
    if (consulta.estado !== 'Finalizada' && consulta.estado !== 'Cancelada') {
      await db.pool.query(
        `UPDATE Consultas SET estado = 'Finalizada' WHERE Consulta_id = ?`,
        [consultaId]
      );
    }

    // 5. Registrar en Bitácora de Auditoría
    const usuarioId = req.user?.Usuario_id || req.user?.id || 1;
    const usuarioNombre = req.user?.nombre_completo || req.user?.rol || 'Recepcionista';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    await registrarAuditoria({
      fk_usuario_id: usuarioId,
      accion_realizada: `[Caja] Cobro procesado exitosamente: Folio ${folioPago} | Monto: $${montoFormateado} | Método: ${metodoNormalizado} | Paciente: ${consulta.paciente_nombre} (Consulta: ${consultaId}) por ${usuarioNombre}`,
      tabla_afectada: 'Pagos',
      direccion_ip: ip
    });

    res.status(200).json({
      mensaje: 'Cobro procesado exitosamente.',
      recibo: {
        Pago_id: folioPago,
        id: folioPago,
        fk_consulta_id: consultaId,
        paciente: consulta.paciente_nombre,
        expediente: consulta.No_expediente,
        monto: parseFloat(montoFormateado),
        metodo_pago: metodoNormalizado,
        estado_pago: 'Pagado',
        fecha_pago: new Date().toISOString(),
        cajero: usuarioNombre
      }
    });
  } catch (error) {
    console.error('Error al procesar cobro:', error);
    res.status(500).json({ error: 'Error interno al registrar el pago en caja' });
  }
};

/**
 * GET /api/pagos/historial
 * Obtener historial de cobros completados del día o generales
 */
const obtenerHistorialCobros = async (req, res) => {
  try {
    const { fecha, metodo } = req.query;

    let sql = `
      SELECT 
        pag.Pago_id,
        pag.Pago_id AS id,
        pag.fk_consulta_id,
        pag.monto,
        pag.metodo_pago,
        pag.estado_pago,
        pag.fecha_pago,
        c.fecha_hora AS fecha_consulta,
        p.No_expediente AS expediente,
        TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente_nombre,
        p.telefono AS paciente_telefono,
        TRIM(CONCAT(pod.Nombre, ' ', pod.ape_paterno)) AS podologo_nombre,
        TRIM(CONCAT(r.Nombre, ' ', r.ape_paterno)) AS recepcionista_nombre,
        cl.Nombre AS clinica_nombre
      FROM Pagos pag
      INNER JOIN Consultas c ON pag.fk_consulta_id = c.Consulta_id
      INNER JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
      LEFT JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
      LEFT JOIN Recepcionistas r ON pag.fk_recepcionista_id = r.Recepcionista_id
      LEFT JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
      WHERE pag.estado_pago = 'Pagado'
    `;
    const params = [];

    if (fecha) {
      sql += ` AND DATE(pag.fecha_pago) = ?`;
      params.push(fecha);
    }

    if (metodo) {
      sql += ` AND pag.metodo_pago = ?`;
      params.push(metodo);
    }

    sql += ` ORDER BY pag.fecha_pago DESC LIMIT 100`;

    const [rows] = await db.pool.query(sql, params);

    res.json(rows.map(r => ({
      ...r,
      monto: parseFloat(r.monto || 0)
    })));
  } catch (error) {
    console.error('Error al consultar historial de cobros:', error);
    res.status(500).json({ error: 'Error al consultar historial de cobros' });
  }
};

/**
 * GET /api/pagos/resumen-caja
 * Métricas financieras en tiempo real para el Dashboard de Caja
 */
const obtenerResumenCaja = async (req, res) => {
  try {
    const [hoyRes, pendientesRes, metodosRes] = await Promise.all([
      db.pool.query(`
        SELECT 
          COALESCE(SUM(monto), 0) AS total_hoy,
          COUNT(*) AS cobros_hoy
        FROM Pagos
        WHERE estado_pago = 'Pagado' AND DATE(fecha_pago) = CURDATE()
      `),
      db.pool.query(`
        SELECT 
          COUNT(*) AS total_pendientes,
          COALESCE(SUM(COALESCE(pag.monto, 450)), 0) AS monto_pendiente_estimado
        FROM Consultas c
        LEFT JOIN Pagos pag ON c.Consulta_id = pag.fk_consulta_id
        WHERE (pag.Pago_id IS NULL OR pag.estado_pago = 'Pendiente' OR pag.estado_pago != 'Pagado')
          AND c.estado != 'Cancelada'
      `),
      db.pool.query(`
        SELECT 
          metodo_pago,
          COUNT(*) AS cantidad,
          COALESCE(SUM(monto), 0) AS total
        FROM Pagos
        WHERE estado_pago = 'Pagado' AND DATE(fecha_pago) = CURDATE()
        GROUP BY metodo_pago
      `)
    ]);

    res.json({
      total_hoy: parseFloat(hoyRes[0][0]?.total_hoy || 0),
      cobros_hoy: parseInt(hoyRes[0][0]?.cobros_hoy || 0, 10),
      total_pendientes: parseInt(pendientesRes[0][0]?.total_pendientes || 0, 10),
      monto_pendiente_estimado: parseFloat(pendientesRes[0][0]?.monto_pendiente_estimado || 0),
      desglose_metodos: metodosRes[0] || []
    });
  } catch (error) {
    console.error('Error al obtener métricas de caja:', error);
    res.status(500).json({ error: 'Error al calcular métricas de caja' });
  }
};

module.exports = {
  obtenerConsultasPendientesPago,
  procesarCobro,
  obtenerHistorialCobros,
  obtenerResumenCaja
};
