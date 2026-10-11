/**
 * Capa de Presentación · Módulo de Inventario de insumos médicos y materiales podológicos.
 * Registro de insumos, entradas y descuento de stock con bitácora de movimientos.
 * Las acciones sensibles se muestran solo si el rol posee la capacidad (RBAC).
 */
import { esc, debounce } from '../utils/html.js';
import { inventarioApi } from '../api/index.js';
import {
  CATEGORIAS_INSUMO, UNIDADES_INSUMO, TIPOS_MOVIMIENTO, estadoStock, estadoCaducidad, resumenInventario,
  validateInsumo, validateMovimiento, normalizeInsumo,
} from '../domain/inventario.js';
import { sanitizeText } from '../core/sanitize.js';
import { can } from '../core/rbac.js';
import { formatFechaCorta } from '../utils/dates.js';
import { notify, openModal, skeleton, emptyState, errorState } from './ui.js';
import { pageHeader } from './shellView.js';

const STOCK_BADGE = {
  agotado: ['Agotado', 'bad'],
  bajo: ['Stock bajo', 'warn'],
  ok: ['Disponible', 'ok'],
};
const CAD_BADGE = {
  vencido: ['Vencido', 'bad'],
  'por-vencer': ['Por vencer', 'warn'],
  vigente: ['Vigente', 'ok'],
  'sin-fecha': ['N/A', 'muted'],
};

const pill = ([label, tone]) => `<span class="pill pill--${tone}">${esc(label)}</span>`;
const money = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);

export function renderInventarioShell() {
  return '<section class="module" id="inventario-root" aria-live="polite"></section>';
}

export function mountInventario(root, ctx) {
  const role = () => ctx.getRole();
  const S = { status: 'loading', error: '', items: [], movs: [], source: 'api', q: '', cat: '', estado: '' };

  async function load() {
    S.status = 'loading';
    paint();
    try {
      const [inv, mov] = await Promise.all([inventarioApi.list(), inventarioApi.movimientos().catch(() => ({ data: [] }))]);
      S.items = inv.data;
      S.source = inv.source;
      S.movs = (mov.data || []).slice(0, 8);
      S.status = 'ready';
    } catch (err) {
      S.status = 'error';
      S.error = err.message || 'Error desconocido';
    }
    paint();
  }

  const visibles = () => {
    const q = sanitizeText(S.q).toLowerCase();
    return S.items.filter((i) => {
      if (q && !`${i.nombre} ${i.lote} ${i.id}`.toLowerCase().includes(q)) return false;
      if (S.cat && i.categoria !== S.cat) return false;
      if (S.estado && estadoStock(i) !== S.estado) return false;
      return true;
    });
  };

  function tableRows() {
    const list = visibles();
    if (!list.length) return `<tr><td colspan="7">${emptyState('fa-box-open', 'Sin insumos', 'Ajusta los filtros o registra un nuevo insumo.')}</td></tr>`;
    return list
      .map((i) => {
        const e = estadoStock(i);
        const c = estadoCaducidad(i);
        return `
        <tr data-id="${esc(i.id)}">
          <td><strong>${esc(i.nombre)}</strong><small>${esc(i.id)} · Lote ${esc(i.lote || '—')}</small></td>
          <td>${esc(i.categoria)}</td>
          <td class="num"><b>${esc(i.stock)}</b> <small>${esc(i.unidad)}</small><small>mín. ${esc(i.stockMinimo)}</small></td>
          <td>${pill(STOCK_BADGE[e])}</td>
          <td>${i.caducidad ? `${esc(formatFechaCorta(i.caducidad))} ` : ''}${pill(CAD_BADGE[c])}</td>
          <td class="num">${esc(money(i.costoUnitario))}</td>
          <td class="row-actions">
            <button type="button" class="efc-btn efc-btn--ghost efc-btn--sm" data-mov="entrada" data-id="${esc(i.id)}" title="Registrar entrada"><i class="fa-solid fa-arrow-down-to-line" aria-hidden="true"></i> Entrada</button>
            ${can(role(), 'inventario.descontar') ? `<button type="button" class="efc-btn efc-btn--danger-soft efc-btn--sm" data-mov="salida" data-id="${esc(i.id)}" title="Descontar insumo"><i class="fa-solid fa-minus" aria-hidden="true"></i> Descontar</button>` : ''}
          </td>
        </tr>`;
      })
      .join('');
  }

  function paint() {
    if (S.status === 'loading') {
      root.innerHTML = pageHeader({ title: 'Inventario', icon: 'fa-boxes-stacked', subtitle: 'Cargando insumos…' }) + skeleton(6);
      return;
    }
    if (S.status === 'error') {
      root.innerHTML = pageHeader({ title: 'Inventario', icon: 'fa-boxes-stacked' }) + errorState(S.error);
      return;
    }
    const r = resumenInventario(S.items);
    root.innerHTML = `
      ${pageHeader({
        title: 'Inventario',
        icon: 'fa-boxes-stacked',
        subtitle: 'Control de insumos médicos y materiales podológicos',
        actions: can(role(), 'inventario.registrar')
          ? '<button type="button" class="efc-btn efc-btn--primary" id="btn-nuevo-insumo"><i class="fa-solid fa-plus" aria-hidden="true"></i> Registrar insumo</button>'
          : '',
      })}
      ${S.source === 'local' ? '<div class="ece-alert ece-alert--warn" role="status"><i class="fa-solid fa-circle-info"></i><div>Modo local: el endpoint <code>/api/inventario</code> no está disponible; los cambios se guardan solo en esta sesión.</div></div>' : ''}

      <div class="kpi-grid kpi-grid--compact">
        <article class="kpi kpi--blue"><div class="kpi-icon"><i class="fa-solid fa-cubes"></i></div><div class="kpi-body"><span class="kpi-label">Insumos</span><strong class="kpi-value">${esc(r.total)}</strong><small class="kpi-hint">${esc(money(r.valor))} en existencias</small></div></article>
        <article class="kpi kpi--rose"><div class="kpi-icon"><i class="fa-solid fa-ban"></i></div><div class="kpi-body"><span class="kpi-label">Agotados</span><strong class="kpi-value">${esc(r.agotados)}</strong><small class="kpi-hint">Requieren reposición</small></div></article>
        <article class="kpi kpi--amber"><div class="kpi-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="kpi-body"><span class="kpi-label">Stock bajo</span><strong class="kpi-value">${esc(r.bajos)}</strong><small class="kpi-hint">En o bajo el mínimo</small></div></article>
        <article class="kpi kpi--teal"><div class="kpi-icon"><i class="fa-regular fa-calendar-xmark"></i></div><div class="kpi-body"><span class="kpi-label">Caducidad</span><strong class="kpi-value">${esc(r.porVencer + r.vencidos)}</strong><small class="kpi-hint">${esc(r.vencidos)} vencidos · ${esc(r.porVencer)} por vencer</small></div></article>
      </div>

      <div class="panel glass">
        <div class="toolbar">
          <label class="search-field"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input id="inv-buscar" type="search" maxlength="60" placeholder="Buscar insumo, lote o clave" value="${esc(S.q)}" aria-label="Buscar insumo"></label>
          <select id="inv-cat" aria-label="Filtrar por categoría"><option value="">Todas las categorías</option>${CATEGORIAS_INSUMO.map((c) => `<option ${S.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
          <select id="inv-estado" aria-label="Filtrar por estado de stock">
            <option value="">Todo el stock</option>
            ${['agotado', 'bajo', 'ok'].map((k) => `<option value="${k}" ${S.estado === k ? 'selected' : ''}>${esc(STOCK_BADGE[k][0])}</option>`).join('')}
          </select>
        </div>
        <div class="table-wrap">
          <table class="data-table" id="tabla-inventario">
            <thead><tr><th>Insumo</th><th>Categoría</th><th>Existencia</th><th>Stock</th><th>Caducidad</th><th>Costo unit.</th><th><span class="sr-only">Acciones</span></th></tr></thead>
            <tbody id="inv-body">${tableRows()}</tbody>
          </table>
        </div>
      </div>

      <div class="panel glass">
        <header class="panel-head"><h3>Últimos movimientos</h3><span class="panel-tag">Bitácora</span></header>
        ${
          S.movs.length
            ? `<ul class="timeline">${S.movs
                .map(
                  (m) =>
                    `<li><span class="tl-dot tl-dot--${m.tipo === 'entrada' ? 'in' : 'out'}"></span><div><strong>${esc(m.insumo)}</strong><small>${m.tipo === 'entrada' ? '+' : '−'}${esc(m.cantidad)} ${esc(m.unidad)} · ${esc(m.motivo || 'Entrada de stock')} · ${esc(m.fecha)}</small></div><b>${esc(m.stockResultante)}</b></li>`
                )
                .join('')}</ul>`
            : '<p class="note">Aún no hay movimientos registrados en esta sesión.</p>'
        }
      </div>`;
  }

  // ---------- Modales ----------
  function openInsumoModal() {
    const modal = openModal({
      id: 'modal-insumo',
      title: 'Registrar insumo',
      subtitle: 'Alta de material en el inventario',
      width: 560,
      body: `
        <form id="form-insumo" class="form-grid" novalidate>
          <label class="field span2">Nombre del insumo<input name="nombre" id="ins-nombre" maxlength="120" required autocomplete="off"><small class="field-err" data-err="nombre"></small></label>
          <label class="field">Categoría<select name="categoria" id="ins-categoria">${CATEGORIAS_INSUMO.map((c) => `<option>${esc(c)}</option>`).join('')}</select><small class="field-err" data-err="categoria"></small></label>
          <label class="field">Unidad<select name="unidad" id="ins-unidad">${UNIDADES_INSUMO.map((u) => `<option>${esc(u)}</option>`).join('')}</select><small class="field-err" data-err="unidad"></small></label>
          <label class="field">Stock inicial<input name="stock" id="ins-stock" type="number" min="0" step="any" value="0" inputmode="decimal"><small class="field-err" data-err="stock"></small></label>
          <label class="field">Stock mínimo<input name="stockMinimo" id="ins-min" type="number" min="0" step="any" value="1" inputmode="decimal"><small class="field-err" data-err="stockMinimo"></small></label>
          <label class="field">Costo unitario (MXN)<input name="costoUnitario" id="ins-costo" type="number" min="0" step="0.01" value="0" inputmode="decimal"><small class="field-err" data-err="costoUnitario"></small></label>
          <label class="field">Lote<input name="lote" id="ins-lote" maxlength="40" autocomplete="off"></label>
          <label class="field span2">Fecha de caducidad<input name="caducidad" id="ins-caducidad" type="date"><small class="field-err" data-err="caducidad"></small></label>
          <div class="efc-actions span2">
            <button type="button" class="efc-btn efc-btn--ghost" data-modal-close>Cancelar</button>
            <button type="submit" class="efc-btn efc-btn--primary" id="btn-guardar-insumo"><i class="fa-solid fa-floppy-disk"></i> Guardar insumo</button>
          </div>
        </form>`,
    });
    const form = modal.el.querySelector('#form-insumo');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const { valid, errors } = validateInsumo(data);
      form.querySelectorAll('[data-err]').forEach((el) => { el.textContent = errors[el.dataset.err] || ''; });
      if (!valid) return;
      try {
        const res = await inventarioApi.create(normalizeInsumo(data));
        S.source = res.source === 'local' ? 'local' : S.source;
        notify(`Insumo registrado: ${res.data.nombre}`);
        modal.close();
        load();
      } catch (err) {
        notify(err.message || 'No se pudo registrar el insumo');
      }
    });
  }

  function openMovModal(tipo, id) {
    const insumo = S.items.find((i) => String(i.id) === String(id));
    if (!insumo) return;
    if (tipo === TIPOS_MOVIMIENTO.SALIDA && !can(role(), 'inventario.descontar')) {
      notify('Tu rol no tiene permiso para descontar insumos');
      return;
    }
    const esSalida = tipo === TIPOS_MOVIMIENTO.SALIDA;
    const modal = openModal({
      id: 'modal-movimiento',
      title: esSalida ? 'Descontar insumo' : 'Registrar entrada',
      subtitle: `${insumo.nombre} · existencia actual: ${insumo.stock} ${insumo.unidad}`,
      width: 460,
      body: `
        <form id="form-mov" class="form-grid" novalidate>
          <label class="field span2">Cantidad (${esc(insumo.unidad)})<input name="cantidad" id="mov-cantidad" type="number" min="0.01" step="any" inputmode="decimal" required><small class="field-err" data-err="cantidad"></small></label>
          <label class="field span2">${esSalida ? 'Motivo del descuento' : 'Referencia (opcional)'}<input name="motivo" id="mov-motivo" maxlength="160" autocomplete="off" ${esSalida ? 'required placeholder="Ej. Consulta, merma, caducidad"' : 'placeholder="Ej. Compra a proveedor"'}><small class="field-err" data-err="motivo"></small></label>
          <div class="efc-actions span2">
            <button type="button" class="efc-btn efc-btn--ghost" data-modal-close>Cancelar</button>
            <button type="submit" class="efc-btn ${esSalida ? 'efc-btn--danger' : 'efc-btn--primary'}" id="btn-confirmar-mov">${esSalida ? 'Descontar' : 'Registrar entrada'}</button>
          </div>
        </form>`,
    });
    const form = modal.el.querySelector('#form-mov');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const mov = { tipo, ...Object.fromEntries(new FormData(form).entries()) };
      const { valid, errors } = validateMovimiento(insumo, mov);
      form.querySelectorAll('[data-err]').forEach((el) => { el.textContent = errors[el.dataset.err] || ''; });
      if (!valid) return;
      try {
        await inventarioApi.registrarMovimiento(insumo, mov);
        notify(esSalida ? 'Descuento registrado' : 'Entrada registrada');
        modal.close();
        load();
      } catch (err) {
        notify(err.message || 'No se pudo registrar el movimiento');
      }
    });
  }

  // ---------- Eventos ----------
  const refreshBody = () => {
    const body = root.querySelector('#inv-body');
    if (body) body.innerHTML = tableRows();
  };
  const onSearch = debounce((v) => { S.q = v; refreshBody(); }, 150);

  root.addEventListener('input', (e) => {
    if (e.target.id === 'inv-buscar') onSearch(e.target.value);
  });
  root.addEventListener('change', (e) => {
    if (e.target.id === 'inv-cat') { S.cat = e.target.value; refreshBody(); }
    if (e.target.id === 'inv-estado') { S.estado = e.target.value; refreshBody(); }
  });
  root.addEventListener('click', (e) => {
    if (e.target.closest('#btn-nuevo-insumo')) return openInsumoModal();
    const mov = e.target.closest('[data-mov]');
    if (mov) return openMovModal(mov.dataset.mov, mov.dataset.id);
    if (e.target.closest('[data-retry]')) return load();
  });

  load();
  return { reload: load, state: S, destroy() { onSearch.cancel(); } };
}
