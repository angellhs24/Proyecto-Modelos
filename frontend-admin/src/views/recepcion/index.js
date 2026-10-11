/**
 * Vistas del Módulo de Recepción (Calendario general, asignaciones y pacientes)
 */
import { renderAgendaShell, mountAgenda } from '../../components/index.js';
import { PacientesService, CitasService } from '../../services/index.js';

export function renderRecepcionDashboard() {
  return `
    <div class="recepcion-view-container">
      <header class="view-header">
        <h1>Módulo de Recepción</h1>
        <p class="subtitle">Asignación de turnos, confirmación de citas y alta exprés de pacientes.</p>
      </header>
      <div id="recepcion-calendar-container"></div>
    </div>
  `;
}

export { renderAgendaShell, mountAgenda, PacientesService, CitasService };
