/**
 * Cliente HTTP centralizado con inyección de Bearer Token JWT
 */
import { getSession } from '../core/auth.js';

const API_BASE_URL = window.__API_BASE_URL__ || 'http://localhost:4000/api';

export async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const session = getSession();
  const token = session?.token;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // Token inválido o expirado
    window.location.hash = '#/login';
    throw new Error('Sesión expirada. Por favor inicie sesión nuevamente.');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `Error HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const http = {
  get: (endpoint, options) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options) => request(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body, options) => request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint, options) => request(endpoint, { ...options, method: 'DELETE' })
};
