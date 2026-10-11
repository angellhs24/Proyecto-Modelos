/** Almacén de citas compartido entre el calendario y las notificaciones. */
import { citasApi } from '../api/index.js';
import { normalizeCita } from '../domain/scheduling.js';

const listeners = new Set();
const store = {
  citas: [],
  clinicaId: null,
  offline: false,
  loadedAt: 0,
  loading: null,
};

export const agendaStore = {
  get state() {
    return store;
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  emit() {
    listeners.forEach((fn) => fn(store));
  },
  /**
   * Carga GET /api/citas/clinica/:id. Si el servidor no responde usa `fallback()`
   * (citas locales de la app) y marca `offline` para avisar al usuario.
   */
  async load(clinicaId, { fallback } = {}) {
    store.clinicaId = clinicaId;
    store.loading = (async () => {
      try {
        const raw = await citasApi.byClinica(clinicaId);
        store.citas = raw.map(normalizeCita).filter((c) => c.start);
        store.offline = false;
      } catch (err) {
        if (err.status === 401) throw err;
        const local = typeof fallback === 'function' ? fallback() : [];
        store.citas = local.map(normalizeCita).filter((c) => c.start);
        store.offline = true;
      } finally {
        store.loadedAt = Date.now();
        store.loading = null;
      }
      agendaStore.emit();
      return store.citas;
    })();
    return store.loading;
  },
  upsert(cita) {
    const i = store.citas.findIndex((c) => c.id === cita.id);
    if (i === -1) store.citas.push(cita);
    else store.citas[i] = cita;
    agendaStore.emit();
  },
  patch(id, changes) {
    const c = store.citas.find((x) => x.id === String(id));
    if (c) {
      Object.assign(c, changes);
      agendaStore.emit();
    }
  },
  find: (id) => store.citas.find((c) => c.id === String(id)),
  reset() {
    store.citas = [];
    store.clinicaId = null;
    agendaStore.emit();
  },
};
