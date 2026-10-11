/**
 * Vistas del Módulo de Administración (Gestión de podólogos, catálogo, auditoría)
 */
import { renderAuditoriaShell, mountAuditoria } from '../../components/index.js';
import { PodologosService } from '../../services/index.js';

export function renderAdminDashboard() {
  return `
    <div class="admin-view-container">
      <header class="view-header">
        <h1>Panel de Administración General</h1>
        <p class="subtitle">Gestión de profesionales, clínicas, auditoría del sistema y catálogo.</p>
      </header>
      <div class="admin-grid">
        <div class="admin-card" id="admin-podologos-card">
          <h3><i class="fa-solid fa-user-doctor"></i> Personal y Podólogos</h3>
          <p>Supervisión de agendas, altas, modificaciones y permisos de acceso.</p>
        </div>
        <div class="admin-card" id="admin-auditoria-card">
          <h3><i class="fa-solid fa-clipboard-list"></i> Pistas de Auditoría</h3>
          <p>Registro de eventos y trazabilidad de acciones en el expediente.</p>
        </div>
      </div>
    </div>
  `;
}

export { renderAuditoriaShell, mountAuditoria, PodologosService };
