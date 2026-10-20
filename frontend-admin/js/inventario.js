/**
 * Control de Inventario & Farmacia Podológica (Vanilla JS)
 * Vista Recepcionista (Rol ID: 3) y Administrador (Rol ID: 1)
 */

// Estado global de la aplicación
const InventarioState = {
  articulos: [],
  articulosFiltrados: [],
  articuloSeleccionadoId: null,
  clinicas: [],
  filtroTexto: '',
  filtroCategoria: 'Todas',
  filtroEstado: 'todos',
  usuarioActual: null
};

// Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', async () => {
  await inicializarModulo();
});

/**
 * Inicialización con validación de sesión RBAC
 */
async function inicializarModulo() {
  // 1. Validar guardia RBAC: Solo Admin (1) y Recepcionista (3)
  let usuario = AppAuth.getCurrentUser();
  if (!usuario) {
    console.info('No se detectó sesión activa. Autenticando con cuenta demo de Recepcionista...');
    usuario = await AppAuth.autoLoginDemo(3);
  }

  // Verificar rol
  usuario = AppAuth.checkAuthGuard([1, 3]);
  if (!usuario) return;

  InventarioState.usuarioActual = usuario;
  renderizarUsuarioEnHeader(usuario);

  // 2. Cargar clínicas activas para el select del modal
  await cargarClinicas();

  // 3. Cargar catálogo de inventario
  await cargarInventario();

  // 4. Vincular listeners de interacción
  configurarEventos();
}

/**
 * Despliega información del usuario en el header superior
 */
function renderizarUsuarioEnHeader(usuario) {
  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-role-text');
  const avatarEl = document.getElementById('user-avatar-initials');

  const rolId = Number(usuario.fk_rol_id || usuario.rolId || 3);
  const nombre = usuario.nombre_completo || usuario.nombre || (rolId === 1 ? 'Administrador General' : 'María López');
  const rolTexto = rolId === 1 ? 'Rol ID: 1 • Administrador' : 'Rol ID: 3 • Recepcionista';

  if (nameEl) nameEl.textContent = nombre;
  if (roleEl) roleEl.textContent = rolTexto;

  if (avatarEl) {
    const iniciales = nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    avatarEl.textContent = iniciales || 'ML';
  }
}

/**
 * Obtener listado de clínicas para el formulario
 */
async function cargarClinicas() {
  try {
    const res = await AppAuth.fetchApi('/api/clinicas');
    if (res.ok && Array.isArray(res.data)) {
      InventarioState.clinicas = res.data;
      poblarSelectClinicas(res.data);
    }
  } catch (err) {
    console.warn('No se pudo cargar clínicas dinámicas:', err);
  }
}

function poblarSelectClinicas(clinicas) {
  const select = document.getElementById('articulo-clinica');
  if (!select) return;

  select.innerHTML = '';
  if (clinicas.length === 0) {
    select.innerHTML = '<option value="1">Sucursal Centro</option>';
    return;
  }

  clinicas.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.Clinica_id || c.id;
    opt.textContent = `${c.Nombre || 'Clínica'} (${c.Municipio_clinica || 'Sede'})`;
    select.appendChild(opt);
  });
}

/**
 * Carga el inventario consumiendo GET /api/inventario
 */
async function cargarInventario() {
  const tbody = document.getElementById('tabla-inventario-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 2.5rem; color: var(--text-secondary);">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.8rem; color: var(--color-primary); margin-bottom: 0.5rem; display:block;"></i>
          Cargando inventario clínico...
        </td>
      </tr>
    `;
  }

  try {
    const res = await AppAuth.fetchApi('/api/inventario');
    if (!res.ok) {
      throw new Error(res.data?.error || 'Error al obtener inventario');
    }

    InventarioState.articulos = res.data || [];
    actualizarKPIs(InventarioState.articulos);
    aplicarFiltros();
  } catch (err) {
    console.error('Error al cargar inventario:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding: 2.5rem; color: #f87171;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 0.5rem; display:block;"></i>
            Error al conectar con el servidor: ${err.message}
          </td>
        </tr>
      `;
    }
    AppAuth.showToast('No se pudo cargar el inventario: ' + err.message, 'error');
  }
}

/**
 * Actualiza las tarjetas KPI métricas
 */
function actualizarKPIs(articulos) {
  const totalEl = document.getElementById('kpi-total-articulos');
  const reabastecerEl = document.getElementById('kpi-reabastecer');
  const agotadosEl = document.getElementById('kpi-agotados');
  const optimosEl = document.getElementById('kpi-optimos');

  const total = articulos.length;
  const agotados = articulos.filter(a => Number(a.cantidad_stock) <= 0).length;
  const reabastecer = articulos.filter(a => Number(a.cantidad_stock) <= Number(a.stock_minimo)).length;
  const optimos = articulos.filter(a => Number(a.cantidad_stock) > Number(a.stock_minimo)).length;

  if (totalEl) totalEl.textContent = total;
  if (reabastecerEl) reabastecerEl.textContent = reabastecer;
  if (agotadosEl) agotadosEl.textContent = agotados;
  if (optimosEl) optimosEl.textContent = optimos;
}

/**
 * Filtra los artículos según búsqueda, categoría y condición de stock
 */
function aplicarFiltros() {
  const q = (InventarioState.filtroTexto || '').toLowerCase().trim();
  const cat = InventarioState.filtroCategoria;
  const est = InventarioState.filtroEstado;

  InventarioState.articulosFiltrados = InventarioState.articulos.filter(item => {
    // Filtro de texto por nombre, código o categoría
    const matchText = !q || 
      (item.nombre_articulo || '').toLowerCase().includes(q) ||
      (item.categoria || '').toLowerCase().includes(q) ||
      (item.codigo || '').toLowerCase().includes(q);

    // Filtro por categoría
    const matchCat = cat === 'Todas' || item.categoria === cat;

    // Filtro por estado de stock
    const stock = Number(item.cantidad_stock);
    const min = Number(item.stock_minimo);
    let matchEst = true;

    if (est === 'reabastecer') {
      matchEst = stock <= min;
    } else if (est === 'agotados') {
      matchEst = stock <= 0;
    } else if (est === 'optimo') {
      matchEst = stock > min;
    }

    return matchText && matchCat && matchEst;
  });

  renderizarTabla(InventarioState.articulosFiltrados);
}

/**
 * Renderiza la tabla HTML aplicando el sistema de alertas visuales
 */
function renderizarTabla(articulos) {
  const tbody = document.getElementById('tabla-inventario-body');
  const contadorEl = document.getElementById('contador-registros');
  if (!tbody) return;

  if (contadorEl) {
    contadorEl.textContent = `Mostrando ${articulos.length} de ${InventarioState.articulos.length} artículos`;
  }

  if (articulos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-table-state">
            <i class="fa-solid fa-box-open"></i>
            <h3>No se encontraron insumos</h3>
            <p>Ajusta los criterios de búsqueda o agrega un nuevo artículo al catálogo.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = articulos.map(item => {
    const stock = Number(item.cantidad_stock);
    const min = Number(item.stock_minimo);

    // Detección de niveles de alerta
    const esAgotado = stock <= 0;
    const necesitaReabastecer = stock <= min;

    // Clases visuales según el requerimiento:
    // "si cantidad_stock es menor o igual a stock_minimo, la fila o el número debe resaltar en rojo o amarillo"
    let rowClass = '';
    let pillClass = 'stock-pill-optimo';
    let badgeEstado = `
      <span class="badge-alerta-optimo">
        <i class="fa-solid fa-circle-check"></i> En Existencia
      </span>
    `;

    if (esAgotado) {
      rowClass = 'row-stock-critico';
      pillClass = 'stock-pill-critico';
      badgeEstado = `
        <span class="badge-alerta-agotado" title="Stock en 0 unidades">
          <i class="fa-solid fa-circle-xmark"></i> Agotado (0)
        </span>
      `;
    } else if (necesitaReabastecer) {
      rowClass = 'row-stock-alerta';
      pillClass = 'stock-pill-alerta';
      const faltante = min - stock;
      badgeEstado = `
        <span class="badge-alerta-reabastecer" title="Mínimo: ${min}. Faltan ${faltante} para nivel óptimo">
          <i class="fa-solid fa-triangle-exclamation"></i> Reabastecer (-${faltante})
        </span>
      `;
    }

    // Badge de categoría con color según grupo
    const catClass = getCategoryClass(item.categoria);

    // Formatear fecha
    const fechaActualizacion = formatearFecha(item.ultima_actualizacion);

    return `
      <tr class="${rowClass}" data-id="${item.Articulo_id}">
        <td>
          <span style="font-family: monospace; font-weight: 700; color: #38bdf8;">${item.codigo || `INS-${String(item.Articulo_id).padStart(3, '0')}`}</span>
        </td>
        <td>
          <div style="font-weight: 700; color: #f8fafc; font-size: 0.95rem;">${escapeHtml(item.nombre_articulo)}</div>
          <div style="font-size: 0.76rem; color: var(--text-muted);">${item.clinica_nombre || 'Sucursal Centro'}</div>
        </td>
        <td>
          <span class="category-badge ${catClass}">
            ${escapeHtml(item.categoria || 'General')}
          </span>
        </td>
        <td>
          <!-- Resaltado numérico con píldora reactiva -->
          <span class="stock-pill ${pillClass}">
            <i class="fa-solid ${esAgotado ? 'fa-triangle-exclamation' : (necesitaReabastecer ? 'fa-arrow-down' : 'fa-check')}"></i>
            <span>${stock}</span>
          </span>
        </td>
        <td>
          <span style="font-weight: 600; color: var(--text-secondary);">${min}</span>
        </td>
        <td>
          <span style="color: var(--text-secondary); font-size: 0.85rem;">${escapeHtml(item.unidad_medida || 'Pieza')}</span>
        </td>
        <td>
          ${badgeEstado}
        </td>
        <td>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${fechaActualizacion}</div>
        </td>
        <td>
          <div class="table-actions">
            <button 
              type="button" 
              class="btn-icon-action btn-edit" 
              onclick="abrirModalEditar(${item.Articulo_id})" 
              title="Editar insumo y stock">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button 
              type="button" 
              class="btn-icon-action btn-delete" 
              onclick="confirmarEliminar(${item.Articulo_id}, '${escapeHtml(item.nombre_articulo)}')" 
              title="Eliminar insumo">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Obtiene la clase CSS para el badge según categoría
 */
function getCategoryClass(cat) {
  if (!cat) return '';
  const c = cat.toLowerCase();
  if (c.includes('curac')) return 'cat-curacion';
  if (c.includes('instrum')) return 'cat-instrumental';
  if (c.includes('medic') || c.includes('farma')) return 'cat-medicamentos';
  if (c.includes('desech')) return 'cat-desechables';
  if (c.includes('orto') || c.includes('plant')) return 'cat-ortopodologia';
  return '';
}

/**
 * Configurar los eventos de filtrado y modal
 */
function configurarEventos() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      InventarioState.filtroTexto = e.target.value;
      aplicarFiltros();
    });
  }

  const categoryFilter = document.getElementById('category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      InventarioState.filtroCategoria = e.target.value;
      aplicarFiltros();
    });
  }

  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      InventarioState.filtroEstado = e.target.value;
      aplicarFiltros();
    });
  }

  // Tarjetas KPI como accesos rápidos de filtro
  const cardReabastecer = document.getElementById('kpi-card-reabastecer');
  if (cardReabastecer) {
    cardReabastecer.addEventListener('click', () => {
      if (statusFilter) {
        statusFilter.value = 'reabastecer';
        InventarioState.filtroEstado = 'reabastecer';
        aplicarFiltros();
      }
    });
  }

  const cardAgotados = document.getElementById('kpi-card-agotados');
  if (cardAgotados) {
    cardAgotados.addEventListener('click', () => {
      if (statusFilter) {
        statusFilter.value = 'agotados';
        InventarioState.filtroEstado = 'agotados';
        aplicarFiltros();
      }
    });
  }

  // Formulario del Modal (Alta / Edición)
  const form = document.getElementById('form-articulo');
  if (form) {
    form.addEventListener('submit', guardarArticulo);
  }

  // Previsualización reactiva de alerta en el modal al tipear stock y mínimo
  const stockInput = document.getElementById('articulo-stock');
  const minInput = document.getElementById('articulo-minimo');
  if (stockInput && minInput) {
    const actualizarPreview = () => {
      const s = parseInt(stockInput.value, 10) || 0;
      const m = parseInt(minInput.value, 10) || 0;
      const previewBox = document.getElementById('modal-alerta-preview');
      if (!previewBox) return;

      if (s <= 0) {
        previewBox.style.display = 'flex';
        previewBox.className = 'security-alert-box danger';
        previewBox.innerHTML = `
          <i class="fa-solid fa-triangle-exclamation security-alert-icon"></i>
          <div><strong>Alerta Crítica:</strong> El stock inicial es 0. El artículo se marcará como <strong>Agotado</strong>.</div>
        `;
      } else if (s <= m) {
        previewBox.style.display = 'flex';
        previewBox.className = 'security-alert-box warning';
        previewBox.innerHTML = `
          <i class="fa-solid fa-circle-exclamation security-alert-icon"></i>
          <div><strong>Alerta de Reabastecimiento:</strong> El stock (${s}) es menor o igual al mínimo (${m}). Se activará el indicador de reposición.</div>
        `;
      } else {
        previewBox.style.display = 'none';
      }
    };

    stockInput.addEventListener('input', actualizarPreview);
    minInput.addEventListener('input', actualizarPreview);
  }
}

/**
 * Abre el modal en modo "Agregar Artículo"
 */
function abrirModalCrear() {
  const modal = document.getElementById('modal-articulo');
  const title = document.getElementById('modal-articulo-titulo');
  const form = document.getElementById('form-articulo');
  const preview = document.getElementById('modal-alerta-preview');

  if (!modal || !form) return;

  InventarioState.articuloSeleccionadoId = null;
  form.reset();

  if (title) {
    title.innerHTML = '<i class="fa-solid fa-box-archive" style="color: #38bdf8;"></i> Nuevo Insumo de Inventario';
  }

  // Valores predeterminados
  const stockInput = document.getElementById('articulo-stock');
  const minInput = document.getElementById('articulo-minimo');
  if (stockInput) stockInput.value = 10;
  if (minInput) minInput.value = 5;

  if (preview) preview.style.display = 'none';

  modal.showModal();
}

/**
 * Abre el modal en modo "Editar Artículo" (Especialmente para actualizar cantidad_stock)
 */
async function abrirModalEditar(id) {
  const modal = document.getElementById('modal-articulo');
  const title = document.getElementById('modal-articulo-titulo');
  const form = document.getElementById('form-articulo');
  const preview = document.getElementById('modal-alerta-preview');

  if (!modal || !form) return;

  // Buscar artículo en memoria o solicitar por endpoint GET /api/inventario/:id
  let item = InventarioState.articulos.find(a => a.Articulo_id === id);

  try {
    const res = await AppAuth.fetchApi(`/api/inventario/${id}`);
    if (res.ok && res.data) {
      item = res.data;
    }
  } catch (err) {
    console.warn('Utilizando datos en caché:', err);
  }

  if (!item) {
    AppAuth.showToast('No se encontró la información del artículo.', 'error');
    return;
  }

  InventarioState.articuloSeleccionadoId = id;

  if (title) {
    title.innerHTML = `<i class="fa-solid fa-pen-to-square" style="color: #fbbf24;"></i> Editar Insumo <span style="font-family: monospace; color: #38bdf8; font-size: 0.95rem;">(${item.codigo || `INS-${String(id).padStart(3, '0')}`})</span>`;
  }

  // Poblar formulario
  const nombreInput = document.getElementById('articulo-nombre');
  const catInput = document.getElementById('articulo-categoria');
  const stockInput = document.getElementById('articulo-stock');
  const unidadInput = document.getElementById('articulo-unidad');
  const minInput = document.getElementById('articulo-minimo');
  const clinicaInput = document.getElementById('articulo-clinica');

  if (nombreInput) nombreInput.value = item.nombre_articulo || '';
  if (catInput) catInput.value = item.categoria || 'Material de Curación';
  if (stockInput) stockInput.value = item.cantidad_stock !== undefined ? item.cantidad_stock : 0;
  if (unidadInput) unidadInput.value = item.unidad_medida || 'Pieza';
  if (minInput) minInput.value = item.stock_minimo !== undefined ? item.stock_minimo : 5;
  if (clinicaInput && item.fk_clinica_id) clinicaInput.value = item.fk_clinica_id;

  // Disparar preview
  if (stockInput && minInput && preview) {
    const s = Number(stockInput.value);
    const m = Number(minInput.value);
    if (s <= m) {
      preview.style.display = 'flex';
      preview.className = s <= 0 ? 'security-alert-box danger' : 'security-alert-box warning';
      preview.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation security-alert-icon"></i>
        <div><strong>Alerta de Reabastecimiento activa:</strong> Stock actual (${s}) <= Stock mínimo (${m}).</div>
      `;
    } else {
      preview.style.display = 'none';
    }
  }

  modal.showModal();
}

/**
 * Cierra un diálogo nativo
 */
function cerrarModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.close();
}

/**
 * Guarda o actualiza el artículo (POST / PUT)
 */
async function guardarArticulo(e) {
  e.preventDefault();

  const id = InventarioState.articuloSeleccionadoId;
  const esEdicion = Boolean(id);

  const nombre = document.getElementById('articulo-nombre')?.value.trim();
  const categoria = document.getElementById('articulo-categoria')?.value;
  const cantidad_stock = parseInt(document.getElementById('articulo-stock')?.value, 10) || 0;
  const unidad_medida = document.getElementById('articulo-unidad')?.value;
  const stock_minimo = parseInt(document.getElementById('articulo-minimo')?.value, 10) || 0;
  const fk_clinica_id = parseInt(document.getElementById('articulo-clinica')?.value, 10) || 1;

  if (!nombre) {
    AppAuth.showToast('El nombre del artículo es obligatorio.', 'error');
    return;
  }

  const payload = {
    nombre_articulo: nombre,
    categoria,
    cantidad_stock,
    unidad_medida,
    stock_minimo,
    fk_clinica_id
  };

  const btnSubmit = document.getElementById('btn-guardar-articulo');
  const originalText = btnSubmit ? btnSubmit.innerHTML : 'Guardar';
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...`;
  }

  try {
    const endpoint = esEdicion ? `/api/inventario/${id}` : '/api/inventario';
    const method = esEdicion ? 'PUT' : 'POST';

    const res = await AppAuth.fetchApi(endpoint, {
      method,
      body: JSON.stringify(payload)
    });

    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalText;
    }

    if (!res.ok) {
      // Captura de bloqueo RBAC 403
      if (res.status === 403) {
        AppAuth.showToast('🛡️ Acción bloqueada: Solo Administrador y Recepcionista (Rol ID: 3) tienen permisos.', 'error');
        return;
      }
      throw new Error(res.data?.error || 'Error al procesar la solicitud');
    }

    cerrarModal('modal-articulo');
    AppAuth.showToast(esEdicion ? 'Artículo y stock actualizados correctamente.' : 'Nuevo artículo agregado con éxito al inventario.', 'success');
    await cargarInventario();
  } catch (err) {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalText;
    }
    console.error('Error al guardar artículo:', err);
    AppAuth.showToast(err.message, 'error');
  }
}

/**
 * Diálogo estilizado de confirmación para eliminar
 */
function confirmarEliminar(id, nombre) {
  const modal = document.getElementById('modal-confirmar-eliminar');
  const spanNombre = document.getElementById('eliminar-articulo-nombre');
  const btnConfirmar = document.getElementById('btn-confirmar-eliminar');

  if (!modal) return;

  if (spanNombre) {
    spanNombre.textContent = `"${nombre}" (#INS-${String(id).padStart(3, '0')})`;
  }

  if (btnConfirmar) {
    btnConfirmar.onclick = () => ejecutarEliminacion(id);
  }

  modal.showModal();
}

/**
 * Ejecuta el DELETE /api/inventario/:id
 */
async function ejecutarEliminacion(id) {
  const btnConfirmar = document.getElementById('btn-confirmar-eliminar');
  if (btnConfirmar) {
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Eliminando...`;
  }

  try {
    const res = await AppAuth.fetchApi(`/api/inventario/${id}`, {
      method: 'DELETE'
    });

    if (btnConfirmar) {
      btnConfirmar.disabled = false;
      btnConfirmar.innerHTML = `<i class="fa-solid fa-trash-can"></i> Confirmar Eliminación`;
    }

    cerrarModal('modal-confirmar-eliminar');

    if (!res.ok) {
      if (res.status === 403) {
        AppAuth.showToast('🛡️ Eliminación denegada por directiva de seguridad RBAC.', 'error');
        return;
      }
      throw new Error(res.data?.error || 'No se pudo eliminar el artículo');
    }

    AppAuth.showToast(res.data?.mensaje || 'Artículo eliminado del inventario correctamente.', 'info');
    await cargarInventario();
  } catch (err) {
    if (btnConfirmar) {
      btnConfirmar.disabled = false;
      btnConfirmar.innerHTML = `<i class="fa-solid fa-trash-can"></i> Confirmar Eliminación`;
    }
    cerrarModal('modal-confirmar-eliminar');
    console.error('Error al eliminar artículo:', err);
    AppAuth.showToast(err.message, 'error');
  }
}

/**
 * Formato de fecha legible
 */
function formatearFecha(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Escapar HTML para evitar XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Exportar funciones a la ventana global para invocación desde HTML
window.abrirModalCrear = abrirModalCrear;
window.abrirModalEditar = abrirModalEditar;
window.cerrarModal = cerrarModal;
window.confirmarEliminar = confirmarEliminar;
window.cargarInventario = cargarInventario;
