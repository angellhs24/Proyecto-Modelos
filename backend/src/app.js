const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Importar Conexión a BD
const db = require('./config/db');

// Importar Rutas
const clinicaRoutes = require('./routes/clinicaRoutes');
const pacienteRoutes = require('./routes/pacienteRoutes');
const consultaRoutes = require('./routes/consultaRoutes');
const citaRoutes = require('./routes/citaRoutes');
const podologoRoutes = require('./routes/podologoRoutes');
const diagnosticoRoutes = require('./routes/diagnosticoRoutes');
const tratamientoRoutes = require('./routes/tratamientoRoutes');
const documentoRoutes = require('./routes/documentoRoutes');
const recetaRoutes = require('./routes/recetaRoutes');
const inventarioRoutes = require('./routes/inventarioRoutes');
const pagoRoutes = require('./routes/pagoRoutes');
const mapaPodologicoRoutes = require('./routes/mapaPodologicoRoutes');
const auditoriaRoutes = require('./routes/auditoriaRoutes');

// Importar Rutas especializadas RBAC
const authRoutes = require('./routes/authRoutes');
const recepcionistaRoutes = require('./routes/recepcionistaRoutes');
const medicoRoutes = require('./routes/medicoRoutes');
const devRoutes = require('./routes/devRoutes');

// Middleware de auditoría automática
const { auditoriaAutomaticaMiddleware } = require('./middlewares/auditoriaMiddleware');

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(auditoriaAutomaticaMiddleware);

// Servir frontend estático (soporte directo en desarrollo)
const adminPath = path.join(__dirname, '../../frontend-admin');
const landingSrcPath = path.join(__dirname, '../../frontend-landing/src');
const landingPublicPath = path.join(__dirname, '../../frontend-landing/public');

app.use(express.static(adminPath));
app.use('/landing', express.static(landingSrcPath));
app.use('/public', express.static(landingPublicPath));

// Rutas de navegación directa a las vistas HTML
app.get(['/login-dev', '/login-dev.html'], (req, res) => {
  res.sendFile(path.join(adminPath, 'login-dev.html'));
});
app.get(['/recepcion', '/recepcion.html'], (req, res) => {
  res.sendFile(path.join(adminPath, 'recepcion.html'));
});
app.get(['/consultorio', '/consultorio.html'], (req, res) => {
  res.sendFile(path.join(adminPath, 'consultorio.html'));
});

// Rutas RBAC para Recepcionista y Podólogo
app.use('/api/auth', authRoutes);
app.use('/api/dev', devRoutes);
app.use('/api/recepcion', recepcionistaRoutes);
app.use('/api/medico', medicoRoutes);

// Registro de endpoints de la API REST generales
app.use('/api/clinicas', clinicaRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/consultas', consultaRoutes);
app.use('/api/citas', citaRoutes);
app.use('/api/podologos', podologoRoutes);
app.use('/api/diagnosticos', diagnosticoRoutes);
app.use('/api/tratamientos', tratamientoRoutes);
app.use('/api/documentos', documentoRoutes);
app.use('/api/recetas', recetaRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/pagos', pagoRoutes);
app.use('/api/mapa-podologico', mapaPodologicoRoutes);
app.use('/api/detalles-mapa-podologico', mapaPodologicoRoutes);
app.use('/api/auditoria', auditoriaRoutes);

// Endpoint de estado del servidor
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    servicio: 'Clinica Podologia Backend API',
    version: '2.0.0',
    timestamp: new Date()
  });
});

// Si se ejecuta directamente, iniciar el servidor
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`🚀 Servidor de Podología corriendo en el puerto ${PORT}`);
    try {
      const res = await db.query('SELECT NOW() AS hora_actual');
      console.log('✅ Conexión exitosa a MySQL (Clinica_Podologia):', res.rows[0].hora_actual);
    } catch (error) {
      console.error('❌ Error al conectar con MySQL:', error.message);
    }
  });
}

module.exports = app;
