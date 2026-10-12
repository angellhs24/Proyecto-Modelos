const db = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoria');

/**
 * Obtener listado de artículos del inventario
 */
const obtenerInventario = async (req, res) => {
  try {
    const { clinica_id, q, categoria } = req.query;

    let sql = `
      SELECT 
        i.Articulo_id,
        i.Articulo_id AS id,
        CONCAT('INS-', LPAD(i.Articulo_id, 3, '0')) AS codigo,
        i.fk_clinica_id,
        i.nombre_articulo,
        i.nombre_articulo AS nombre,
        i.categoria,
        i.cantidad_stock,
        i.cantidad_stock AS stock,
        i.unidad_medida,
        i.unidad_medida AS unidad,
        i.stock_minimo,
        i.stock_minimo AS minimo,
        i.ultima_actualizacion,
        cl.Nombre AS clinica_nombre
      FROM Inventario i
      LEFT JOIN Clinicas cl ON i.fk_clinica_id = cl.Clinica_id
      WHERE 1=1
    `;
    const params = [];

    if (clinica_id) {
      sql += ` AND i.fk_clinica_id = ?`;
      params.push(clinica_id);
    }

    if (categoria) {
      sql += ` AND i.categoria = ?`;
      params.push(categoria);
    }

    if (q) {
      sql += ` AND (i.nombre_articulo LIKE ? OR i.categoria LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }

    sql += ` ORDER BY i.nombre_articulo ASC`;

    const resultado = await db.query(sql, params);
    res.json(resultado.rows);
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json([]);
    }
    console.error('Error al obtener inventario:', error);
    res.status(500).json({ error: 'Error al consultar el inventario' });
  }
};

/**
 * Obtener un artículo por ID
 */
const obtenerArticuloPorId = async (req, res) => {
  const { id } = req.params;

  try {
    const resultado = await db.query(
      `SELECT 
        i.Articulo_id,
        i.Articulo_id AS id,
        CONCAT('INS-', LPAD(i.Articulo_id, 3, '0')) AS codigo,
        i.fk_clinica_id,
        i.nombre_articulo,
        i.nombre_articulo AS nombre,
        i.categoria,
        i.cantidad_stock,
        i.cantidad_stock AS stock,
        i.unidad_medida,
        i.unidad_medida AS unidad,
        i.stock_minimo,
        i.stock_minimo AS minimo,
        i.ultima_actualizacion,
        cl.Nombre AS clinica_nombre
      FROM Inventario i
      LEFT JOIN Clinicas cl ON i.fk_clinica_id = cl.Clinica_id
      WHERE i.Articulo_id = ?`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Artículo no encontrado' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al obtener artículo:', error);
    res.status(500).json({ error: 'Error al consultar el artículo' });
  }
};

/**
 * Registrar un nuevo artículo en inventario
 */
const crearArticulo = async (req, res) => {
  let {
    fk_clinica_id,
    nombre_articulo,
    nombre,
    categoria,
    cantidad_stock,
    stock,
    unidad_medida,
    unidad,
    stock_minimo,
    minimo
  } = req.body;

  const nombreFinal = (nombre_articulo || nombre || '').trim();
  if (!nombreFinal) {
    return res.status(400).json({ error: 'El nombre del artículo es obligatorio' });
  }

  try {
    // Si no viene fk_clinica_id, usar la primera clínica existente
    if (!fk_clinica_id) {
      const clinicaRes = await db.query(`SELECT Clinica_id FROM Clinicas LIMIT 1`);
      fk_clinica_id = clinicaRes.rows[0]?.Clinica_id || 1;
    }

    const cantStock = parseInt(cantidad_stock !== undefined ? cantidad_stock : stock || 0, 10) || 0;
    const stockMin = parseInt(stock_minimo !== undefined ? stock_minimo : minimo || 5, 10) || 5;
    const cat = categoria || 'General';
    const uni = unidad_medida || unidad || 'Pieza';

    const insertRes = await db.query(
      `INSERT INTO Inventario (
        fk_clinica_id,
        nombre_articulo,
        categoria,
        cantidad_stock,
        unidad_medida,
        stock_minimo
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [fk_clinica_id, nombreFinal, cat, cantStock, uni, stockMin]
    );

    const articuloId = insertRes.rows?.insertId || insertRes.fields?.insertId;

    const usuarioResponsable = req.headers['x-usuario'] || 'Responsable de Farmacia';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    await registrarAuditoria({
      usuario_responsable: usuarioResponsable,
      accion_realizada: `Alta de insumo en inventario: ${nombreFinal} (Stock inicial: ${cantStock} ${uni})`,
      tabla_afectada: 'Inventario',
      direccion_ip: ip
    });
    req.auditoriaManual = true;

    res.status(201).json({
      mensaje: 'Artículo registrado exitosamente',
      Articulo_id: articuloId,
      id: articuloId,
      nombre: nombreFinal,
      cantidad_stock: cantStock
    });
  } catch (error) {
    console.error('Error al crear artículo:', error);
    res.status(500).json({ error: 'Error al registrar el artículo en inventario' });
  }
};

/**
 * Actualizar un artículo
 */
const actualizarArticulo = async (req, res) => {
  const { id } = req.params;
  const {
    fk_clinica_id,
    nombre_articulo,
    nombre,
    categoria,
    cantidad_stock,
    stock,
    unidad_medida,
    unidad,
    stock_minimo,
    minimo
  } = req.body;

  try {
    const articuloActual = await db.query(`SELECT * FROM Inventario WHERE Articulo_id = ?`, [id]);
    if (articuloActual.rows.length === 0) {
      return res.status(404).json({ error: 'Artículo no encontrado' });
    }

    const act = articuloActual.rows[0];

    const nombreFinal = (nombre_articulo !== undefined ? nombre_articulo : nombre) || act.nombre_articulo;
    const catFinal = categoria !== undefined ? categoria : act.categoria;
    const stockFinal = cantidad_stock !== undefined ? parseInt(cantidad_stock, 10) : stock !== undefined ? parseInt(stock, 10) : act.cantidad_stock;
    const uniFinal = (unidad_medida !== undefined ? unidad_medida : unidad) || act.unidad_medida;
    const minFinal = stock_minimo !== undefined ? parseInt(stock_minimo, 10) : minimo !== undefined ? parseInt(minimo, 10) : act.stock_minimo;
    const clinicaFinal = fk_clinica_id || act.fk_clinica_id;

    await db.query(
      `UPDATE Inventario SET
        fk_clinica_id = ?,
        nombre_articulo = ?,
        categoria = ?,
        cantidad_stock = ?,
        unidad_medida = ?,
        stock_minimo = ?
      WHERE Articulo_id = ?`,
      [clinicaFinal, nombreFinal, catFinal, stockFinal, uniFinal, minFinal, id]
    );

    const usuarioResponsable = req.headers['x-usuario'] || 'Responsable de Farmacia';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    await registrarAuditoria({
      usuario_responsable: usuarioResponsable,
      accion_realizada: `Actualización de artículo ${id}: ${nombreFinal}`,
      tabla_afectada: 'Inventario',
      direccion_ip: ip
    });
    req.auditoriaManual = true;

    res.json({ mensaje: 'Artículo actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar artículo:', error);
    res.status(500).json({ error: 'Error al actualizar el artículo' });
  }
};

/**
 * Eliminar un artículo
 */
const eliminarArticulo = async (req, res) => {
  const { id } = req.params;

  try {
    const articuloRes = await db.query(`SELECT nombre_articulo FROM Inventario WHERE Articulo_id = ?`, [id]);
    const nombre = articuloRes.rows[0]?.nombre_articulo || id;

    await db.query(`DELETE FROM Inventario WHERE Articulo_id = ?`, [id]);

    const usuarioResponsable = req.headers['x-usuario'] || 'Responsable de Farmacia';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    await registrarAuditoria({
      usuario_responsable: usuarioResponsable,
      accion_realizada: `Eliminación de insumo ${id}: ${nombre}`,
      tabla_afectada: 'Inventario',
      direccion_ip: ip
    });
    req.auditoriaManual = true;

    res.json({ mensaje: 'Artículo eliminado correctamente del inventario' });
  } catch (error) {
    console.error('Error al eliminar artículo:', error);
    res.status(500).json({ error: 'Error al eliminar el artículo' });
  }
};

/**
 * Registrar un movimiento de entrada o salida de inventario
 */
const registrarMovimiento = async (req, res) => {
  const { id } = req.params;
  const { tipo, tipo_movimiento, cantidad, delta, motivo, notas } = req.body;

  try {
    const articuloRes = await db.query(`SELECT * FROM Inventario WHERE Articulo_id = ?`, [id]);
    if (articuloRes.rows.length === 0) {
      return res.status(404).json({ error: 'Artículo no encontrado' });
    }

    const articulo = articuloRes.rows[0];
    const tipoMov = (tipo || tipo_movimiento || '').toLowerCase();
    const cantVal = Math.abs(parseInt(cantidad !== undefined ? cantidad : delta || 0, 10));

    if (!cantVal) {
      return res.status(400).json({ error: 'La cantidad debe ser mayor a cero' });
    }

    let nuevoStock = articulo.cantidad_stock;
    const esEntrada = ['entrada', 'ingreso', 'in', 'alta'].includes(tipoMov);
    const esSalida = ['salida', 'descuento', 'egreso', 'out', 'merma'].includes(tipoMov);

    if (esEntrada) {
      nuevoStock += cantVal;
    } else if (esSalida) {
      if (articulo.cantidad_stock < cantVal) {
        return res.status(400).json({
          error: `Stock insuficiente. Stock actual: ${articulo.cantidad_stock}, solicitado: ${cantVal}`
        });
      }
      nuevoStock -= cantVal;
    } else if (tipoMov === 'ajuste') {
      nuevoStock = cantVal;
    } else {
      return res.status(400).json({ error: 'Tipo de movimiento no válido (entrada o salida)' });
    }

    await db.query(`UPDATE Inventario SET cantidad_stock = ? WHERE Articulo_id = ?`, [nuevoStock, id]);

    const motivoFinal = motivo || notas || (esEntrada ? 'Reabastecimiento clínico' : 'Consumo en quiropodia');
    const usuarioResponsable = req.headers['x-usuario'] || 'Responsable de Insumos';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    const detalleAccion = `Movimiento de Inventario [${esEntrada ? 'ENTRADA' : 'SALIDA'}]: ${articulo.nombre_articulo} | Cantidad: ${cantVal} | Stock resultante: ${nuevoStock} | Motivo: ${motivoFinal}`;

    await registrarAuditoria({
      usuario_responsable: usuarioResponsable,
      accion_realizada: detalleAccion,
      tabla_afectada: 'Inventario',
      direccion_ip: ip
    });
    req.auditoriaManual = true;

    res.json({
      mensaje: 'Movimiento registrado con éxito',
      insumo: {
        ...articulo,
        id: articulo.Articulo_id,
        cantidad_stock: nuevoStock,
        stock: nuevoStock
      },
      movimiento: {
        id: Date.now(),
        insumo_id: id,
        tipo: esEntrada ? 'entrada' : 'salida',
        cantidad: cantVal,
        motivo: motivoFinal,
        fecha: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error al registrar movimiento:', error);
    res.status(500).json({ error: 'Error al procesar el movimiento de inventario' });
  }
};

/**
 * Obtener historial de movimientos desde la bitácora de auditoría
 */
const obtenerMovimientos = async (req, res) => {
  try {
    const resultado = await db.query(
      `SELECT 
        Log_id AS id,
        usuario_responsable AS usuario,
        accion_realizada AS detalle,
        fecha_hora AS fecha
      FROM Bitacora_Auditoria
      WHERE tabla_afectada = 'Inventario'
      ORDER BY fecha_hora DESC, Log_id DESC
      LIMIT 100`
    );

    res.json(resultado.rows);
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json([]);
    }
    console.error('Error al obtener movimientos de inventario:', error);
    res.status(500).json({ error: 'Error al consultar movimientos' });
  }
};

module.exports = {
  obtenerInventario,
  obtenerArticuloPorId,
  crearArticulo,
  actualizarArticulo,
  eliminarArticulo,
  registrarMovimiento,
  obtenerMovimientos
};
