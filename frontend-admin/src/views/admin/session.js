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
  if (rol === 1) {
    window.location.href = 'admin.html';
  } else if (rol === 3) {
    window.location.href = 'recepcion.html';
  } else if (rol === 4) {
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
  if (allowedRoles.length > 0 && !allowedRoles.includes(rol)) {
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
  if (typeof window === 'undefined') return 'http://localhost:4000';
  if (window.location.port === '4000') return '';
  const hostname = window.location.hostname || 'localhost';
  return `http://${hostname}:4000`;
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
  DEMO_ACCOUNTS
};
