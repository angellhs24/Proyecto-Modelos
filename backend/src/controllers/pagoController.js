const db = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoria');

/**
 * Obtener todos los pagos y movimientos de caja
 */
const obtenerPagos = async (req, res) => {
  try {
    const { estado_pago, fk_consulta_id, expediente, fecha } = req.query;

    let sql = `
      SELECT 
        pg.Pago_id,
        pg.Pago_id AS id,
        pg.fk_consulta_id,
        pg.monto,
        pg.metodo_pago,
        pg.estado_pago,
        pg.fecha_pago,
        c.fecha_hora AS fecha_consulta,
        c.motivo_o_notas AS motivo_consulta,
        p.No_expediente AS expediente,
        TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente_nombre,
        p.telefono AS paciente_telefono,
        cl.Nombre AS clinica_nombre
      FROM Pagos pg
      INNER JOIN Consultas c ON pg.fk_consulta_id = c.Consulta_id
      INNER JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
      LEFT JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
      WHERE 1=1
    `;
    const params = [];

    if (estado_pago) {
      sql += ` AND pg.estado_pago = ?`;
      params.push(estado_pago);
    }

    if (fk_consulta_id) {
      sql += ` AND pg.fk_consulta_id = ?`;
      params.push(fk_consulta_id);
    }

    if (expediente) {
      sql += ` AND p.No_expediente = ?`;
      params.push(expediente);
    }

    if (fecha) {
      sql += ` AND DATE(pg.fecha_pago) = ?`;
      params.push(fecha);
    }

    sql += ` ORDER BY pg.fecha_pago DESC, pg.Pago_id DESC`;

    const resultado = await db.query(sql, params);
    res.json(resultado.rows);
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json([]);
    }
    console.error('Error al obtener pagos:', error);
    res.status(500).json({ error: 'Error al consultar los registros de pagos y caja' });
  }
};

/**
 * Obtener resumen financiero para el dashboard de Caja
 */
const obtenerResumenFinanciero = async (req, res) => {
  try {
    const [totales, hoy, pendientes, metodos] = await Promise.all([
      db.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN estado_pago = 'Pagado' THEN monto ELSE 0 END), 0) AS total_ingresos,
          COALESCE(SUM(CASE WHEN estado_pago = 'Pagado' AND MONTH(fecha_pago) = MONTH(CURDATE()) AND YEAR(fecha_pago) = YEAR(CURDATE()) THEN monto ELSE 0 END), 0) AS ingresos_mes,
          COUNT(*) AS total_transacciones
        FROM Pagos
      `),
      db.query(`
        SELECT 
          COALESCE(SUM(monto), 0) AS total_hoy,
          COUNT(*) AS count_hoy
        FROM Pagos
        WHERE estado_pago = 'Pagado' AND DATE(fecha_pago) = CURDATE()
      `),
      db.query(`
        SELECT 
          COALESCE(SUM(monto), 0) AS total_pendiente,
          COUNT(*) AS count_pendiente
        FROM Pagos
        WHERE estado_pago = 'Pendiente'
      `),
      db.query(`
        SELECT 
          metodo_pago,
          COUNT(*) AS transacciones,
          COALESCE(SUM(monto), 0) AS total
        FROM Pagos
        WHERE estado_pago = 'Pagado'
        GROUP BY metodo_pago
      `)
    ]);

    res.json({
      total_ingresos: parseFloat(totales.rows[0]?.total_ingresos || 0),
      ingresos_mes: parseFloat(totales.rows[0]?.ingresos_mes || 0),
      total_transacciones: parseInt(totales.rows[0]?.total_transacciones || 0, 10),
      total_hoy: parseFloat(hoy.rows[0]?.total_hoy || 0),
      transacciones_hoy: parseInt(hoy.rows[0]?.count_hoy || 0, 10),
      total_pendiente: parseFloat(pendientes.rows[0]?.total_pendiente || 0),
      cobros_pendientes_count: parseInt(pendientes.rows[0]?.count_pendiente || 0, 10),
      metodos_pago: metodos.rows
    });
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json({
        total_ingresos: 0,
        ingresos_mes: 0,
        total_transacciones: 0,
        total_hoy: 0,
        count_hoy: 0,
        total_pendiente: 0,
        count_pendiente: 0,
        desglose_metodos: []
      });
    }
    console.error('Error al obtener resumen financiero:', error);
    res.status(500).json({ error: 'Error al calcular las métricas financieras' });
  }
};

/**
 * Obtener detalle de un pago por ID
 */
const obtenerPagoPorId = async (req, res) => {
  const { id } = req.params;

  try {
    const resultado = await db.query(
      `SELECT 
        pg.*,
        c.fecha_hora AS fecha_consulta,
        p.No_expediente AS expediente,
        TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente_nombre,
        p.telefono AS paciente_telefono,
        cl.Nombre AS clinica_nombre
      FROM Pagos pg
      INNER JOIN Consultas c ON pg.fk_consulta_id = c.Consulta_id
      INNER JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
      LEFT JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
      WHERE pg.Pago_id = ?`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de pago no encontrado' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al obtener pago:', error);
    res.status(500).json({ error: 'Error al consultar el pago' });
  }
};

/**
 * Registrar un nuevo pago en caja
 */
const crearPago = async (req, res) => {
  let {
    Pago_id,
    id,
    fk_consulta_id,
    expediente,
    monto,
    metodo_pago,
    estado_pago = 'Pendiente',
    fecha_pago
  } = req.body;

  if (monto === undefined || monto === null || isNaN(parseFloat(monto))) {
    return res.status(400).json({ error: 'El monto es obligatorio y debe ser un valor numérico' });
  }

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
          ) VALUES (?, ?, ?, ?, NOW(), 'Completada', 'Atención en Consultorio')`,
          [nuevaConsultaId, expediente, clinicaId, podologoId]
        );
        fk_consulta_id = nuevaConsultaId;
      }
    }

    if (!fk_consulta_id) {
      return res.status(400).json({ error: 'Se requiere fk_consulta_id o expediente del paciente' });
    }

    const pagoIdFinal =
      Pago_id ||
      id ||
      `PAG-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    const montoFinal = parseFloat(monto).toFixed(2);
    const metodoFinal = metodo_pago || 'Efectivo';
    const estadoFinal = estado_pago || 'Pagado';

    await db.query(
      `INSERT INTO Pagos (
        Pago_id,
        fk_consulta_id,
        monto,
        metodo_pago,
        estado_pago,
        fecha_pago
      ) VALUES (?, ?, ?, ?, ?, COALESCE(?, NOW()))`,
      [pagoIdFinal, fk_consulta_id, montoFinal, metodoFinal, estadoFinal, fecha_pago || null]
    );

    const usuarioResponsable = req.headers['x-usuario'] || 'Caja / Recepción';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    await registrarAuditoria({
      usuario_responsable: usuarioResponsable,
      accion_realizada: `Cobro registrado [${estadoFinal}]: Folio ${pagoIdFinal} por $${montoFinal} (${metodoFinal})`,
      tabla_afectada: 'Pagos',
      direccion_ip: ip
    });
    req.auditoriaManual = true;

    res.status(201).json({
      mensaje: 'Pago registrado con éxito',
      Pago_id: pagoIdFinal,
      id: pagoIdFinal,
      fk_consulta_id,
      monto: parseFloat(montoFinal),
      metodo_pago: metodoFinal,
      estado_pago: estadoFinal
    });
  } catch (error) {
    console.error('Error al registrar pago:', error);
    res.status(500).json({ error: 'Error al registrar el cobro en el sistema' });
  }
};

/**
 * Actualizar estado o datos de un pago
 */
const actualizarPago = async (req, res) => {
  const { id } = req.params;
  const { monto, metodo_pago, estado_pago } = req.body;

  try {
    const pagoActualRes = await db.query(`SELECT * FROM Pagos WHERE Pago_id = ?`, [id]);
    if (pagoActualRes.rows.length === 0) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    const pagoActual = pagoActualRes.rows[0];
    const montoFinal = monto !== undefined ? parseFloat(monto).toFixed(2) : pagoActual.monto;
    const metodoFinal = metodo_pago || pagoActual.metodo_pago;
    const estadoFinal = estado_pago || pagoActual.estado_pago;

    await db.query(
      `UPDATE Pagos SET
        monto = ?,
        metodo_pago = ?,
        estado_pago = ?
      WHERE Pago_id = ?`,
      [montoFinal, metodoFinal, estadoFinal, id]
    );

    const usuarioResponsable = req.headers['x-usuario'] || 'Caja / Recepción';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    await registrarAuditoria({
      usuario_responsable: usuarioResponsable,
      accion_realizada: `Actualización de pago ${id}: Monto $${montoFinal}, Estado '${estadoFinal}', Método '${metodoFinal}'`,
      tabla_afectada: 'Pagos',
      direccion_ip: ip
    });
    req.auditoriaManual = true;

    res.json({ mensaje: 'Pago actualizado exitosamente', estado_pago: estadoFinal });
  } catch (error) {
    console.error('Error al actualizar pago:', error);
    res.status(500).json({ error: 'Error al actualizar el pago' });
  }
};

/**
 * Eliminar un pago
 */
const eliminarPago = async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(`DELETE FROM Pagos WHERE Pago_id = ?`, [id]);

    const usuarioResponsable = req.headers['x-usuario'] || 'Caja / Recepción';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    await registrarAuditoria({
      usuario_responsable: usuarioResponsable,
      accion_realizada: `Cancelación / Eliminación de pago ${id}`,
      tabla_afectada: 'Pagos',
      direccion_ip: ip
    });
    req.auditoriaManual = true;

    res.json({ mensaje: 'Pago eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar pago:', error);
    res.status(500).json({ error: 'Error al eliminar el pago' });
  }
};

module.exports = {
  obtenerPagos,
  obtenerResumenFinanciero,
  obtenerPagoPorId,
  crearPago,
  actualizarPago,
  eliminarPago
};
