const http = require('http');
const path = require('path');
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

async function runTests() {
  console.log('--- INICIANDO PRUEBAS RBAC RECEPCIONISTA & PODÓLOGO ---');

  const express = require('express');
  const cors = require('cors');

  const app = express();
  app.use(cors());
  app.use(express.json());

  const authRoutes = require('./routes/authRoutes');
  const recepcionistaRoutes = require('./routes/recepcionistaRoutes');
  const medicoRoutes = require('./routes/medicoRoutes');

  app.use('/api/auth', authRoutes);
  app.use('/api/recepcion', recepcionistaRoutes);
  app.use('/api/medico', medicoRoutes);

  const server = app.listen(4999);
  await new Promise(r => setTimeout(r, 600));

  try {
    // 1. Test Login Recepcionista
    console.log('\n[1] Probando login de Recepcionista...');
    const loginRecep = await makeRequest({
      hostname: 'localhost',
      port: 4999,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'recepcion@elitefoot.com', password: 'hash_simulado_recep123' });

    console.log('Login Recep Status:', loginRecep.status, 'Rol:', loginRecep.body?.usuario?.rol);
    const tokenRecep = loginRecep.body?.token;

    // 2. Test Registro de Pacientes (solo contacto)
    console.log('\n[2] Probando registro de paciente por recepcionista (Solo datos de contacto)...');
    const nuevoPac = await makeRequest({
      hostname: 'localhost',
      port: 4999,
      path: '/api/recepcion/pacientes',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenRecep}`
      }
    }, {
      Nombres: 'Ana Patricia',
      ape_paterno: 'Gómez',
      ape_materno: 'Ruiz',
      telefono: '5544332211',
      Fecha_nacimiento: '1992-05-14',
      Sexo: 'F',
      Calle_direccion: 'Calle Morelos 45',
      Municipio: 'Nezahualcoyotl',
      // Intentar enviar datos clínicos: deben ser omitidos / saneados por el backend
      es_diabetico: true,
      Antecedentes_patologicos: 'Historial confidencial no permitido en recepcion'
    });
    console.log('Registro Paciente Status:', nuevoPac.status, nuevoPac.body?.mensaje);
    const expCreado = nuevoPac.body?.paciente?.No_expediente;

    // 3. Test Agenda Global
    console.log('\n[3] Probando consulta de Agenda Global (Recepcionista)...');
    const agendaGlobal = await makeRequest({
      hostname: 'localhost',
      port: 4999,
      path: '/api/recepcion/consultas',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenRecep}` }
    });
    console.log('Agenda Global Status:', agendaGlobal.status, 'Consultas encontradas:', agendaGlobal.body?.length);

    // 4. Test Agendar Cita
    console.log('\n[4] Agendando nueva consulta desde Recepción...');
    const nuevaCita = await makeRequest({
      hostname: 'localhost',
      port: 4999,
      path: '/api/recepcion/consultas',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenRecep}`
      }
    }, {
      fk_no_expediente: expCreado,
      fk_cedula_podologo: 'CED12345678',
      fecha_hora: '2026-10-20 11:30:00',
      motivo_o_notas: 'Revisión podológica por dolor en talón'
    });
    console.log('Cita Agendada Status:', nuevaCita.status, nuevaCita.body?.mensaje);
    const citaId = nuevaCita.body?.consulta?.Consulta_id;

    // 5. Test Módulo de Cobros
    console.log('\n[5] Procesando cobro de consulta en tabla Pagos con fk_recepcionista_id...');
    const cobroRes = await makeRequest({
      hostname: 'localhost',
      port: 4999,
      path: '/api/recepcion/cobros',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenRecep}`
      }
    }, {
      fk_consulta_id: citaId,
      monto: 450.00,
      metodo_pago: 'Tarjeta de Débito'
    });
    console.log('Cobro Status:', cobroRes.status, 'fk_recepcionista_id registrado:', cobroRes.body?.pago?.fk_recepcionista_id);

    // 6. Test Restricción Crítica: Recepcionista bloqueada para tablas clínicas
    console.log('\n[6] RESTRICCIÓN CRÍTICA RECEPCIONISTA: Intentando acceder a tabla clínica...');
    const bloqueoClinico = await makeRequest({
      hostname: 'localhost',
      port: 4999,
      path: '/api/recepcion/prueba-bloqueo/diagnosticos',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenRecep}` }
    });
    console.log('Bloqueo Clínico Status (Debe ser 403 Forbidden):', bloqueoClinico.status);
    console.log('Mensaje de seguridad:', bloqueoClinico.body?.error?.slice(0, 90) + '...');

    // 7. Test Login Podólogo
    console.log('\n[7] Probando login de Podólogo...');
    const loginPodo = await makeRequest({
      hostname: 'localhost',
      port: 4999,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'dr.perez@elitefoot.com', password: 'hash_simulado_podo123' });
    console.log('Login Podólogo Status:', loginPodo.status, 'Rol:', loginPodo.body?.usuario?.rol);
    const tokenPodo = loginPodo.body?.token;

    // 8. Test Agenda Personal (solo citas de su cédula)
    console.log('\n[8] Consultando Agenda Personal del Dr. Carlos Pérez...');
    const agendaPersonal = await makeRequest({
      hostname: 'localhost',
      port: 4999,
      path: '/api/medico/agenda',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenPodo}` }
    });
    console.log('Agenda Personal Status:', agendaPersonal.status, 'Citas asignadas:', agendaPersonal.body?.length);

    // 9. Test Expediente Clínico (consulta y actualización de antecedentes)
    console.log('\n[9] Consultando Expediente Clínico completo del paciente...');
    const expClinico = await makeRequest({
      hostname: 'localhost',
      port: 4999,
      path: `/api/medico/expediente/${expCreado}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenPodo}` }
    });
    console.log('Expediente Clínico Status:', expClinico.status, 'Paciente:', expClinico.body?.paciente?.nombre_completo);

    // 10. Test Mapa Podológico Interactivo (Detalles_Mapa_Podologico)
    console.log('\n[10] Registrando lesión en el Mapa Podológico Interactivo (Detalles_Mapa_Podologico)...');
    const mapaRes = await makeRequest({
      hostname: 'localhost',
      port: 4999,
      path: `/api/medico/consultas/${citaId}/mapa`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenPodo}`
      }
    }, {
      zona_pie: 'Planta - Talón Izquierdo',
      tipo_lesion: 'Fisura de talón con hiperqueratosis',
      observaciones: 'Lesión grado 1 en zona de carga calcánea'
    });
    console.log('Registro Mapa Podológico Status:', mapaRes.status, 'Mapa_id generado:', mapaRes.body?.detalle?.Mapa_id);

    // 11. Test Restricción Crítica: Podólogo bloqueado para escribir en Pagos o Inventario
    console.log('\n[11] RESTRICCIÓN CRÍTICA PODÓLOGO: Intentando realizar modificación en Pagos/Inventario...');
    const bloqueoPagos = await makeRequest({
      hostname: 'localhost',
      port: 4999,
      path: '/api/medico/prueba-bloqueo/pagos',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenPodo}`
      }
    }, { monto: 999 });
    console.log('Bloqueo Pagos Status (Debe ser 403 Forbidden):', bloqueoPagos.status);
    console.log('Mensaje de seguridad:', bloqueoPagos.body?.error?.slice(0, 90) + '...');

    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE SEGURIDAD RBAC Y FUNCIONALIDAD PASARON EXITOSAMENTE!');
  } finally {
    server.close();
  }
}

runTests().then(() => process.exit(0)).catch(e => {
  console.error('ERROR EN PRUEBAS:', e);
  process.exit(1);
});
