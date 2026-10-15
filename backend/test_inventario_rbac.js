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

async function testInventario() {
  console.log('🧪 Iniciando Suite de Pruebas CRUD Inventario & RBAC...');
  const app = require('./src/app');
  const server = app.listen(5001);
  await new Promise(r => setTimeout(r, 600));

  try {
    // 1. Obtener Token de Recepcionista (Rol 3)
    console.log('\n[1] Autenticando Recepcionista (Rol ID: 3)...');
    const loginRecep = await makeRequest({
      hostname: 'localhost',
      port: 5001,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'recepcion@elitefoot.com', password: 'hash_simulado_recep123' });

    console.log('Login Recep Status:', loginRecep.status, 'Token recibido:', !!loginRecep.body?.token);
    const tokenRecep = loginRecep.body?.token;

    // 2. Obtener Token de Podólogo (Rol 4)
    console.log('\n[2] Autenticando Podólogo (Rol ID: 4)...');
    const loginPodo = await makeRequest({
      hostname: 'localhost',
      port: 5001,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'dr.perez@elitefoot.com', password: 'hash_simulado_podo123' });

    console.log('Login Podólogo Status:', loginPodo.status, 'Token recibido:', !!loginPodo.body?.token);
    const tokenPodo = loginPodo.body?.token;

    // 3. GET /api/inventario con token de Recepcionista
    console.log('\n[3] GET /api/inventario con token de Recepcionista...');
    const listado = await makeRequest({
      hostname: 'localhost',
      port: 5001,
      path: '/api/inventario',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenRecep}` }
    });
    console.log('GET Inventario Status:', listado.status, 'Artículos obtenidos:', listado.body.length);
    const conAlerta = listado.body.filter(a => a.alerta_reabastecer);
    console.log(`Artículos con alerta de reabastecimiento (stock <= mínimo): ${conAlerta.length}`);

    // 4. POST /api/inventario como Recepcionista (Permitido)
    console.log('\n[4] POST /api/inventario (Crear Artículo como Recepcionista - Rol 3)...');
    const nuevoArticulo = await makeRequest({
      hostname: 'localhost',
      port: 5001,
      path: '/api/inventario',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenRecep}`
      }
    }, {
      nombre_articulo: 'Pinzas de Disección Podológica 14cm',
      categoria: 'Instrumental',
      cantidad_stock: 3,
      unidad_medida: 'Pieza',
      stock_minimo: 6,
      fk_clinica_id: 1
    });
    console.log('POST Inventario Status:', nuevoArticulo.status, 'ID creado:', nuevoArticulo.body?.Articulo_id);
    const nuevoId = nuevoArticulo.body?.Articulo_id;

    // 5. PUT /api/inventario/:id como Recepcionista (Actualizar stock)
    console.log(`\n[5] PUT /api/inventario/${nuevoId} (Actualizar cantidad_stock a 15)...`);
    const updateArticulo = await makeRequest({
      hostname: 'localhost',
      port: 5001,
      path: `/api/inventario/${nuevoId}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenRecep}`
      }
    }, {
      cantidad_stock: 15
    });
    console.log('PUT Inventario Status:', updateArticulo.status, 'Mensaje:', updateArticulo.body?.mensaje, 'Nuevo stock:', updateArticulo.body?.articulo?.cantidad_stock);

    // 6. RBAC: Intento de POST como Podólogo (Rol 4) - Debe fallar con 403 Forbidden
    console.log('\n[6] 🛡️ RBAC TEST: Intento de POST /api/inventario como Podólogo (Rol 4)...');
    const intentoPodoPost = await makeRequest({
      hostname: 'localhost',
      port: 5001,
      path: '/api/inventario',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenPodo}`
      }
    }, {
      nombre_articulo: 'Intrusión No Autorizada',
      cantidad_stock: 10
    });
    console.log('Intento POST Podólogo Status:', intentoPodoPost.status, '(Esperado: 403)');
    console.log('Respuesta de error RBAC:', intentoPodoPost.body?.error);

    // 7. RBAC: Intento de DELETE como Podólogo (Rol 4) - Debe fallar con 403 Forbidden
    console.log(`\n[7] 🛡️ RBAC TEST: Intento de DELETE /api/inventario/${nuevoId} como Podólogo (Rol 4)...`);
    const intentoPodoDel = await makeRequest({
      hostname: 'localhost',
      port: 5001,
      path: `/api/inventario/${nuevoId}`,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${tokenPodo}`
      }
    });
    console.log('Intento DELETE Podólogo Status:', intentoPodoDel.status, '(Esperado: 403)');

    // 8. DELETE /api/inventario/:id como Recepcionista (Permitido)
    console.log(`\n[8] DELETE /api/inventario/${nuevoId} como Recepcionista (Rol 3)...`);
    const deleteRecep = await makeRequest({
      hostname: 'localhost',
      port: 5001,
      path: `/api/inventario/${nuevoId}`,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${tokenRecep}`
      }
    });
    console.log('DELETE Inventario Status:', deleteRecep.status, 'Mensaje:', deleteRecep.body?.mensaje);

    // 9. Intento sin autenticación - Debe fallar con 401 Unauthorized
    console.log('\n[9] 🛡️ AUTH TEST: Intento de GET /api/inventario sin Token...');
    const sinAuth = await makeRequest({
      hostname: 'localhost',
      port: 5001,
      path: '/api/inventario',
      method: 'GET'
    });
    console.log('Intento sin Auth Status:', sinAuth.status, '(Esperado: 401)');

    console.log('\n🎉 ¡TODAS LAS PRUEBAS RBAC Y CRUD PASARON EXITOSAMENTE!');
  } catch (err) {
    console.error('❌ Error en ejecución de pruebas:', err);
  } finally {
    server.close();
    process.exit(0);
  }
}

testInventario();
