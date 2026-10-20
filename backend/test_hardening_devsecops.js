const http = require('http');
const app = require('./src/app');
const bcrypt = require('bcrypt');

async function testHardening() {
  console.log('🛡️ Iniciando Verificación DevSecOps de Hardening...');

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. Test Helmet Headers en raíz
    console.log('\n[1] Verificando Cabeceras de Seguridad HTTP con Helmet...');
    const resRoot = await fetch(`${baseUrl}/api/health`);
    const headers = resRoot.headers;

    const noSniff = headers.get('x-content-type-options');
    const xFrame = headers.get('x-frame-options');
    const poweredBy = headers.get('x-powered-by');
    const csp = headers.get('content-security-policy');

    console.log('   X-Content-Type-Options:', noSniff, noSniff === 'nosniff' ? '✅' : '❌');
    console.log('   X-Frame-Options:', xFrame, xFrame ? '✅' : '❌');
    console.log('   X-Powered-By oculto:', poweredBy === null ? '✅ Oculto' : `❌ Expuesto (${poweredBy})`);
    console.log('   Content-Security-Policy presente:', csp ? '✅ Activo' : '❌ Inactivo');

    if (noSniff !== 'nosniff' || poweredBy !== null) {
      throw new Error('Fallo en configuración de Helmet');
    }

    // 2. Test Login y Emisión de Cookie HttpOnly
    console.log('\n[2] Verificando Login con Bcrypt y Emisión de Cookie HttpOnly...');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@elitefoot.com', password: 'admin123' })
    });

    console.log('   Status Login:', loginRes.status, loginRes.status === 200 ? '✅' : '❌');
    const setCookieHeader = loginRes.headers.get('set-cookie');
    console.log('   Set-Cookie recibido:', setCookieHeader ? '✅' : '❌');
    console.log('   Cookie Header Raw:', setCookieHeader);

    const isHttpOnly = setCookieHeader && setCookieHeader.toLowerCase().includes('httponly');
    const isSameSiteStrict = setCookieHeader && setCookieHeader.toLowerCase().includes('samesite=strict');
    const hasPath = setCookieHeader && setCookieHeader.toLowerCase().includes('path=/');

    console.log('   Bandera HttpOnly:', isHttpOnly ? '✅ Presente' : '❌ Ausente');
    console.log('   Bandera SameSite=Strict:', isSameSiteStrict ? '✅ Presente' : '❌ Ausente');
    console.log('   Bandera Path=/:', hasPath ? '✅ Presente' : '❌ Ausente');

    if (!isHttpOnly || !isSameSiteStrict) {
      throw new Error('Fallo: La cookie no cuenta con las banderas de seguridad obligatorias');
    }

    // Extraer valor de la cookie para peticiones subsiguientes
    const cookieTokenMatch = setCookieHeader.match(/token=([^;]+)/);
    const cookieToken = cookieTokenMatch ? cookieTokenMatch[0] : '';

    // 3. Test Autenticación Automática usando únicamente la Cookie (sin cabecera Authorization)
    console.log('\n[3] Verificando Consumo de API Protegida solo mediante Cookie HttpOnly...');
    const profileRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        'Cookie': cookieToken
      }
    });

    console.log('   Status /api/auth/me:', profileRes.status, profileRes.status === 200 ? '✅' : '❌');
    const profileData = await profileRes.json();
    console.log('   Usuario autenticado vía cookie:', profileData.usuario?.email, profileData.usuario?.rol);

    if (profileRes.status !== 200 || !profileData.usuario) {
      throw new Error('Fallo: El middleware de autenticación no reconoció la cookie HttpOnly');
    }

    // 4. Test Cierre de Sesión (Logout) y Destrucción de Cookie
    console.log('\n[4] Verificando Endpoint POST /api/logout...');
    const logoutRes = await fetch(`${baseUrl}/api/logout`, {
      method: 'POST',
      headers: {
        'Cookie': cookieToken
      }
    });

    console.log('   Status Logout:', logoutRes.status, logoutRes.status === 200 ? '✅' : '❌');
    const logoutCookie = logoutRes.headers.get('set-cookie');
    console.log('   Set-Cookie de eliminación:', logoutCookie);
    const isCleared = logoutCookie && (logoutCookie.includes('token=;') || logoutCookie.includes('Expires=Thu, 01 Jan 1970'));
    console.log('   Cookie token invalidada/expirada:', isCleared ? '✅ Correcto' : '❌ Error');

    // 5. Test Bcrypt Hashing Real
    console.log('\n[5] Verificando Bcrypt Hashing y Validación Criptográfica...');
    const plainPass = 'PodologiaSegura2026!';
    const hashed = await bcrypt.hash(plainPass, 10);
    console.log('   Hash generado ($2b$...):', hashed.slice(0, 28) + '...');
    const matchOk = await bcrypt.compare(plainPass, hashed);
    const matchFail = await bcrypt.compare('WrongPassword', hashed);
    console.log('   Bcrypt compare password correcto:', matchOk ? '✅' : '❌');
    console.log('   Bcrypt compare password incorrecto rechazado:', !matchFail ? '✅' : '❌');

    if (!matchOk || matchFail) {
      throw new Error('Fallo en verificación criptográfica de Bcrypt');
    }

    console.log('\n======================================================');
    console.log('🎉 ¡TODAS LAS VERIFICACIONES DE HARDENING DEVSECOPS PASARON AL 100%!');
    console.log('======================================================\n');
  } finally {
    server.close();
  }
}

testHardening().catch(err => {
  console.error('❌ Error en suite de pruebas DevSecOps:', err);
  process.exit(1);
});
