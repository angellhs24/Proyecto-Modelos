/**
 * Puente entre la app existente (app.js, script clásico) y los módulos ES nuevos.
 * Expone `window.Modules`, que app.js consulta en render(), navigate(), login y logout.
 */
import { RETURN_TO_KEY } from '../config.js';
import * as auth from '../core/auth.js';
import { resolvePage, parseHash, buildHash, DEFAULT_PAGE } from '../core/guard.js';
import { agendaStore } from '../core/agendaStore.js';
import { renderLogin, mountLogin } from '../components/loginView.js';
import { renderExpedienteShell, mountExpediente } from '../components/expedienteView.js';
import { renderAgendaShell, mountAgenda } from '../components/calendarView.js';
import { renderDashboardShell, mountDashboard } from '../components/dashboardView.js';
import { renderInventarioShell, mountInventario } from '../components/inventarioView.js';
import { renderRecetasShell, mountRecetas } from '../components/recetasView.js';
import { renderPagosShell, mountPagos } from '../components/pagosView.js';
import { renderMapaShell, mountMapa } from '../components/mapaPodologicoView.js';
import { renderAuditoriaShell, mountAuditoria } from '../components/auditoriaView.js';
import { createNotifier } from '../components/notifications.js';
import { notify } from '../components/ui.js';
import { esc } from '../utils/html.js';

let app = null; // { state, render, navigate, bootData, clinicName }
let expedienteId = '';
let loginMessage = '';
let agendaCtrl = null;
let eceCtrl = null;
let dashboardCtrl = null;
let inventarioCtrl = null;
let recetasCtrl = null;
let pagosCtrl = null;
let mapaCtrl = null;
let auditoriaCtrl = null;
let pendingCita = null; // { paciente } para abrir el modal al llegar a la agenda
let pendingDetalle = null;
let notifier = null;
let servicesFor = null;

auth.installAuth();

const store = () => sessionStorage;

function applySession() {
  const s = auth.getSession();
  if (!s || !app) return;
  const p = s.podologo;
  app.state.user = p.nombreCompleto || p.email || 'Podólogo';
  app.state.userRole = p.rol || 'podologo';
  app.state.userCedula = p.cedula ? `Céd. Prof. ${p.cedula}` : '';
}

function currentHash() {
  return window.location.hash;
}

function setHash(page, ...params) {
  const next = buildHash(page, ...params);
  if (window.location.hash !== next) window.location.hash = next;
}

function ensureServices() {
  if (!app || !auth.isAuthenticated()) return;
  if (!notifier) {
    notifier = createNotifier({
      onOpenCita: (id) => {
        pendingDetalle = id;
        app.navigate('agenda');
      },
    });
    notifier.start();
  }
  const clinicId = app.state.currentClinicId;
  if (servicesFor !== clinicId) {
    servicesFor = clinicId;
    agendaStore
      .load(clinicId, { fallback: () => app.state.appointments })
      .catch(() => {});
  }
}

function stopServices() {
  notifier?.stop();
  notifier = null;
  servicesFor = null;
  agendaStore.reset();
}

function teardownViews() {
  agendaCtrl?.destroy?.();
  agendaCtrl = null;
  eceCtrl = null;
  dashboardCtrl?.destroy?.();
  dashboardCtrl = null;
  inventarioCtrl?.destroy?.();
  inventarioCtrl = null;
  recetasCtrl?.destroy?.();
  recetasCtrl = null;
  pagosCtrl?.destroy?.();
  pagosCtrl = null;
  mapaCtrl?.destroy?.();
  mapaCtrl = null;
  auditoriaCtrl?.destroy?.();
  auditoriaCtrl = null;
}

export const Modules = {
  auth: {
    isAuthenticated: () => auth.isAuthenticated(),
    getSession: () => auth.getSession(),
    logout: (reason) => auth.logout(reason),
  },

  views: {
    dashboard: { render: renderDashboardShell, mount: mountDashboard },
    inventario: { render: renderInventarioShell, mount: mountInventario },
    recetas: { render: renderRecetasShell, mount: mountRecetas },
    pagos: { render: renderPagosShell, mount: mountPagos },
    mapa: { render: renderMapaShell, mount: mountMapa },
    auditoria: { render: renderAuditoriaShell, mount: mountAuditoria },
    agenda: { render: renderAgendaShell, mount: mountAgenda },
    expediente: { render: renderExpedienteShell, mount: mountExpediente },
    login: { render: renderLogin, mount: mountLogin },
  },

  /** Registra callbacks de la app heredada. */
  connect(api) {
    app = api;
    applySession();

    window.addEventListener('hashchange', () => {
      if (!auth.isAuthenticated()) return;
      const { page, params } = parseHash(currentHash());
      if (page && page !== app.state.page) {
        if (page === 'expediente') expedienteId = params[0] || '';
        app.state.page = page;
        app.render();
      }
    });

    window.addEventListener('auth:changed', (e) => {
      if (e.detail?.authenticated) return;
      stopServices();
      teardownViews();
      const reason = e.detail?.reason;
      loginMessage =
        reason === 'expired' ? 'Tu sesión expiró. Vuelve a iniciar sesión.' :
        reason === 'idle' ? 'Sesión cerrada por inactividad.' : '';
      app.state.page = 'login';
      app.render();
    });

    setInterval(() => {
      if (app.state.page !== 'login' && !auth.isAuthenticated()) auth.logout('idle');
    }, 30000);
  },

  /** Página inicial según sesión y hash (deep links protegidos). */
  initialPage() {
    const authed = auth.isAuthenticated();
    const { page, params } = parseHash(currentHash());
    if (!authed) {
      if (page && page !== 'login') store().setItem(RETURN_TO_KEY, currentHash());
      return 'login';
    }
    if (page === 'expediente') expedienteId = params[0] || '';
    return resolvePage(page || DEFAULT_PAGE, true).page;
  },

  /** Guardia de rutas: devuelve la página realmente permitida según auth y rol (RBAC). */
  guard(requested) {
    const authed = auth.isAuthenticated();
    if (!authed && requested !== 'login') {
      const h = currentHash();
      if (h && h !== '#/login') store().setItem(RETURN_TO_KEY, h);
    }
    const role = auth.getRole();
    let { page } = resolvePage(requested, authed, role);
    if (page === 'expediente' && !expedienteId) page = 'pacientes';
    return page;
  },

  /** Sincroniza el hash con la página activa (lo llama app.navigate). */
  syncHash(page) {
    if (page === 'login') return;
    if (page === 'expediente') setHash(page, expedienteId);
    else setHash(page);
  },

  renderLogin: () => {
    const html = renderLogin({ message: loginMessage });
    loginMessage = '';
    return html;
  },

  /** HTML de las páginas gestionadas por módulos o null si es de la app heredada. */
  renderPage(page) {
    if (page === 'inicio') return renderDashboardShell();
    if (page === 'agenda') return renderAgendaShell(app.clinicName());
    if (page === 'expediente') return renderExpedienteShell(expedienteId);
    if (page === 'inventario') return renderInventarioShell();
    if (page === 'recetas') return renderRecetasShell();
    if (page === 'pagos') return renderPagosShell();
    if (page === 'mapa') return renderMapaShell();
    if (page === 'auditoria') return renderAuditoriaShell();
    return null;
  },

  /** Monta eventos/componentes tras app.render() */
  afterRender(page) {
    teardownViews();
    const appEl = document.getElementById('app');
    if (page === 'login') {
      mountLogin(appEl, {
        onSuccess: async () => {
          applySession();
          const back = store().getItem(RETURN_TO_KEY);
          store().removeItem(RETURN_TO_KEY);
          let target = DEFAULT_PAGE;
          if (back) {
            const { page: p, params } = parseHash(back);
            if (p && resolvePage(p, true).page === p) {
              target = p;
              if (p === 'expediente') expedienteId = params[0] || '';
            }
          }
          app.state.page = target;
          app.render();
          Modules.syncHash(target);
          notify(`Bienvenido, Dr. ${app.state.user.split(' ')[0]}`);
          app.bootData?.().catch(() => {});
        },
      });
      return;
    }

    ensureServices();

    if (page === 'agenda') {
      const root = document.getElementById('agenda-root');
      if (!root) return;
      agendaCtrl = mountAgenda(root, {
        getClinicaId: () => app.state.currentClinicId,
        podologo: () => auth.getPodologo()?.cedula || null,
        actions: {
          abrirExpediente: (exp) => Modules.openExpediente(exp),
          iniciarConsulta: (cita) => app.iniciarConsulta(cita),
          fallbackCitas: () => app.state.appointments,
          localPacientes: () => app.state.patients,
          afterCitaCreada: () => app.refreshLegacyCitas?.(),
        },
      });
      root.addEventListener('click', (e) => {
        const a = e.target.closest('[data-agenda-action]')?.dataset.agendaAction;
        if (a === 'nueva') agendaCtrl.abrirModalCita({});
        if (a === 'bell') notifier?.toggle();
      });
      root.querySelector('#toggle-canceladas')?.addEventListener('change', (e) => agendaCtrl.setMostrarCanceladas(e.target.checked));
      if (agendaStore.state.loading) {
        // ya hay una carga en curso; el calendario se actualiza al emitir el store
      } else if (agendaStore.state.clinicaId !== app.state.currentClinicId || !agendaStore.state.loadedAt) {
        agendaStore.load(app.state.currentClinicId, { fallback: () => app.state.appointments }).catch(() => {});
      } else {
        agendaCtrl.calendar.refetchEvents();
      }
      if (pendingCita) {
        const p = pendingCita;
        pendingCita = null;
        agendaCtrl.abrirModalCita({ paciente: p.paciente });
      }
      if (pendingDetalle) {
        const id = pendingDetalle;
        pendingDetalle = null;
        agendaStore.state.loading ? agendaStore.state.loading.then(() => agendaCtrl?.abrirModalDetalle(id)) : agendaCtrl.abrirModalDetalle(id);
      }
    }

    if (page === 'expediente') {
      const root = document.getElementById('ece-root');
      if (!root) return;
      eceCtrl = mountExpediente(root, {
        expediente: expedienteId,
        fallbackPaciente: () => {
          if (!app.state.patients || !app.state.patients.length) {
            if (typeof app.cargarPacientesDemo === 'function') app.cargarPacientesDemo();
          }
          const found = (app.state.patients || []).find(
            (p) => String(p.expediente || p.No_expediente || p.id_paciente) === String(expedienteId)
          );
          if (found) return found;
          return {
            id_paciente: Number(expedienteId) || 101,
            No_expediente: expedienteId,
            expediente: String(expedienteId),
            nombre_completo: 'Rosa María Martínez',
            Nombres: 'Rosa María',
            ape_paterno: 'Martínez',
            telefono: '55 4123 8970',
            edad: 62,
            sexo: 'Femenino',
            es_diabetico: true,
            es_hipertenso: true,
            notas_alergias: 'Pie diabético preventivo, hiperqueratosis moderada.',
            ultima_cita: '2026-08-18 10:00'
          };
        },
        actions: {
          volver: () => app.navigate('pacientes'),
          agendar: (pacRaw) => {
            pendingCita = { paciente: pacRaw };
            app.navigate('agenda');
          },
          nuevaConsulta: (pacRaw) => app.iniciarConsultaConPaciente(pacRaw),
        },
      });
    }

    if (page === 'inicio') {
      const root = document.getElementById('dashboard-root');
      if (!root) return;
      dashboardCtrl = mountDashboard(root, {
        getData: () => ({
          appointments: app.state.appointments || [],
          patients: app.state.patients || [],
        }),
        getRole: () => auth.getRole(),
      });
      root.addEventListener('click', (e) => {
        const nav = e.target.closest('[data-nav]')?.dataset.nav;
        if (nav) app.navigate(nav);
      });
    }

    if (page === 'inventario') {
      const root = document.getElementById('inventario-root');
      if (!root) return;
      inventarioCtrl = mountInventario(root, {
        getRole: () => auth.getRole(),
      });
    }

    if (page === 'recetas') {
      const root = document.getElementById('recetas-root');
      if (!root) return;
      recetasCtrl = mountRecetas(root, {
        getRole: () => auth.getRole(),
        getPatients: () => app.state.patients || [],
        getPodologo: () => auth.getPodologo(),
        clinicName: () => app.clinicName(),
        initialExpediente: expedienteId || '',
      });
    }

    if (page === 'pagos') {
      const root = document.getElementById('pagos-root');
      if (!root) return;
      pagosCtrl = mountPagos(root, {
        getRole: () => auth.getRole(),
        clinicName: () => app.clinicName(),
      });
    }

    if (page === 'mapa') {
      const root = document.getElementById('mapa-root');
      if (!root) return;
      mapaCtrl = mountMapa(root, {
        clinicName: () => app.clinicName(),
      });
    }

    if (page === 'auditoria') {
      const root = document.getElementById('auditoria-root');
      if (!root) return;
      auditoriaCtrl = mountAuditoria(root);
    }
  },

  openExpediente(expediente) {
    if (!expediente) {
      notify('Este paciente no tiene número de expediente');
      return;
    }
    expedienteId = String(expediente);
    app.navigate('expediente');
  },

  toggleNotifications() {
    ensureServices();
    notifier?.toggle();
  },

  /** Permite a las pruebas leer/forzar estado. */
  _debug: () => ({ expedienteId, notifier, agendaCtrl, eceCtrl, agendaStore }),
};

window.Modules = Modules;
window.dispatchEvent(new Event('modules:ready'));

// Pequeña ayuda para evitar XSS desde atributos inline del código heredado.
window.escapeHtml = esc;
