import { validateCredentials, decodeJwt, isTokenExpired, normalizePodologo } from '../../js/core/auth.js';
import { resolvePage, parseHash, buildHash } from '../../js/core/guard.js';

describe('Módulo de Autenticación y Seguridad', () => {
  describe('validateCredentials', () => {
    test('rechaza emails vacíos o inválidos', () => {
      expect(validateCredentials({ email: '', password: 'secret123' }).valid).toBe(false);
      expect(validateCredentials({ email: 'invalido', password: 'secret123' }).valid).toBe(false);
    });

    test('rechaza contraseñas cortas', () => {
      const res = validateCredentials({ email: 'doctor@clinica.mx', password: '123' });
      expect(res.valid).toBe(false);
      expect(res.errors.password).toBeDefined();
    });

    test('acepta credenciales válidas', () => {
      const res = validateCredentials({ email: 'doctor@clinica.mx', password: 'password123' });
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual({});
    });
  });

  describe('Tokens y Expiración', () => {
    test('detecta tokens expirados', () => {
      const expPast = Math.floor(Date.now() / 1000) - 3600;
      const fakeToken = `header.${btoa(JSON.stringify({ exp: expPast }))}.sig`;
      expect(isTokenExpired(fakeToken)).toBe(true);

      const expFuture = Math.floor(Date.now() / 1000) + 3600;
      const validToken = `header.${btoa(JSON.stringify({ exp: expFuture }))}.sig`;
      expect(isTokenExpired(validToken)).toBe(false);
    });
  });

  describe('normalizePodologo', () => {
    test('normaliza atributos desde la tabla Podologos de MySQL', () => {
      const pod = normalizePodologo({
        Cedula_podologo: '1234567',
        Nombre: 'Juan',
        ape_paterno: 'Perez',
        ape_materno: 'Gomez',
        Email: 'juan@clinica.mx',
        Telefono_pod: '5511223344'
      });
      expect(pod.cedula).toBe('1234567');
      expect(pod.nombreCompleto).toBe('Juan Perez Gomez');
      expect(pod.email).toBe('juan@clinica.mx');
      expect(pod.telefono).toBe('5511223344');
    });
  });

  describe('Rutas protegidas y Guards', () => {
    test('redirige a login cuando no está autenticado e intenta acceder a página protegida', () => {
      const res = resolvePage('agenda', false);
      expect(res.page).toBe('login');
      expect(res.redirected).toBe(true);
      expect(res.reason).toBe('auth-required');
    });

    test('permite acceso a login sin estar autenticado', () => {
      const res = resolvePage('login', false);
      expect(res.page).toBe('login');
      expect(res.redirected).toBe(false);
    });

    test('redirige a inicio si ya está autenticado e intenta ir a login', () => {
      const res = resolvePage('login', true);
      expect(res.page).toBe('inicio');
      expect(res.redirected).toBe(true);
    });

    test('permite acceso a agenda o expediente si está autenticado', () => {
      expect(resolvePage('agenda', true).page).toBe('agenda');
      expect(resolvePage('expediente', true).page).toBe('expediente');
    });

    test('parsea y genera hashes con parámetros para deep linking', () => {
      expect(parseHash('#/expediente/2026140001')).toEqual({
        page: 'expediente',
        params: ['2026140001']
      });
      expect(buildHash('expediente', '2026140001')).toBe('#/expediente/2026140001');
    });
  });
});
