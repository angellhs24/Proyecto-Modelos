const app = require('./app');
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = app.listen(5055, async () => {
  console.log('Test server started on port 5055');

  async function post(routePath, body) {
    const res = await fetch('http://localhost:5055' + routePath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let json = {};
    try { json = JSON.parse(text); } catch (e) {}
    return { status: res.status, headers: res.headers, json, text };
  }

  async function get(routePath, headers = {}) {
    const res = await fetch('http://localhost:5055' + routePath, {
      method: 'GET',
      headers
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, text };
  }

  let passed = 0;
  let failed = 0;

  function assert(cond, desc) {
    if (cond) {
      console.log('✅ PASS:', desc);
      passed++;
    } else {
      console.error('❌ FAIL:', desc);
      failed++;
    }
  }

  try {
    console.log('\n--- 1. Pruebas de Acceso de Camila Vázquez (recep28) ---');
    const rCamila = await post('/api/auth/login', { email: 'camilavazquezvelazquez@gmail.com', password: 'recep28' });
    assert(rCamila.status === 200, 'Camila login status is 200');
    assert(rCamila.json.usuario && rCamila.json.usuario.fk_rol_id === 3, 'Camila rol is 3 (Recepcionista)');
    assert(rCamila.json.usuario && rCamila.json.usuario.perfil && rCamila.json.usuario.perfil.Nombre === 'Camila', 'Camila profile name is Camila');
    assert(rCamila.json.usuario && rCamila.json.usuario.perfil && rCamila.json.usuario.perfil.fk_clinica_id === 28, 'Camila clinic is 28');
    const cookieHeader = rCamila.headers.get('set-cookie') || '';
    assert(cookieHeader.includes('token='), 'Camila receives HttpOnly token cookie');

    console.log('\n--- 2. Pruebas de Fuga de Datos y Contraseñas Erróneas ---');
    const rCamilaBad = await post('/api/auth/login', { email: 'camilavazquezvelazquez@gmail.com', password: 'wrongpassword' });
    assert(rCamilaBad.status === 401, 'Bad password returns 401');
    assert(rCamilaBad.json.error === 'Credenciales inválidas. Verifique su correo y contraseña.', 'Returns generic error message without leakage');

    const rNonExistent = await post('/api/auth/login', { email: 'inexistente_9999@gmail.com', password: 'random' });
    assert(rNonExistent.status === 401, 'Nonexistent user returns 401');
    assert(rNonExistent.json.error === 'Credenciales inválidas. Verifique su correo y contraseña.', 'Nonexistent user returns generic error message');

    console.log('\n--- 3. Validación de Cuentas Reales en Base de Datos ---');
    const rAdmin = await post('/api/auth/login', { email: 'luisangelhs2610@gmail.com', password: 'admin1234' });
    assert(rAdmin.status === 200 && rAdmin.json.usuario.fk_rol_id === 1, 'Admin luisangelhs2610 login 200 OK');

    const rKiara = await post('/api/auth/login', { email: 'kiarapink27@gmail.com', password: 'kyara1234' });
    assert(rKiara.status === 200 && rKiara.json.usuario.fk_rol_id === 3, 'Kiara kiarapink27 login 200 OK');

    const rLuis = await post('/api/auth/login', { email: 'luiscudu59@gmail.com', password: 'recep14' });
    assert(rLuis.status === 200 && rLuis.json.usuario.fk_rol_id === 3, 'Luis luiscudu59 login 200 OK');

    const rSebas = await post('/api/auth/login', { email: 'sebastianpalaciosherra@gmail.com', password: 'recep35' });
    assert(rSebas.status === 200 && rSebas.json.usuario.fk_rol_id === 3, 'Sebas sebastianpalaciosherra login 200 OK');

    const rPodo = await post('/api/auth/login', { email: 'dr.perez@elitefoot.com', password: 'podo123' });
    assert(rPodo.status === 200 && rPodo.json.usuario.fk_rol_id === 4, 'Podólogo dr.perez login 200 OK');

    console.log('\n--- 4. Validación de Cabeceras Cache-Control y Anti-Bfcache ---');
    const gConsultorio = await get('/consultorio.html');
    const ccConsultorio = gConsultorio.headers.get('cache-control') || '';
    assert(ccConsultorio.includes('no-store') && ccConsultorio.includes('no-cache'), 'GET /consultorio.html includes Cache-Control: no-store, no-cache');
    assert(gConsultorio.headers.get('pragma') === 'no-cache', 'GET /consultorio.html includes Pragma: no-cache');

    const gRecepcion = await get('/recepcion.html');
    const ccRecepcion = gRecepcion.headers.get('cache-control') || '';
    assert(ccRecepcion.includes('no-store') && ccRecepcion.includes('no-cache'), 'GET /recepcion.html includes Cache-Control: no-store, no-cache');

    const gAdmin = await get('/admin.html');
    const ccAdmin = gAdmin.headers.get('cache-control') || '';
    assert(ccAdmin.includes('no-store') && ccAdmin.includes('no-cache'), 'GET /admin.html includes Cache-Control: no-store, no-cache');

    const gApi = await get('/api/health');
    const ccApi = gApi.headers.get('cache-control') || '';
    assert(ccApi.includes('no-store') && ccApi.includes('no-cache'), 'GET /api/health includes Cache-Control: no-store, no-cache');

    console.log('\n--- 5. Pruebas de Logout y Destrucción de Cookie ---');
    const rLogoutAuth = await post('/api/auth/logout', {});
    assert(rLogoutAuth.status === 200, 'POST /api/auth/logout returns 200');
    const clearCookieHeader = rLogoutAuth.headers.get('set-cookie') || '';
    assert(clearCookieHeader.includes('token=;'), 'POST /api/auth/logout clears token cookie');

    const rLogout = await post('/api/logout', {});
    assert(rLogout.status === 200, 'POST /api/logout returns 200');

    console.log('\n--- 6. Verificación de DOM en Módulos de Podólogo y Recepcionista ---');
    const consultorioHtml = fs.readFileSync(path.resolve(__dirname, '../../frontend-admin/consultorio.html'), 'utf8');
    assert(!consultorioHtml.includes('Panel Admin'), 'consultorio.html has NO Panel Admin button');
    assert(!consultorioHtml.includes('>Recepción<'), 'consultorio.html has NO Recepción button');

    const recepcionHtml = fs.readFileSync(path.resolve(__dirname, '../../frontend-admin/recepcion.html'), 'utf8');
    assert(!recepcionHtml.includes('Panel Admin'), 'recepcion.html has NO Panel Admin button');
    assert(!recepcionHtml.includes('>Consultorio<'), 'recepcion.html has NO Consultorio button');

    console.log('\n================================');
    console.log(`TOTAL PRUEBAS: ${passed + failed} | EXITOSAS: ${passed} | FALLIDAS: ${failed}`);
    console.log('================================\n');
  } catch (err) {
    console.error('Error en tests:', err);
  } finally {
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
});
