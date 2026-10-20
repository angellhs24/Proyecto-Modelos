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

async function runRecetasRBACTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 TEST SUITE: Módulo de Recetas Médicas Digitales (RBAC & PDF)');
  console.log('🧪 ========================================================\n');

  const app = require('./src/app');
  const TEST_PORT = 5005;
  const server = app.listen(TEST_PORT);
  await new Promise(r => setTimeout(r, 600));

  let exitCode = 0;

  try {
    // 1. Iniciar sesión como Podólogo (Rol ID: 4)
    console.log('[1] Autenticando Podólogo (Rol ID: 4)...');
    const loginPodo = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'dr.perez@elitefoot.com', password: 'hash_simulado_podo123' });

    const tokenPodo = loginPodo.body?.token;
    console.log(`    Status: ${loginPodo.status} | Token recibido: ${!!tokenPodo}`);

    // 2. Iniciar sesión como Recepcionista (Rol ID: 3)
    console.log('\n[2] Autenticando Recepcionista (Rol ID: 3)...');
    const loginRecep = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'recepcion@elitefoot.com', password: 'hash_simulado_recep123' });

    const tokenRecep = loginRecep.body?.token;
    console.log(`    Status: ${loginRecep.status} | Token recibido: ${!!tokenRecep}`);

    // 3. Iniciar sesión como Administrador (Rol ID: 1)
    console.log('\n[3] Autenticando Administrador (Rol ID: 1)...');
    const loginAdmin = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@elitefoot.com', password: 'hash_simulado_admin123' });

    const tokenAdmin = loginAdmin.body?.token;
    console.log(`    Status: ${loginAdmin.status} | Token recibido: ${!!tokenAdmin}`);

    // 4. Buscar una consulta activa existente en la base de datos
    const db = require('./src/config/db');
    const [consultas] = await db.pool.query('SELECT Consulta_id, fk_no_expediente FROM Consultas ORDER BY fecha_hora DESC LIMIT 1');
    const consultaId = consultas.length > 0 ? consultas[0].Consulta_id : 'CNS-TEST-001';
    const expedienteId = consultas.length > 0 ? consultas[0].fk_no_expediente : 2026010001;
    console.log(`\n📋 Usando consulta de prueba: ${consultaId} (Expediente: ${expedienteId})`);

    // 5. TEST ÉXITO: Podólogo (Rol 4) emite receta con múltiples medicamentos
    console.log('\n[4] ✅ TEST: Podólogo (Rol 4) emite nueva receta médica (POST /api/recetas)...');
    const recetaPayload = {
      fk_consulta_id: consultaId,
      fk_paciente_id: expedienteId,
      indicaciones_generales: 'Lavar con jabón neutro, secar meticulosamente los espacios interdigitales y usar calzado transpirable.',
      medicamentos: [
        {
          medicamento: 'Ciclopirox laca ungueal al 8%',
          dosis: '1 aplicación nocturna',
          via_administracion: 'Tópica',
          frecuencia: 'Cada 24 horas',
          duracion: '30 días'
        },
        {
          medicamento: 'Ácido Salicílico en vaselina al 15%',
          dosis: 'Capa muy delgada en zonas de hiperqueratosis',
          via_administracion: 'Tópica',
          frecuencia: 'Cada noche',
          duracion: '14 días'
        }
      ]
    };

    const emitirRes = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/recetas',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenPodo}`
      }
    }, recetaPayload);

    console.log(`    Status: ${emitirRes.status} (Esperado: 201)`);
    console.log(`    Folio emitido: ${emitirRes.body?.folio} | Medicamentos: ${emitirRes.body?.medicamentos?.length}`);
    if (emitirRes.status !== 201) {
      console.error('    ❌ FALLÓ la emisión de receta por el Podólogo:', emitirRes.body);
      exitCode = 1;
    } else {
      console.log('    ✅ PASÓ: Podólogo autorizado con éxito.');
    }

    const folioGenerado = emitirRes.body?.folio || 'RX-2026-TEST';

    // 6. 🛡️ RBAC TEST: Recepcionista (Rol 3) intenta POST /api/recetas -> DEBE RECIBIR 403 Forbidden
    console.log('\n[5] 🛡️ RBAC TEST: Recepcionista (Rol 3) intenta POST /api/recetas...');
    const recepPostRes = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/recetas',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenRecep}`
      }
    }, recetaPayload);

    console.log(`    Status: ${recepPostRes.status} (Esperado: 403 Forbidden)`);
    console.log(`    Mensaje error: ${recepPostRes.body?.error}`);
    if (recepPostRes.status === 403) {
      console.log('    ✅ PASÓ: Recepcionista correctamente bloqueada con 403 Forbidden.');
    } else {
      console.error('    ❌ FALLÓ: Se esperaba 403 Forbidden pero se recibió:', recepPostRes.status);
      exitCode = 1;
    }

    // 7. 🛡️ RBAC TEST: Administrador (Rol 1) intenta POST /api/recetas -> DEBE RECIBIR 403 Forbidden
    console.log('\n[6] 🛡️ RBAC TEST: Administrador (Rol 1) intenta POST /api/recetas...');
    const adminPostRes = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/recetas',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenAdmin}`
      }
    }, recetaPayload);

    console.log(`    Status: ${adminPostRes.status} (Esperado: 403 Forbidden)`);
    console.log(`    Mensaje error: ${adminPostRes.body?.error}`);
    if (adminPostRes.status === 403) {
      console.log('    ✅ PASÓ: Administrador correctamente bloqueado con 403 Forbidden.');
    } else {
      console.error('    ❌ FALLÓ: Se esperaba 403 Forbidden pero se recibió:', adminPostRes.status);
      exitCode = 1;
    }

    // 8. TEST: Recepcionista (Rol 3) consulta GET /api/recetas/consulta/:id -> DEBE PERMITIR (200 OK)
    console.log(`\n[7] 📖 TEST: Recepcionista (Rol 3) consulta GET /api/recetas/consulta/${consultaId}...`);
    const recepGetRes = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: `/api/recetas/consulta/${consultaId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenRecep}`
      }
    });

    console.log(`    Status: ${recepGetRes.status} (Esperado: 200)`);
    console.log(`    Receta obtenida: Folio ${recepGetRes.body?.Receta_id} | Paciente: ${recepGetRes.body?.paciente}`);
    if (recepGetRes.status === 200 && recepGetRes.body?.Receta_id) {
      console.log('    ✅ PASÓ: Recepcionista autorizada a consultar recetas para impresión/entrega.');
    } else {
      console.error('    ❌ FALLÓ la consulta de receta por Recepcionista:', recepGetRes.body);
      exitCode = 1;
    }

    // 9. TEST: Generación de PDF Membretado GET /api/recetas/:id/pdf
    console.log(`\n[8] 🖨️ TEST: Descarga / Visualización de PDF membretado (GET /api/recetas/${folioGenerado}/pdf)...`);
    const pdfRes = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: `/api/recetas/${encodeURIComponent(folioGenerado)}/pdf`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenRecep}`
      }
    });

    console.log(`    Status: ${pdfRes.status} (Esperado: 200)`);
    console.log(`    Content-Type: ${pdfRes.headers['content-type']}`);
    const tieneMarca = typeof pdfRes.body === 'string' && pdfRes.body.includes('Elite Foot Care');
    const tieneFirma = typeof pdfRes.body === 'string' && pdfRes.body.includes('Firma Electrónica Médica Válida');
    console.log(`    Contiene membrete 'Elite Foot Care': ${tieneMarca}`);
    console.log(`    Contiene bloque de firma médica y sello: ${tieneFirma}`);

    if (pdfRes.status === 200 && tieneMarca && tieneFirma) {
      console.log('    ✅ PASÓ: Documento membretado generado profesionalmente.');
    } else {
      console.error('    ❌ FALLÓ el contenido de la receta membretada');
      exitCode = 1;
    }

    // 10. TEST: Consulta por consulta PDF (GET /api/recetas/consulta/:id/pdf)
    console.log(`\n[9] 🖨️ TEST: Consulta de PDF por Consulta ID (GET /api/recetas/consulta/${consultaId}/pdf)...`);
    const pdfConsultaRes = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: `/api/recetas/consulta/${consultaId}/pdf`,
      method: 'GET'
    });
    console.log(`    Status: ${pdfConsultaRes.status} (Esperado: 200)`);
    if (pdfConsultaRes.status === 200) {
      console.log('    ✅ PASÓ: Endpoint directo por consulta disponible para impresión.');
    } else {
      console.error('    ❌ FALLÓ endpoint directo por consulta.');
      exitCode = 1;
    }

    console.log('\n========================================================');
    if (exitCode === 0) {
      console.log('🎉 TODOS LOS TESTS DE RBAC Y RECETAS MÉDICAS PASARON (100%)');
    } else {
      console.log('❌ ALGUNOS TESTS FALLARON');
    }
    console.log('========================================================\n');

  } catch (err) {
    console.error('Error catastrófico en la suite de pruebas:', err);
    exitCode = 1;
  } finally {
    server.close();
    process.exit(exitCode);
  }
}

runRecetasRBACTests();
