const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
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
const recetasRoutes = require('./routes/recetasRoutes');
const inventarioRoutes = require('./routes/inventarioRoutes');
const pagosRoutes = require('./routes/pagosRoutes');
const mapaPodologicoRoutes = require('./routes/mapaPodologicoRoutes');
const auditoriaRoutes = require('./routes/auditoriaRoutes');

// Importar Rutas especializadas RBAC y Administración
const authRoutes = require('./routes/authRoutes');
const authController = require('./controllers/authController');
const recepcionistaRoutes = require('./routes/recepcionistaRoutes');
const medicoRoutes = require('./routes/medicoRoutes');
const devRoutes = require('./routes/devRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Middleware de auditoría automática y control estricto de caché
const { auditoriaAutomaticaMiddleware } = require('./middlewares/auditoriaMiddleware');
const { prevenirCache } = require('./middlewares/cacheControlMiddleware');

const app = express();
const PORT = process.env.PORT || 4000;

// 1. Blindaje de Cabeceras HTTP con Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// 2. CORS con soporte estricto de Credenciales / Cookies
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (/^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

// 3. Parser de Cookies para lectura de tokens HttpOnly
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(auditoriaAutomaticaMiddleware);

// Endpoint directo de Logout para invalidar sesión
app.post('/api/logout', authController.logout);

// Rutas de carpetas estáticas del frontend
const adminPath = path.join(__dirname, '../../frontend-admin');
const landingBasePath = path.join(__dirname, '../../frontend-landing');
const landingSrcPath = path.join(landingBasePath, 'src');
const landingPublicPath = path.join(landingBasePath, 'public');

// ============================================================================
// Rutas de navegación directa a vistas HTML
// ============================================================================

// 1. Página principal de la Clínica (Landing pública / Portal de Pacientes)
app.get(['/', '/clinica', '/inicio'], (req, res) => {
  res.sendFile(path.join(landingSrcPath, 'index.html'));
});

// Middleware global anti-caché para todos los endpoints de API
app.use('/api', prevenirCache);

// 2. Portal de acceso / Login del personal (Admin, Podólogo, Recepcionista)
app.get(['/login', '/login.html'], (req, res) => {
  res.sendFile(path.join(adminPath, 'login.html'));
});

// 3. Paneles del personal clínico y administrativo (Inyección estricta de no-caché)
app.get(['/admin', '/admin.html'], prevenirCache, (req, res) => {
  res.sendFile(path.join(adminPath, 'admin.html'));
});
app.get(['/recepcion', '/recepcion.html'], prevenirCache, (req, res) => {
  res.sendFile(path.join(adminPath, 'recepcion.html'));
});
app.get(['/consultorio', '/consultorio.html'], prevenirCache, (req, res) => {
  res.sendFile(path.join(adminPath, 'consultorio.html'));
});
app.get(['/inventario', '/inventario.html'], prevenirCache, (req, res) => {
  res.sendFile(path.join(adminPath, 'inventario.html'));
});
app.get(['/caja', '/caja.html', '/cobros', '/cobros.html'], prevenirCache, (req, res) => {
  res.sendFile(path.join(adminPath, 'caja.html'));
});
app.get(['/login-dev', '/login-dev.html'], prevenirCache, (req, res) => {
  res.sendFile(path.join(adminPath, 'login-dev.html'));
});

// ============================================================================
// Servir archivos estáticos (CSS, JS, imágenes)
// ============================================================================
app.use(express.static(landingSrcPath));
app.use(express.static(adminPath, {
  index: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
  }
}));
app.use('/landing', express.static(landingSrcPath));
app.use('/public', express.static(landingPublicPath));
app.use('/frontend-admin', express.static(adminPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
  }
}));
app.use('/frontend-landing', express.static(landingBasePath));

// Rutas RBAC y Panel de Administración
app.use('/api/auth', authRoutes);
app.use('/api/dev', devRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/recepcion', recepcionistaRoutes);
app.use('/api/medico', medicoRoutes);

// Endpoint público de anuncios activos para el carrusel de Historias en la landing page
app.get('/api/anuncios', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const storePath = path.resolve(__dirname, 'data/admin_store.json');
    if (fs.existsSync(storePath)) {
      const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      const activos = (store.avisos || []).filter((a) => a.activo !== false);
      return res.json(activos);
    }
    return res.json([]);
  } catch (error) {
    console.error('Error al consultar anuncios públicos:', error);
    res.status(500).json({ error: 'Error al consultar anuncios' });
  }
});

// Registro de endpoints de la API REST generales
app.use('/api/clinicas', clinicaRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/consultas', consultaRoutes);
app.use('/api/citas', citaRoutes);
app.use('/api/podologos', podologoRoutes);
app.use('/api/diagnosticos', diagnosticoRoutes);
app.use('/api/tratamientos', tratamientoRoutes);
app.use('/api/documentos', documentoRoutes);
app.use('/api/recetas', recetasRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/pagos', pagosRoutes);
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

// Función para iniciar el servidor
function startServer(port = PORT) {
  return app.listen(port, async () => {
    console.log(`\n======================================================`);
    console.log(`🚀 SERVIDOR DE PODOLOGÍA INICIADO CORRECTAMENTE`);
    console.log(`📡 Puerto: ${port}`);
    console.log(`🏥 Página de la Clínica (Pública): http://localhost:${port}/`);
    console.log(`🔐 Acceso al Personal (Login):     http://localhost:${port}/login`);
    console.log(`======================================================\n`);
    try {
      const res = await db.query('SELECT NOW() AS hora_actual');
      console.log('✅ Conexión exitosa a MySQL (Clinica_Podologia):', res.rows[0].hora_actual);
    } catch (error) {
      console.error('❌ Error al conectar con MySQL:', error.message);
    }
  });
}

// Si se ejecuta directamente este archivo
if (require.main === module) {
  startServer();
}

module.exports = app;
module.exports.startServer = startServer;
