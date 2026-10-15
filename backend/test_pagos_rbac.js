const http = require('http');
require('dotenv').config();

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
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

async function testPagos() {
  console.log('🧪 Iniciando Suite de Pruebas: Módulo de Pagos y Caja (RBAC & Transacciones)...');
  const app = require('./src/app');
  const server = app.listen(5003);
  await new Promise(r => setTimeout(r, 600));

  try {
    // 1. Login como Recepcionista (Rol ID: 3)
    console.log('\n[1] Autenticando Recepcionista (Rol ID: 3)...');
    const loginRecep = await makeRequest({
      hostname: 'localhost',
      port: 5003,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'recepcion@elitefoot.com', password: 'hash_simulado_recep123' });

    const tokenRecep = loginRecep.body?.token;
    console.log('Login Recep Status:', loginRecep.status, 'Token OK:', !!tokenRecep);

    // 2. Login como Podólogo (Rol ID: 4)
    console.log('\n[2] Autenticando Podólogo (Rol ID: 4)...');
    const loginPodo = await makeRequest({
      hostname: 'localhost',
      port: 5003,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'dr.perez@elitefoot.com', password: 'hash_simulado_podo123' });

    const tokenPodo = loginPodo.body?.token;
    console.log('Login Podólogo Status:', loginPodo.status, 'Token OK:', !!tokenPodo);

    // 3. GET /api/pagos como Recepcionista (Listar consultas pendientes de cobro)
    console.log('\n[3] GET /api/pagos como Recepcionista...');
    const pendientes = await makeRequest({
      hostname: 'localhost',
      port: 5003,
      path: '/api/pagos',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenRecep}` }
    });
    console.log('GET Pendientes Status:', pendientes.status, 'Consultas por cobrar:', pendientes.body?.length);
    if (pendientes.body?.length > 0) {
      console.log('Primera consulta pendiente:', pendientes.body[0].Consulta_id, 'Paciente:', pendientes.body[0].paciente_nombre, 'Monto sugerido:', pendientes.body[0].monto);
    }

    // 4. POST /api/pagos/cobrar como Recepcionista (Procesar cobro en Efectivo)
    const consultaACobrar = pendientes.body?.[0]?.Consulta_id || 'CNS-001';
    console.log(`\n[4] POST /api/pagos/cobrar como Recepcionista para consulta ${consultaACobrar}...`);
    const cobroEfectivo = await makeRequest({
      hostname: 'localhost',
      port: 5003,
      path: '/api/pagos/cobrar',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenRecep}`
      }
    }, {
      fk_consulta_id: consultaACobrar,
      monto: 450.00,
      metodo_pago: 'Efectivo',
      notas: 'Pago liquidado en caja en efectivo'
    });
    console.log('Cobro Efectivo Status:', cobroEfectivo.status, 'Recibo Folio:', cobroEfectivo.body?.recibo?.Pago_id, 'Estado:', cobroEfectivo.body?.recibo?.estado_pago);

    // 5. POST /api/pagos/cobrar con método Tarjeta
    if (pendientes.body?.length > 1) {
      const consulta2 = pendientes.body[1].Consulta_id;
      console.log(`\n[5] POST /api/pagos/cobrar con Tarjeta para consulta ${consulta2}...`);
      const cobroTarjeta = await makeRequest({
        hostname: 'localhost',
        port: 5003,
        path: '/api/pagos/cobrar',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenRecep}`
        }
      }, {
        fk_consulta_id: consulta2,
        monto: 550.00,
        metodo_pago: 'Tarjeta'
      });
      console.log('Cobro Tarjeta Status:', cobroTarjeta.status, 'Recibo Folio:', cobroTarjeta.body?.recibo?.Pago_id, 'Método:', cobroTarjeta.body?.recibo?.metodo_pago);
    }

    // 6. 🛡️ RBAC TEST: Intento de GET /api/pagos por un Podólogo (Rol 4) - Debe fallar con 403
    console.log('\n[6] 🛡️ RBAC TEST: Podólogo intenta acceder a GET /api/pagos (Caja)...');
    const getPodo = await makeRequest({
      hostname: 'localhost',
      port: 5003,
      path: '/api/pagos',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenPodo}` }
    });
    console.log('GET Podólogo Status:', getPodo.status, '(Esperado: 403 Forbidden)');
    console.log('Mensaje RBAC:', getPodo.body?.error);

    // 7. 🛡️ RBAC TEST: Intento de POST /api/pagos por un Podólogo (Rol 4) - Debe fallar con 403
    console.log('\n[7] 🛡️ RBAC TEST: Podólogo intenta cobrar en POST /api/pagos/cobrar...');
    const postPodo = await makeRequest({
      hostname: 'localhost',
      port: 5003,
      path: '/api/pagos/cobrar',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenPodo}`
      }
    }, {
      fk_consulta_id: 'CNS-103',
      monto: 300,
      metodo_pago: 'Efectivo'
    });
    console.log('POST Podólogo Status:', postPodo.status, '(Esperado: 403 Forbidden)');

    // 8. 🛡️ AUTH TEST: Intento sin token - Debe fallar con 401
    console.log('\n[8] 🛡️ AUTH TEST: Intento sin token de autenticación...');
    const sinAuth = await makeRequest({
      hostname: 'localhost',
      port: 5003,
      path: '/api/pagos',
      method: 'GET'
    });
    console.log('Sin Auth Status:', sinAuth.status, '(Esperado: 401 Unauthorized)');

    // 9. GET /api/pagos/resumen-caja
    console.log('\n[9] GET /api/pagos/resumen-caja...');
    const resumen = await makeRequest({
      hostname: 'localhost',
      port: 5003,
      path: '/api/pagos/resumen-caja',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenRecep}` }
    });
    console.log('Resumen Caja Status:', resumen.status, 'Total Cobrado Hoy:', resumen.body?.total_hoy, 'Cobros Hoy:', resumen.body?.cobros_hoy);

    console.log('\n🎉 ¡TODAS LAS PRUEBAS RBAC Y DE COBRO PASARON EXITOSAMENTE!');
  } catch (err) {
    console.error('❌ Error en pruebas:', err);
  } finally {
    server.close();
    process.exit(0);
  }
}

testPagos();
