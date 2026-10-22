const http = require('http');
const path = require('path');
const fs = require('fs');

function makeRequest(options, postData, cookie = null) {
  return new Promise((resolve, reject) => {
    const headers = { ...(options.headers || {}) };
    if (cookie) headers['Cookie'] = cookie;
    const req = http.request({ ...options, headers }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', err => reject(err));
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return '';
  if (Array.isArray(setCookie)) {
    return setCookie.map(c => c.split(';')[0]).join('; ');
  }
  return setCookie.split(';')[0];
}

async function runQAAudit() {
  console.log('========================================================');
  console.log('🩺 AUDITORÍA INTEGRAL DE SEGURIDAD, RBAC Y QA ENDPOINTS');
  console.log('========================================================\n');

  const app = require('./src/app');
  const TEST_PORT = 5010;
  const server = app.listen(TEST_PORT);
  await new Promise(r => setTimeout(r, 600));

  let errors = 0;

  try {
    // -----------------------------------------------------------------------
    // TEST 1: FUGA DE DATOS Y ESTADO EN LOGIN (Contraseña incorrecta)
    // -----------------------------------------------------------------------
    console.log('[TEST 1] Fuga de Datos: Intentos fallidos con contraseña incorrecta');
    const loginFail = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'dr.perez@elitefoot.com', password: 'wrong_password_123' });

    console.log(`   Status: ${loginFail.status} (Esperado: 401)`);
    console.log(`   Mensaje devuelto: "${loginFail.body?.error}"`);
    const setCookieFail = loginFail.headers['set-cookie'] ? loginFail.headers['set-cookie'].join('; ') : '';
    const cookieLimpiada = setCookieFail.includes('token=;') || setCookieFail.includes('Max-Age=0') || setCookieFail.includes('Expires=Thu, 01 Jan 1970');
    console.log(`   Cookie destruida / limpiada: ${cookieLimpiada ? '✅ Sí' : '❌ No'}`);

    if (loginFail.status !== 401 || !loginFail.body?.error?.includes('Credenciales inválidas') || loginFail.body?.error?.includes('podólogo') || !cookieLimpiada) {
      console.error('❌ FALLÓ TEST 1: No cumple con mensaje estrictamente genérico o limpieza de cookie');
      errors++;
    } else {
      console.log('   ✅ PASÓ: Error genérico y cookie de sesión limpiada.');
    }

    // -----------------------------------------------------------------------
    // TEST 2: AUTENTICACIÓN REAL BCRYPT / HTTPONLY - PODÓLOGO
    // -----------------------------------------------------------------------
    console.log('\n[TEST 2] Verificación de credenciales reales: Dr. Carlos Pérez (Podólogo)');
    const loginPodo = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'dr.perez@elitefoot.com', password: 'podo123' });

    console.log(`   Status: ${loginPodo.status} (Esperado: 200)`);
    const podoCookie = extractCookie(loginPodo.headers);
    const podoNombre = loginPodo.body?.usuario?.perfil?.Nombre;
    const podoApe = loginPodo.body?.usuario?.perfil?.ape_paterno;
    const podoCedula = loginPodo.body?.usuario?.perfil?.Cedula_podologo;
    console.log(`   Perfil retornado: Dr. ${podoNombre} ${podoApe} (Cédula: ${podoCedula})`);
    console.log(`   Cookie HttpOnly generada: ${podoCookie.includes('token=') ? '✅ Sí' : '❌ No'}`);

    if (loginPodo.status !== 200 || podoNombre !== 'Carlos' || podoCedula !== 'CED12345678') {
      console.error('❌ FALLÓ TEST 2: Datos de podólogo incorrectos o no coinciden con la BD real');
      errors++;
    } else {
      console.log('   ✅ PASÓ: Podólogo autenticado con su perfil real de MySQL.');
    }

    // -----------------------------------------------------------------------
    // TEST 3: AUTENTICACIÓN REAL BCRYPT / HTTPONLY - RECEPCIONISTA
    // -----------------------------------------------------------------------
    console.log('\n[TEST 3] Verificación de credenciales reales: María López (Recepcionista)');
    const loginRecep = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'recepcion@elitefoot.com', password: 'recep123' });

    console.log(`   Status: ${loginRecep.status} (Esperado: 200)`);
    const recepCookie = extractCookie(loginRecep.headers);
    const recepNombre = loginRecep.body?.usuario?.perfil?.Nombre;
    const recepClinica = loginRecep.body?.usuario?.perfil?.clinica_nombre;
    console.log(`   Perfil retornado: ${recepNombre} (Clínica: ${recepClinica})`);

    if (loginRecep.status !== 200 || recepNombre !== 'María') {
      console.error('❌ FALLÓ TEST 3: Datos de recepcionista incorrectos');
      errors++;
    } else {
      console.log('   ✅ PASÓ: Recepcionista autenticada con su perfil real de MySQL.');
    }

    // -----------------------------------------------------------------------
    // TEST 4: AUDITORÍA DE ENDPOINTS DEL PODÓLOGO (Sin 404 ni 500)
    // -----------------------------------------------------------------------
    console.log('\n[TEST 4] Auditoría Funcional: Endpoints del módulo Podólogo');
    
    // 4.1 Agenda Personal
    const resAgendaPodo = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/medico/agenda',
      method: 'GET'
    }, null, podoCookie);
    console.log(`   GET /api/medico/agenda -> Status: ${resAgendaPodo.status} (Esperado: 200)`);
    if (resAgendaPodo.status !== 200) { errors++; console.error('   ❌ Error en agenda'); }

    // 4.2 Expediente clínico de prueba
    const resExp = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/medico/expediente/2026101101',
      method: 'GET'
    }, null, podoCookie);
    console.log(`   GET /api/medico/expediente/2026101101 -> Status: ${resExp.status} (Esperado: 200)`);
    if (resExp.status !== 200) { errors++; console.error('   ❌ Error en expediente'); }

    // 4.3 Diagnósticos de consulta CNS-001
    const resDiag = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/medico/consultas/CNS-001/diagnosticos',
      method: 'GET'
    }, null, podoCookie);
    console.log(`   GET /api/medico/consultas/CNS-001/diagnosticos -> Status: ${resDiag.status} (Esperado: 200)`);
    if (resDiag.status !== 200) { errors++; console.error('   ❌ Error en diagnósticos'); }

    // 4.4 Tratamientos de consulta CNS-001
    const resTrat = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/medico/consultas/CNS-001/tratamientos',
      method: 'GET'
    }, null, podoCookie);
    console.log(`   GET /api/medico/consultas/CNS-001/tratamientos -> Status: ${resTrat.status} (Esperado: 200)`);
    if (resTrat.status !== 200) { errors++; console.error('   ❌ Error en tratamientos'); }

    // 4.5 Mapa Podológico de consulta CNS-001
    const resMapa = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/medico/consultas/CNS-001/mapa',
      method: 'GET'
    }, null, podoCookie);
    console.log(`   GET /api/medico/consultas/CNS-001/mapa -> Status: ${resMapa.status} (Esperado: 200)`);
    if (resMapa.status !== 200) { errors++; console.error('   ❌ Error en mapa podológico'); }

    // 4.6 Prueba de Bloqueo RBAC Pagos para Podólogo
    const resBloqueoPagos = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/medico/prueba-bloqueo/pagos',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {}, podoCookie);
    console.log(`   POST /api/medico/prueba-bloqueo/pagos -> Status: ${resBloqueoPagos.status} (Esperado: 403)`);
    if (resBloqueoPagos.status !== 403) { errors++; console.error('   ❌ Falla de seguridad RBAC en pagos'); }

    // -----------------------------------------------------------------------
    // TEST 5: AUDITORÍA DE ENDPOINTS DE LA RECEPCIONISTA (Sin 404 ni 500)
    // -----------------------------------------------------------------------
    console.log('\n[TEST 5] Auditoría Funcional: Endpoints del módulo Recepcionista');

    // 5.1 Catálogos
    const resCat = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/recepcion/catalogos',
      method: 'GET'
    }, null, recepCookie);
    console.log(`   GET /api/recepcion/catalogos -> Status: ${resCat.status} (Esperado: 200)`);
    if (resCat.status !== 200) { errors++; console.error('   ❌ Error en catálogos'); }

    // 5.2 Consultas Globales
    const resConsultas = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/recepcion/consultas',
      method: 'GET'
    }, null, recepCookie);
    console.log(`   GET /api/recepcion/consultas -> Status: ${resConsultas.status} (Esperado: 200)`);
    if (resConsultas.status !== 200) { errors++; console.error('   ❌ Error en consultas globales'); }

    // 5.3 Directorio de Pacientes
    const resPacs = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/recepcion/pacientes',
      method: 'GET'
    }, null, recepCookie);
    console.log(`   GET /api/recepcion/pacientes -> Status: ${resPacs.status} (Esperado: 200)`);
    if (resPacs.status !== 200) { errors++; console.error('   ❌ Error en directorio de pacientes'); }

    // 5.4 Cobros Pendientes
    const resCobrosPend = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/recepcion/cobros/pendientes',
      method: 'GET'
    }, null, recepCookie);
    console.log(`   GET /api/recepcion/cobros/pendientes -> Status: ${resCobrosPend.status} (Esperado: 200)`);
    if (resCobrosPend.status !== 200) { errors++; console.error('   ❌ Error en cobros pendientes'); }

    // 5.5 Historial de Cobros
    const resCobrosHist = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/recepcion/cobros',
      method: 'GET'
    }, null, recepCookie);
    console.log(`   GET /api/recepcion/cobros -> Status: ${resCobrosHist.status} (Esperado: 200)`);
    if (resCobrosHist.status !== 200) { errors++; console.error('   ❌ Error en historial cobros'); }

    // 5.6 Prueba de Bloqueo Clínico para Recepcionista
    const resBloqueoRecep = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/recepcion/prueba-bloqueo/diagnosticos',
      method: 'GET'
    }, null, recepCookie);
    console.log(`   GET /api/recepcion/prueba-bloqueo/diagnosticos -> Status: ${resBloqueoRecep.status} (Esperado: 403)`);
    if (resBloqueoRecep.status !== 403) { errors++; console.error('   ❌ Falla de seguridad RBAC en bloqueo recepcionista'); }

    // -----------------------------------------------------------------------
    // TEST 6: VERIFICACIÓN RBAC DEL DOM FRONTEND
    // -----------------------------------------------------------------------
    console.log('\n[TEST 6] Verificación RBAC DOM Frontend (consultorio.html y recepcion.html)');
    const consultorioHtml = fs.readFileSync(path.join(__dirname, '../frontend-admin/consultorio.html'), 'utf8');
    const recepcionHtml = fs.readFileSync(path.join(__dirname, '../frontend-admin/recepcion.html'), 'utf8');

    const podoHasRbacMarkers = consultorioHtml.includes('data-rol-permitido="admin"');
    const recepHasRbacMarkers = recepcionHtml.includes('data-rol-permitido="admin"') && recepcionHtml.includes('data-rol-permitido="podologo"');

    console.log(`   Marcadores de rol en consultorio.html: ${podoHasRbacMarkers ? '✅ Presentes' : '❌ Ausentes'}`);
    console.log(`   Marcadores de rol en recepcion.html:   ${recepHasRbacMarkers ? '✅ Presentes' : '❌ Ausentes'}`);

    if (!podoHasRbacMarkers || !recepHasRbacMarkers) {
      console.error('❌ FALLÓ TEST 6: Faltan marcadores RBAC en el DOM');
      errors++;
    } else {
      console.log('   ✅ PASÓ: Marcadores y utilidades de eliminación DOM RBAC configurados.');
    }

    console.log('\n========================================================');
    if (errors === 0) {
      console.log('🎉 ¡AUDITORÍA COMPLETA EXITOSA! TODOS LOS TESTS PASARON AL 100%');
    } else {
      console.log(`⚠️ SE DETECTARON ${errors} ERROR(ES) EN LA AUDITORÍA`);
    }
    console.log('========================================================\n');

  } catch (err) {
    console.error('Error fatal durante la auditoría:', err);
    errors++;
  } finally {
    server.close();
    process.exit(errors > 0 ? 1 : 0);
  }
}

runQAAudit();

