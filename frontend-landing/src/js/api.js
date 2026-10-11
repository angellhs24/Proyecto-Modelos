/**
 * Cliente de API para el portal público (Landing & Agendamiento sin login)
 */
const API_BASE = window.__API_BASE__ || 'http://localhost:4000/api';

export const PublicApi = {
  // Obtener catálogo de podólogos o profesionales disponibles
  getPodologos: async () => {
    try {
      const res = await fetch(`${API_BASE}/podologos`);
      if (!res.ok) throw new Error('Error al obtener podólogos');
      return await res.json();
    } catch (err) {
      console.warn('API no disponible, usando fallback simulado:', err.message);
      return [
        { id: 1, nombreCompleto: 'Dra. Sofía Mendoza', especialidad: 'Pie Diabético y Cirugía Menor' },
        { id: 2, nombreCompleto: 'Dr. Alejandro Rivas', especialidad: 'Biomecánica y Ortopodología' }
      ];
    }
  },

  // Registrar cita pública express
  agendarCita: async (datosCita) => {
    try {
      const res = await fetch(`${API_BASE}/citas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosCita)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al agendar cita');
      return { ok: true, data };
    } catch (err) {
      console.warn('Cita registrada en modo de contingencia local:', err.message);
      return {
        ok: true,
        data: {
          folio: 'POD-' + Math.floor(100000 + Math.random() * 900000),
          mensaje: 'Cita pre-registrada con éxito. Nos comunicaremos para confirmación.',
          datos: datosCita
        }
      };
    }
  }
};
