const db = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoria');

/**
 * Controlador de Inventario (CRUD Completo)
 * Tabla: Inventario
 * - Articulo_id INT AUTO_INCREMENT PRIMARY KEY
 * - fk_clinica_id INT NOT NULL (FK -> Clinicas)
 * - nombre_articulo VARCHAR(100) NOT NULL
 * - categoria VARCHAR(50)
 * - cantidad_stock INT DEFAULT 0
 * - unidad_medida VARCHAR(20)
 * - stock_minimo INT DEFAULT 5
 * - ultima_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 */

/**
 * GET /api/inventario
 * Listar artículos con soporte para filtros de clínica, búsqueda, categoría y alertas de stock.
 */
const obtenerInventario = async (req, res) => {
  try {
    const { clinica_id, q, categoria, bajo_stock } = req.query;

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
        cl.Nombre AS clinica_nombre,
        CASE 
          WHEN i.cantidad_stock <= 0 THEN 'agotado'
          WHEN i.cantidad_stock <= i.stock_minimo THEN 'reabastecer'
          ELSE 'optimo'
        END AS estado_stock,
        (i.cantidad_stock <= i.stock_minimo) AS alerta_reabastecer
      FROM Inventario i
      LEFT JOIN Clinicas cl ON i.fk_clinica_id = cl.Clinica_id
      WHERE 1=1
    `;
    const params = [];

    // Filtro por clínica específica
    if (clinica_id) {
      sql += ` AND i.fk_clinica_id = ?`;
      params.push(clinica_id);
    }

    // Filtro por categoría
    if (categoria && categoria !== 'Todas') {
      sql += ` AND i.categoria = ?`;
      params.push(categoria);
    }

    // Búsqueda por término (nombre, categoría o código)
    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      sql += ` AND (i.nombre_articulo LIKE ? OR i.categoria LIKE ? OR CONCAT('INS-', LPAD(i.Articulo_id, 3, '0')) LIKE ?)`;
      params.push(term, term, term);
    }

    // Filtro para artículos que requieren reabastecimiento (stock <= stock_minimo)
    if (bajo_stock === 'true' || bajo_stock === '1') {
      sql += ` AND i.cantidad_stock <= i.stock_minimo`;
    }

    // Ordenar: primero los artículos en alerta crítica y luego alfabéticamente
    sql += ` ORDER BY (i.cantidad_stock <= i.stock_minimo) DESC, i.cantidad_stock ASC, i.nombre_articulo ASC`;

    const resultado = await db.query(sql, params);

    // Mapear respuesta asegurando formatos limpios y booleanos reales
    const articulos = (resultado.rows || []).map(row => ({
      ...row,
      alerta_reabastecer: Boolean(row.alerta_reabastecer || row.cantidad_stock <= row.stock_minimo),
      diferencia_reabastecimiento: row.cantidad_stock <= row.stock_minimo ? Math.max(0, row.stock_minimo - row.cantidad_stock) : 0
    }));

    res.json(articulos);
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json([]);
    }
    console.error('Error al obtener inventario:', error);
    res.status(500).json({ error: 'Error al consultar el catálogo de inventario' });
  }
};

/**
 * GET /api/inventario/:id
 * Obtener un artículo específico por su ID primario.
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
        cl.Nombre AS clinica_nombre,
        CASE 
          WHEN i.cantidad_stock <= 0 THEN 'agotado'
          WHEN i.cantidad_stock <= i.stock_minimo THEN 'reabastecer'
          ELSE 'optimo'
        END AS estado_stock,
        (i.cantidad_stock <= i.stock_minimo) AS alerta_reabastecer
      FROM Inventario i
      LEFT JOIN Clinicas cl ON i.fk_clinica_id = cl.Clinica_id
      WHERE i.Articulo_id = ?`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: `El artículo con ID ${id} no existe en el inventario.` });
    }

    const item = resultado.rows[0];
    item.alerta_reabastecer = Boolean(item.alerta_reabastecer || item.cantidad_stock <= item.stock_minimo);

    res.json(item);
  } catch (error) {
    console.error(`Error al obtener artículo ${id}:`, error);
    res.status(500).json({ error: 'Error al consultar el artículo solicitado' });
  }
};

/**
 * POST /api/inventario
 * Crear un nuevo artículo en la tabla Inventario.
 * Requiere rol Admin o Recepcionista.
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
    return res.status(400).json({ error: 'El nombre del artículo es obligatorio.' });
  }

  try {
    // Si no viene fk_clinica_id, tomar el de la recepcionista en sesión o la primera clínica activa
    let clinicaFinal = fk_clinica_id || req.user?.fk_clinica_id;
    if (!clinicaFinal) {
      const clinicaRes = await db.query(`SELECT Clinica_id FROM Clinicas WHERE Activa = 1 LIMIT 1`);
      clinicaFinal = clinicaRes.rows[0]?.Clinica_id || 1;
    }

    const cantStock = Math.max(0, parseInt(cantidad_stock !== undefined ? cantidad_stock : stock || 0, 10) || 0);
    const stockMin = Math.max(0, parseInt(stock_minimo !== undefined ? stock_minimo : minimo || 5, 10) || 5);
    const catFinal = (categoria || 'Material de Curación').trim();
    const uniFinal = (unidad_medida || unidad || 'Pieza').trim();

    const insertRes = await db.query(
      `INSERT INTO Inventario (
        fk_clinica_id,
        nombre_articulo,
        categoria,
        cantidad_stock,
        unidad_medida,
        stock_minimo
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [clinicaFinal, nombreFinal, catFinal, cantStock, uniFinal, stockMin]
    );

    const articuloId = insertRes.rows?.insertId || insertRes.fields?.insertId;

    // Registro de auditoría
    const usuarioId = req.user?.Usuario_id || req.user?.id || 1;
    const usuarioNombre = req.user?.nombre_completo || req.user?.rol || 'Recepcionista';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    await registrarAuditoria({
      fk_usuario_id: usuarioId,
      accion_realizada: `[Inventario] Alta de artículo: "${nombreFinal}" | Stock Inicial: ${cantStock} ${uniFinal} | Mínimo: ${stockMin} (por ${usuarioNombre})`,
      tabla_afectada: 'Inventario',
      direccion_ip: ip
    });

    res.status(201).json({
      mensaje: 'Artículo registrado exitosamente en el inventario.',
      Articulo_id: articuloId,
      id: articuloId,
      codigo: `INS-${String(articuloId).padStart(3, '0')}`,
      fk_clinica_id: clinicaFinal,
      nombre_articulo: nombreFinal,
      categoria: catFinal,
      cantidad_stock: cantStock,
      unidad_medida: uniFinal,
      stock_minimo: stockMin,
      alerta_reabastecer: cantStock <= stockMin
    });
  } catch (error) {
    console.error('Error al crear artículo en inventario:', error);
    res.status(500).json({ error: 'Error interno al registrar el artículo en el inventario.' });
  }
};

/**
 * PUT /api/inventario/:id
 * Editar un artículo existente (especialmente actualizar cantidad_stock, pero también otros campos).
 * Requiere rol Admin o Recepcionista.
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
    const articuloActual = await db.query(
      `SELECT * FROM Inventario WHERE Articulo_id = ?`,
      [id]
    );

    if (articuloActual.rows.length === 0) {
      return res.status(404).json({ error: `El artículo con ID ${id} no existe en el inventario.` });
    }

    const act = articuloActual.rows[0];

    const nombreFinal = (nombre_articulo !== undefined ? nombre_articulo : nombre) !== undefined
      ? String(nombre_articulo !== undefined ? nombre_articulo : nombre).trim()
      : act.nombre_articulo;

    if (!nombreFinal) {
      return res.status(400).json({ error: 'El nombre del artículo no puede estar vacío.' });
    }

    const catFinal = categoria !== undefined ? String(categoria).trim() : act.categoria;
    const uniFinal = (unidad_medida !== undefined ? unidad_medida : unidad) !== undefined
      ? String(unidad_medida !== undefined ? unidad_medida : unidad).trim()
      : act.unidad_medida;

    const cantRaw = cantidad_stock !== undefined ? cantidad_stock : stock;
    const stockFinal = cantRaw !== undefined ? Math.max(0, parseInt(cantRaw, 10) || 0) : act.cantidad_stock;

    const minRaw = stock_minimo !== undefined ? stock_minimo : minimo;
    const minFinal = minRaw !== undefined ? Math.max(0, parseInt(minRaw, 10) || 0) : act.stock_minimo;

    const clinicaFinal = fk_clinica_id ? parseInt(fk_clinica_id, 10) : act.fk_clinica_id;

    await db.query(
      `UPDATE Inventario SET
        fk_clinica_id = ?,
        nombre_articulo = ?,
        categoria = ?,
        cantidad_stock = ?,
        unidad_medida = ?,
        stock_minimo = ?,
        ultima_actualizacion = NOW()
      WHERE Articulo_id = ?`,
      [clinicaFinal, nombreFinal, catFinal, stockFinal, uniFinal, minFinal, id]
    );

    // Auditoría de cambios, resaltando si hubo variación de stock
    const usuarioId = req.user?.Usuario_id || req.user?.id || 1;
    const usuarioNombre = req.user?.nombre_completo || req.user?.rol || 'Recepcionista';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    let detalleCambio = `[Inventario] Modificación ID ${id} ("${nombreFinal}"): `;
    if (act.cantidad_stock !== stockFinal) {
      detalleCambio += `Stock actualizado de ${act.cantidad_stock} a ${stockFinal} ${uniFinal}. `;
    }
    if (act.stock_minimo !== minFinal) {
      detalleCambio += `Stock mínimo de ${act.stock_minimo} a ${minFinal}. `;
    }
    detalleCambio += `(por ${usuarioNombre})`;

    await registrarAuditoria({
      fk_usuario_id: usuarioId,
      accion_realizada: detalleCambio.slice(0, 255),
      tabla_afectada: 'Inventario',
      direccion_ip: ip
    });

    res.json({
      mensaje: 'Artículo actualizado exitosamente.',
      articulo: {
        Articulo_id: parseInt(id, 10),
        id: parseInt(id, 10),
        codigo: `INS-${String(id).padStart(3, '0')}`,
        fk_clinica_id: clinicaFinal,
        nombre_articulo: nombreFinal,
        categoria: catFinal,
        cantidad_stock: stockFinal,
        unidad_medida: uniFinal,
        stock_minimo: minFinal,
        alerta_reabastecer: stockFinal <= minFinal
      }
    });
  } catch (error) {
    console.error(`Error al actualizar artículo ${id}:`, error);
    res.status(500).json({ error: 'Error interno al actualizar el artículo.' });
  }
};

/**
 * DELETE /api/inventario/:id
 * Eliminar un artículo del inventario.
 * Requiere rol Admin o Recepcionista.
 */
const eliminarArticulo = async (req, res) => {
  const { id } = req.params;

  try {
    const articuloRes = await db.query(
      `SELECT nombre_articulo, cantidad_stock, unidad_medida FROM Inventario WHERE Articulo_id = ?`,
      [id]
    );

    if (articuloRes.rows.length === 0) {
      return res.status(404).json({ error: `El artículo con ID ${id} no existe o ya fue eliminado.` });
    }

    const { nombre_articulo, cantidad_stock, unidad_medida } = articuloRes.rows[0];

    await db.query(`DELETE FROM Inventario WHERE Articulo_id = ?`, [id]);

    // Auditoría
    const usuarioId = req.user?.Usuario_id || req.user?.id || 1;
    const usuarioNombre = req.user?.nombre_completo || req.user?.rol || 'Recepcionista';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    await registrarAuditoria({
      fk_usuario_id: usuarioId,
      accion_realizada: `[Inventario] Eliminación de insumo ID ${id}: "${nombre_articulo}" (Remanente: ${cantidad_stock} ${unidad_medida}) por ${usuarioNombre}`,
      tabla_afectada: 'Inventario',
      direccion_ip: ip
    });

    res.json({
      mensaje: `Artículo "${nombre_articulo}" (ID: ${id}) eliminado correctamente del inventario.`
    });
  } catch (error) {
    console.error(`Error al eliminar artículo ${id}:`, error);
    res.status(500).json({ error: 'Error interno al eliminar el artículo de inventario.' });
  }
};

/**
 * POST /api/inventario/:id/movimientos (Opcional complementario)
 * Registrar movimiento rápido (entrada/salida de stock)
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
    } else {
      return res.status(400).json({ error: 'Tipo de movimiento no válido (entrada o salida)' });
    }

    await db.query(
      `UPDATE Inventario SET cantidad_stock = ?, ultima_actualizacion = NOW() WHERE Articulo_id = ?`,
      [nuevoStock, id]
    );

    const motivoFinal = motivo || notas || (esEntrada ? 'Reabastecimiento clínico' : 'Consumo en atención');
    const usuarioId = req.user?.Usuario_id || req.user?.id || 1;
    const usuarioNombre = req.user?.nombre_completo || req.user?.rol || 'Recepcionista';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    await registrarAuditoria({
      fk_usuario_id: usuarioId,
      accion_realizada: `[Inventario Movimiento] ${esEntrada ? 'ENTRADA' : 'SALIDA'} en "${articulo.nombre_articulo}" (+/-${cantVal} ${articulo.unidad_medida}). Stock resultante: ${nuevoStock}. Motivo: ${motivoFinal} (por ${usuarioNombre})`,
      tabla_afectada: 'Inventario',
      direccion_ip: ip
    });

    res.json({
      mensaje: 'Movimiento registrado con éxito',
      articulo: {
        ...articulo,
        id: articulo.Articulo_id,
        cantidad_stock: nuevoStock,
        stock: nuevoStock,
        alerta_reabastecer: nuevoStock <= articulo.stock_minimo
      }
    });
  } catch (error) {
    console.error('Error al registrar movimiento:', error);
    res.status(500).json({ error: 'Error al procesar el movimiento de inventario' });
  }
};

/**
 * GET /api/inventario/movimientos
 * Obtener historial de auditoría de inventario
 */
const obtenerMovimientos = async (req, res) => {
  try {
    const resultado = await db.query(
      `SELECT 
        b.Log_id AS id,
        b.fk_usuario_id,
        COALESCE(u.email, 'Sistema') AS usuario_email,
        b.accion_realizada AS detalle,
        b.fecha_hora AS fecha,
        b.direccion_ip
      FROM Bitacora_Auditoria b
      LEFT JOIN Usuarios u ON b.fk_usuario_id = u.Usuario_id
      WHERE b.tabla_afectada = 'Inventario'
      ORDER BY b.fecha_hora DESC, b.Log_id DESC
      LIMIT 100`
    );

    res.json(resultado.rows || []);
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
