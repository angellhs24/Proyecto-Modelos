/**
 * Control de Acceso Basado en Roles (RBAC) - capa de presentación.
 *
 * IMPORTANTE: el control en el cliente solo mejora la experiencia (oculta lo no permitido) y
 * es una primera barrera. La autorización definitiva SIEMPRE debe imponerla el backend
 * (middleware que valide el rol dentro del JWT en cada endpoint).
 */
import { ROLES } from '../config.js';

export { ROLES };

/** Páginas (módulos de la SPA) a las que accede cada rol. */
export const PAGE_ACCESS = Object.freeze({
  [ROLES.ADMINISTRADOR]: Object.freeze([
    'inicio', 'agenda', 'pacientes', 'consulta', 'agendar', 'expediente', 'recetas', 'mapa', 'pagos', 'inventario', 'auditoria', 'reportes',
  ]),
  [ROLES.PODOLOGO]: Object.freeze([
    'inicio', 'agenda', 'pacientes', 'consulta', 'agendar', 'expediente', 'recetas', 'mapa', 'pagos', 'inventario', 'auditoria', 'reportes',
  ]),
  [ROLES.RECEPCION]: Object.freeze(['inicio', 'agenda', 'pacientes', 'agendar', 'pagos', 'inventario']),
});

/** Capacidades finas (acciones) por rol. */
export const CAPABILITIES = Object.freeze({
  [ROLES.ADMINISTRADOR]: Object.freeze(['inventario.registrar', 'inventario.descontar', 'receta.emitir', 'ece.exportar', 'reporte.exportar', 'ece.ver']),
  [ROLES.PODOLOGO]: Object.freeze(['inventario.registrar', 'inventario.descontar', 'receta.emitir', 'ece.exportar', 'reporte.exportar', 'ece.ver']),
  [ROLES.RECEPCION]: Object.freeze(['inventario.registrar']),
});

export const ROLE_LABELS = Object.freeze({
  [ROLES.ADMINISTRADOR]: 'Administrador',
  [ROLES.PODOLOGO]: 'Podólogo',
  [ROLES.RECEPCION]: 'Recepción',
});

/** Estructura del menú lateral: grupos, etiquetas e iconos. */
export const NAV_ITEMS = Object.freeze([
  { page: 'inicio', label: 'Panel Principal', icon: 'fa-gauge-high', group: 'Principal' },
  { page: 'agenda', label: 'Agenda', icon: 'fa-calendar-days', group: 'Atención' },
  { page: 'agendar', label: 'Agendar Cita', icon: 'fa-calendar-plus', group: 'Atención' },
  { page: 'consulta', label: 'Nueva Consulta', icon: 'fa-notes-medical', group: 'Atención' },
  { page: 'pacientes', label: 'Pacientes', icon: 'fa-users', group: 'Expedientes' },
  { page: 'recetas', label: 'Recetas Médicas', icon: 'fa-prescription', group: 'Expedientes' },
  { page: 'mapa', label: 'Mapa Podológico', icon: 'fa-shoe-prints', group: 'Clínica' },
  { page: 'pagos', label: 'Caja y Pagos', icon: 'fa-cash-register', group: 'Finanzas' },
  { page: 'inventario', label: 'Inventario', icon: 'fa-boxes-stacked', group: 'Gestión' },
  { page: 'auditoria', label: 'Bitácora de Auditoría', icon: 'fa-shield-halved', group: 'Seguridad' },
  { page: 'reportes', label: 'Reportes y ECE', icon: 'fa-chart-pie', group: 'Gestión' },
]);

/** Normaliza cualquier valor de rol; ante un rol desconocido aplica el mínimo privilegio. */
export function normalizeRole(raw) {
  if (raw === undefined || raw === null || raw === '') return ROLES.PODOLOGO; // el login es de la tabla Podologos
  const v = String(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (['administrador', 'admin', 'administrator'].includes(v)) return ROLES.ADMINISTRADOR;
  if (['podologo', 'podiatrist', 'medico', 'doctor'].includes(v)) return ROLES.PODOLOGO;
  if (['recepcion', 'recepcionista', 'receptionist', 'asistente'].includes(v)) return ROLES.RECEPCION;
  return ROLES.RECEPCION;
}

export function canAccessPage(role, page) {
  const list = PAGE_ACCESS[normalizeRole(role)] || [];
  return list.includes(page);
}

export function can(role, capability) {
  return (CAPABILITIES[normalizeRole(role)] || []).includes(capability);
}

/** Elementos del menú visibles para el rol. */
export function navItemsFor(role) {
  return NAV_ITEMS.filter((item) => canAccessPage(role, item.page));
}

/** Agrupa los elementos permitidos por sección del menú. */
export function navGroupsFor(role) {
  const groups = [];
  for (const item of navItemsFor(role)) {
    let g = groups.find((x) => x.name === item.group);
    if (!g) groups.push((g = { name: item.group, items: [] }));
    g.items.push(item);
  }
  return groups;
}

export function pagesFor(role) {
  return [...(PAGE_ACCESS[normalizeRole(role)] || [])];
}
