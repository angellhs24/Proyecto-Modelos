/**
 * Servicios de Dominio de la API REST
 */
import { http } from './httpService.js';
import * as legacyApi from '../../js/api/index.js';

export const CitasService = {
  listar: (filtros) => http.get('/citas'),
  crear: (datos) => http.post('/citas', datos),
  actualizar: (id, datos) => http.put(`/citas/${id}`, datos),
  cancelar: (id) => http.delete(`/citas/${id}`)
};

export const PacientesService = {
  listar: (q) => http.get(q ? `/pacientes?q=${encodeURIComponent(q)}` : '/pacientes'),
  obtener: (id) => http.get(`/pacientes/${id}`),
  crear: (datos) => http.post('/pacientes', datos),
  actualizar: (id, datos) => http.put(`/pacientes/${id}`, datos)
};

export const PodologosService = {
  listar: () => http.get('/podologos'),
  obtener: (id) => http.get(`/podologos/${id}`)
};

export const ConsultasService = {
  listarPorPaciente: (pacienteId) => http.get(`/consultas?paciente_id=${pacienteId}`),
  crear: (datos) => http.post('/consultas', datos)
};

export { legacyApi };
