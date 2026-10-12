/** Vista de inicio de sesión (Podologos.Email + contraseña). */
import { esc } from '../utils/html.js';
import { login, validateCredentials } from '../core/auth.js';
import { DEMO } from '../config.js';

export function renderLogin({ message = '' } = {}) {
  return `
  <div class="auth-shell">
    <div class="auth-orb auth-orb--a"></div>
    <div class="auth-orb auth-orb--b"></div>
    <div class="auth-orb auth-orb--c"></div>

    <section class="auth-brand" aria-hidden="true">
      <div class="auth-brand-logo"><i class="fa-solid fa-stethoscope"></i></div>
      <h2>Elite Foot Care</h2>
      <p>Expediente clínico electrónico, agenda inteligente y mapa podológico en un solo lugar.</p>
      <ul>
        <li><i class="fa-solid fa-folder-open"></i> Expediente clínico completo</li>
        <li><i class="fa-solid fa-calendar-check"></i> Agenda sin choques de horario</li>
        <li><i class="fa-solid fa-shield-halved"></i> Acceso seguro para podólogos</li>
      </ul>
    </section>

    <main class="auth-card glass" id="login-card">
      <h1 class="auth-title">Bienvenido, Doctor</h1>
      <p class="auth-sub">Inicia sesión con tu correo profesional</p>

      <div id="login-session-msg" class="auth-notice" ${message ? '' : 'hidden'} role="status">${esc(message)}</div>

      <form id="login-form" novalidate autocomplete="on">
        <div class="auth-field">
          <label for="login-email">Correo electrónico</label>
          <div class="auth-input">
            <i class="fa-regular fa-envelope"></i>
            <input id="login-email" name="email" type="email" inputmode="email" autocomplete="username" placeholder="doctor@clinica.mx" required aria-describedby="login-email-err">
          </div>
          <small class="auth-err" id="login-email-err" role="alert"></small>
        </div>

        <div class="auth-field">
          <label for="login-password">Contraseña</label>
          <div class="auth-input">
            <i class="fa-solid fa-lock"></i>
            <input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required aria-describedby="login-password-err">
            <button type="button" class="auth-eye" id="login-toggle-pass" aria-label="Mostrar contraseña"><i class="fa-solid fa-eye"></i></button>
          </div>
          <small class="auth-err" id="login-password-err" role="alert"></small>
        </div>

        <div id="login-error" class="auth-banner-error" role="alert" hidden></div>

        <button type="submit" id="login-submit" class="auth-submit">
          <span class="auth-submit-label">Ingresar al consultorio</span>
          <i class="fa-solid fa-arrow-right"></i>
          <span class="auth-spinner" aria-hidden="true"></span>
        </button>
      </form>

      ${DEMO.enabled ? `<p class="auth-demo"><i class="fa-solid fa-flask"></i> Modo demostración si el servidor no responde: <code>${esc(DEMO.email)}</code> / <code>${esc(DEMO.password)}</code></p>` : ''}
    </main>
  </div>`;
}

/**
 * Conecta eventos del formulario. `onSuccess(session)` se invoca al autenticar.
 */
export function mountLogin(root, { onSuccess } = {}) {
  const form = root.querySelector('#login-form');
  if (!form) return;
  const $ = (sel) => root.querySelector(sel);
  const email = $('#login-email');
  const pass = $('#login-password');
  const submit = $('#login-submit');
  const banner = $('#login-error');

  const setFieldError = (field, msg) => {
    const el = $(`#login-${field}-err`);
    const input = $(`#login-${field}`);
    if (el) el.textContent = msg || '';
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };

  $('#login-toggle-pass').addEventListener('click', (e) => {
    const show = pass.type === 'password';
    pass.type = show ? 'text' : 'password';
    e.currentTarget.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    e.currentTarget.querySelector('i').className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    banner.hidden = true;
    const { valid, errors } = validateCredentials({ email: email.value, password: pass.value });
    setFieldError('email', errors.email);
    setFieldError('password', errors.password);
    if (!valid) {
      (errors.email ? email : pass).focus();
      return;
    }

    submit.disabled = true;
    submit.classList.add('is-loading');
    try {
      const session = await login(email.value, pass.value);
      if (onSuccess) onSuccess(session);
    } catch (err) {
      banner.textContent = err.message || 'No se pudo iniciar sesión';
      banner.hidden = false;
      pass.value = '';
      pass.focus();
    } finally {
      submit.disabled = false;
      submit.classList.remove('is-loading');
    }
  });
}
