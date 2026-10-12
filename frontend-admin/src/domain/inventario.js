/**
 * Dominio · Gestión de Inventario de insumos médicos y materiales podológicos.
 * Lógica pura (sin DOM ni red) para facilitar las pruebas unitarias.
 */
import { sanitizeText, sanitizeNumber } from '../core/sanitize.js';
import { parseDate, toDateKey } from '../utils/dates.js';

export const CATEGORIAS_INSUMO = Object.freeze([
  'Material de curación',
  'Instrumental',
  'Medicamento tópico',
  'Desechable',
  'Ortopédico',
  'Higiene y asepsia',
]);

export const UNIDADES_INSUMO = Object.freeze(['pieza', 'caja', 'paquete', 'frasco', 'tubo', 'par', 'ml', 'g']);

export const TIPOS_MOVIMIENTO = Object.freeze({ ENTRADA: 'entrada', SALIDA: 'salida' });

/** Días previos a la caducidad en que se emite alerta. */
export const DIAS_ALERTA_CADUCIDAD = 30;

/** Insumos de arranque para el modo sin conexión con el backend. */
export const SEED_INSUMOS = Object.freeze([
  { id: 'INS-001', nombre: 'Guantes de nitrilo (M)', categoria: 'Desechable', unidad: 'caja', stock: 14, stockMinimo: 5, costoUnitario: 189, lote: 'L2411', caducidad: '2027-06-30' },
  { id: 'INS-002', nombre: 'Hojas de bisturí No. 15', categoria: 'Instrumental', unidad: 'caja', stock: 3, stockMinimo: 4, costoUnitario: 260, lote: 'B0932', caducidad: '2028-01-15' },
  { id: 'INS-003', nombre: 'Crema de urea al 20%', categoria: 'Medicamento tópico', unidad: 'tubo', stock: 22, stockMinimo: 8, costoUnitario: 148, lote: 'U7781', caducidad: '2026-11-02' },
  { id: 'INS-004', nombre: 'Gasas estériles 10x10', categoria: 'Material de curación', unidad: 'paquete', stock: 0, stockMinimo: 10, costoUnitario: 42, lote: 'G1200', caducidad: '2027-03-10' },
  { id: 'INS-005', nombre: 'Solución antiséptica (povidona)', categoria: 'Higiene y asepsia', unidad: 'frasco', stock: 9, stockMinimo: 4, costoUnitario: 96, lote: 'P5521', caducidad: '2027-09-01' },
  { id: 'INS-006', nombre: 'Silicona ortopédica (separadores)', categoria: 'Ortopédico', unidad: 'par', stock: 31, stockMinimo: 10, costoUnitario: 75, lote: 'O3002', caducidad: '' },
]);

/** Normaliza un registro (API o formulario) al formato interno. */
export function normalizeInsumo(raw = {}) {
  const stock = sanitizeNumber(raw.stock ?? raw.Stock ?? raw.existencia, { min: 0, max: 1e6, decimals: 2 });
  const min = sanitizeNumber(raw.stockMinimo ?? raw.stock_minimo ?? raw.minimo, { min: 0, max: 1e6, decimals: 2 });
  const costo = sanitizeNumber(raw.costoUnitario ?? raw.costo_unitario ?? raw.costo, { min: 0, max: 1e7, decimals: 2 });
  return {
    id: String(raw.id ?? raw.Insumo_id ?? raw.id_insumo ?? ''),
    nombre: sanitizeText(raw.nombre ?? raw.Nombre ?? '', { maxLength: 120 }),
    categoria: sanitizeText(raw.categoria ?? raw.Categoria ?? '', { maxLength: 60 }),
    unidad: sanitizeText(raw.unidad ?? raw.Unidad ?? 'pieza', { maxLength: 20 }),
    stock: stock ?? 0,
    stockMinimo: min ?? 0,
    costoUnitario: costo ?? 0,
    lote: sanitizeText(raw.lote ?? raw.Lote ?? '', { maxLength: 40 }),
    caducidad: String(raw.caducidad ?? raw.Fecha_caducidad ?? '').split('T')[0],
  };
}

export function validateInsumo(i = {}) {
  const errors = {};
  if (!sanitizeText(i.nombre)) errors.nombre = 'Indica el nombre del insumo';
  else if (sanitizeText(i.nombre).length < 3) errors.nombre = 'El nombre es demasiado corto';
  if (!CATEGORIAS_INSUMO.includes(i.categoria)) errors.categoria = 'Selecciona una categoría válida';
  if (!UNIDADES_INSUMO.includes(i.unidad)) errors.unidad = 'Selecciona una unidad válida';
  if (sanitizeNumber(i.stock, { min: 0, max: 1e6 }) === null) errors.stock = 'Stock inicial inválido';
  if (sanitizeNumber(i.stockMinimo, { min: 0, max: 1e6 }) === null) errors.stockMinimo = 'Stock mínimo inválido';
  if (i.costoUnitario !== '' && i.costoUnitario !== undefined && sanitizeNumber(i.costoUnitario, { min: 0, max: 1e7 }) === null) {
    errors.costoUnitario = 'Costo inválido';
  }
  if (i.caducidad && !parseDate(i.caducidad)) errors.caducidad = 'Fecha de caducidad inválida';
  return { valid: !Object.keys(errors).length, errors };
}

/** 'agotado' | 'bajo' | 'ok' */
export function estadoStock(i) {
  if (i.stock <= 0) return 'agotado';
  if (i.stock <= i.stockMinimo) return 'bajo';
  return 'ok';
}

/** 'vencido' | 'por-vencer' | 'vigente' | 'sin-fecha' */
export function estadoCaducidad(i, now = new Date()) {
  const d = parseDate(i.caducidad);
  if (!d) return 'sin-fecha';
  const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d < hoy) return 'vencido';
  const dias = Math.ceil((d - hoy) / 86400000);
  return dias <= DIAS_ALERTA_CADUCIDAD ? 'por-vencer' : 'vigente';
}

export function validateMovimiento(insumo, { tipo, cantidad, motivo } = {}) {
  const errors = {};
  if (!insumo) errors.insumo = 'Selecciona un insumo';
  if (!Object.values(TIPOS_MOVIMIENTO).includes(tipo)) errors.tipo = 'Tipo de movimiento inválido';
  const n = sanitizeNumber(cantidad, { min: 0.01, max: 1e5 });
  if (n === null) errors.cantidad = 'Ingresa una cantidad mayor a 0';
  else if (insumo && tipo === TIPOS_MOVIMIENTO.SALIDA && n > insumo.stock) {
    errors.cantidad = `Stock insuficiente: solo hay ${insumo.stock} ${insumo.unidad}`;
  }
  if (tipo === TIPOS_MOVIMIENTO.SALIDA && !sanitizeText(motivo)) errors.motivo = 'Indica el motivo del descuento';
  return { valid: !Object.keys(errors).length, errors };
}

/**
 * Aplica un movimiento y devuelve el insumo actualizado + el registro de bitácora.
 * @throws {Error} si el movimiento no es válido (p. ej. descontar más de lo disponible).
 */
export function aplicarMovimiento(insumo, mov, now = new Date()) {
  const check = validateMovimiento(insumo, mov);
  if (!check.valid) throw new Error(Object.values(check.errors)[0]);
  const cantidad = sanitizeNumber(mov.cantidad, { min: 0.01, max: 1e5 });
  const delta = mov.tipo === TIPOS_MOVIMIENTO.ENTRADA ? cantidad : -cantidad;
  const stock = Math.round((insumo.stock + delta) * 100) / 100;
  return {
    insumo: { ...insumo, stock },
    movimiento: {
      id: `MOV-${now.getTime()}`,
      fecha: `${toDateKey(now)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      insumoId: insumo.id,
      insumo: insumo.nombre,
      tipo: mov.tipo,
      cantidad,
      unidad: insumo.unidad,
      motivo: sanitizeText(mov.motivo, { maxLength: 160 }),
      stockResultante: stock,
    },
  };
}

export function resumenInventario(list, now = new Date()) {
  const r = { total: list.length, agotados: 0, bajos: 0, porVencer: 0, vencidos: 0, valor: 0 };
  for (const i of list) {
    const e = estadoStock(i);
    if (e === 'agotado') r.agotados += 1;
    else if (e === 'bajo') r.bajos += 1;
    const c = estadoCaducidad(i, now);
    if (c === 'por-vencer') r.porVencer += 1;
    if (c === 'vencido') r.vencidos += 1;
    r.valor += i.stock * i.costoUnitario;
  }
  r.valor = Math.round(r.valor * 100) / 100;
  return r;
}

export function nextInsumoId(list) {
  const max = list.reduce((m, i) => {
    const n = Number(String(i.id).replace(/\D/g, ''));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `INS-${String(max + 1).padStart(3, '0')}`;
}
