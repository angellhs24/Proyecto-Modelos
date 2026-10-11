const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Importar Rutas
const clinicaRoutes = require('./routes/clinicaRoutes');
const pacienteRoutes = require('./routes/pacienteRoutes');
const consultaRoutes = require('./routes/consultaRoutes');
const citaRoutes = require('./routes/citaRoutes'); // Alias de compatibilidad
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

// Middleware de auditoría automática
const { auditoriaAutomaticaMiddleware } = require('./middlewares/auditoriaMiddleware');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(auditoriaAutomaticaMiddleware);

// Servir frontend estático (soporte de fallback y desarrollo)
const adminPath = path.join(__dirname, '../../frontend-admin');
const landingPath = path.join(__dirname, '../../frontend-landing/src');

app.use(express.static(adminPath));
app.use('/landing', express.static(landingPath));

// Rutas RBAC para Recepcionista y Podólogo
app.use('/api/auth', authRoutes);
app.use('/api/recepcion', recepcionistaRoutes);
app.use('/api/medico', medicoRoutes);

// Registro de endpoints de la API REST generales
app.use('/api/clinicas', clinicaRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/consultas', consultaRoutes);
app.use('/api/citas', citaRoutes); // Mantiene retrocompatibilidad
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

module.exports = app;
