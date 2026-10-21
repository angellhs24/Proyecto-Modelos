/**
 * Módulo de Sesión y Autenticación RBAC (Vanilla JS)
 * Gestiona tokens, perfiles y cambio rápido de roles.
 */

const SESSION_KEY = 'clinica_podologia_session';
const TOKEN_KEY = 'clinica_podologia_token';

// Cuentas de prueba preconfiguradas según el DDL
const DEMO_ACCOUNTS = {
  ADMIN: {
    email: 'admin@elitefoot.com',
    password: 'hash_simulado_admin123',
    rolId: 1,
    nombre: 'Lic. Angel Hernandez',
    cargo: 'Administrador General'
  },
  RECEPCIONISTA: {
    email: 'recepcion@elitefoot.com',
    password: 'hash_simulado_recep123',
    rolId: 3,
    nombre: 'María López',
    cargo: 'Recepcionista Clínica'
  },
  PODOLOGO: {
    email: 'dr.perez@elitefoot.com',
    password: 'hash_simulado_podo123',
    rolId: 4,
    nombre: 'Dr. Carlos Pérez',
    cargo: 'Podólogo Titular'
  }
};

/**
 * Obtener usuario en sesión
 */
function getCurrentUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Obtener token activo
 */
function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

/**
 * Guardar sesión (solo metadatos no sensibles del perfil; el token vive en cookie HttpOnly)
 */
function saveSession(usuario, token) {
  if (usuario) {
    const rolNorm = (usuario.fk_rol_id === 100 || usuario.rolId === 100 || String(usuario.nombre_rol || usuario.rol || '').toLowerCase().includes('admin')) ? 1
                  : (usuario.fk_rol_id === 300 || usuario.rolId === 300 || String(usuario.nombre_rol || usuario.rol || '').toLowerCase().includes('recep')) ? 3
                  : (usuario.fk_rol_id === 400 || usuario.rolId === 400 || String(usuario.nombre_rol || usuario.rol || '').toLowerCase().includes('pod')) ? 4
                  : Number(usuario.fk_rol_id || usuario.rolId || 1);
    usuario.fk_rol_id = rolNorm;
    usuario.rolId = rolNorm;
    localStorage.setItem(SESSION_KEY, JSON.stringify(usuario));
  }
  // Se remueve el token de localStorage para proteger contra robo por XSS
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Redirige al usuario según su Rol ID (RBAC)
 * Rol ID 1: Administrador -> admin.html
 * Rol ID 3: Recepcionista -> recepcion.html
 * Rol ID 4: Podólogo      -> consultorio.html
 */
function redirectByRole(usuario) {
  if (!usuario) {
    window.location.href = 'login.html';
    return;
  }
  const rol = Number(usuario.fk_rol_id || usuario.rolId || usuario.rol || 4);
  const rolNombre = String(usuario.nombre_rol || usuario.rol || '').toLowerCase();

  if (rol === 1 || rol === 100 || rolNombre.includes('admin')) {
    window.location.href = 'admin.html';
  } else if (rol === 3 || rol === 300 || rolNombre.includes('recep')) {
    window.location.href = 'recepcion.html';
  } else if (rol === 4 || rol === 400 || rolNombre.includes('pod') || rolNombre.includes('especialista')) {
    window.location.href = 'consultorio.html';
  } else {
    window.location.href = 'consultorio.html';
  }
}

/**
 * Limpiar sesión: Destruye la cookie HttpOnly en el backend y redirige al login
 */
async function logout() {
  try {
    await fetch(`${getApiBaseUrl()}/api/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.warn('Advertencia al destruir cookie en /api/logout:', err);
  }
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.clear();
  window.location.href = 'login.html';
}

/**
 * Guardián de ruta RBAC: Valida autenticación y rol permitido.
 * Si no hay sesión -> redirige a login.html
 * Si el rol no está permitido -> redirige a la vista correspondiente a su rol.
 * Si todo está en orden -> retorna el objeto usuario.
 * @param {Array<number>} allowedRoles Lista de IDs de roles permitidos, ej. [1], [3, 1] o [4, 1]
 */
function checkAuthGuard(allowedRoles = []) {
  const user = getCurrentUser();
  if (!user) {
    console.warn('⚠️ [RBAC Guard] Sin sesión activa. Redirigiendo a login.html');
    window.location.href = 'login.html';
    return null;
  }
  const rol = Number(user.fk_rol_id || user.rolId || user.rol || 0);
  const nombreRol = String(user.nombre_rol || user.rol || '').toLowerCase();
  
  // Normalizar equivalencias de roles (1 y 100 Admin, 3 y 300 Recepción, 4 y 400 Podólogo)
  const rolNormalizado = (rol === 100 || nombreRol.includes('admin')) ? 1
                       : (rol === 300 || nombreRol.includes('recep')) ? 3
                       : (rol === 400 || nombreRol.includes('pod') || nombreRol.includes('especialista')) ? 4
                       : rol;

  const esPermitido = allowedRoles.length === 0 || 
                      allowedRoles.includes(rol) || 
                      allowedRoles.includes(rolNormalizado);

  if (!esPermitido) {
    console.warn(`🛡️ [RBAC Guard] Rol ${rol} no autorizado para esta vista (requerido: ${allowedRoles.join(',')}). Derivando a su portal...`);
    redirectByRole(user);
    return null;
  }
  return user;
}

/**
 * Obtiene la URL base de la API Backend (puerto 4000)
 */
function getApiBaseUrl() {
  if (typeof window === 'undefined') return '';
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalDev && window.location.port && window.location.port !== '4000') {
    return `http://${window.location.hostname}:4000`;
  }
  return '';
}

/**
 * Iniciar sesión automática con una cuenta demo (recibe cookie HttpOnly)
 */
async function autoLoginDemo(rolId) {
  const account = rolId === 1 ? DEMO_ACCOUNTS.ADMIN : (rolId === 4 ? DEMO_ACCOUNTS.PODOLOGO : DEMO_ACCOUNTS.RECEPCIONISTA);
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account.email, password: account.password })
    });
    const data = await res.json();
    if (res.ok && (data.usuario || data.token)) {
      saveSession(data.usuario, data.token);
      return data.usuario;
    }
  } catch (err) {
    console.error('Error al iniciar sesión demo:', err);
  }
  return null;
}

/**
 * Wrapper de Fetch con autenticación automática y captura de violaciones RBAC
 * Envía credenciales (cookies HttpOnly) en todas las consultas
 */
async function fetchApi(endpoint, options = {}) {
  const token = getToken();
  const user = getCurrentUser();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (user && user.id) {
    headers['x-usuario-id'] = user.id;
  }

  const fullUrl = endpoint.startsWith('http') ? endpoint : `${getApiBaseUrl()}${endpoint}`;

  try {
    const response = await fetch(fullUrl, {
      credentials: 'include',
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));

    // Detección de Bloqueos de Seguridad RBAC (403)
    if (response.status === 403) {
      const mensaje = data.error || 'Acceso Denegado por restricción de rol (RBAC)';
      showToast(mensaje, 'error');
      console.warn('🛡️ [SEGURIDAD RBAC INTERCEPTADA]:', data);
      return { ok: false, status: 403, data, blocked: true };
    }

    // Detección de Sesión Expirada (401)
    if (response.status === 401) {
      console.warn('Sesión no autorizada, intentando re-autenticar demo...');
      showToast('Sesión no autorizada. Reautenticando...', 'warning');
      return { ok: false, status: 401, data };
    }

    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    console.error(`Error en petición a ${endpoint}:`, error);
    showToast(`Error de conexión con el servidor: ${error.message}`, 'error');
    return { ok: false, status: 500, error };
  }
}

/**
 * Sistema de Notificaciones Toast
 */
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-triangle-exclamation',
    warning: 'fa-circle-exclamation',
    info: 'fa-circle-info'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || 'fa-info'}" style="font-size: 1.2rem;"></i>
    <div style="flex: 1; font-size: 0.88rem; line-height: 1.35;">${message}</div>
    <button style="background:none;border:none;color:inherit;cursor:pointer;opacity:0.6;" onclick="this.parentElement.remove()">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

/**
 * Iniciar sesión con email y contraseña reales
 * La respuesta incrusta el token en una cookie HttpOnly segura
 */
async function login(email, password) {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: (email || '').trim(), password })
    });
    const data = await res.json();
    if (res.ok && (data.usuario || data.token)) {
      saveSession(data.usuario, data.token);
      return { ok: true, usuario: data.usuario, token: data.token };
    }
    return { ok: false, error: data.error || 'Credenciales inválidas' };
  } catch (err) {
    return { ok: false, error: 'No se pudo conectar con el servidor: ' + err.message };
  }
}

/**
 * Sanitización de texto para prevenir ataques Cross-Site Scripting (XSS)
 * en la inyección de cadenas en el DOM
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

// Exportar globalmente para scripts Vanilla JS
window.AppAuth = {
  getCurrentUser,
  getToken,
  saveSession,
  logout,
  redirectByRole,
  checkAuthGuard,
  login,
  autoLoginDemo,
  fetchApi,
  showToast,
  getApiBaseUrl,
  escapeHtml,
  DEMO_ACCOUNTS
};

