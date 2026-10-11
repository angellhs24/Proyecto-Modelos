const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Importar conexión a Base de Datos
const db = require('./config/db');

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

// Middleware de auditoría automática
const { auditoriaAutomaticaMiddleware } = require('./middlewares/auditoriaMiddleware');

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(auditoriaAutomaticaMiddleware);

// Servir frontend estático de podología y carpeta completa frontend
app.use(express.static(path.join(__dirname, '../frontend/podologo')));
app.use('/frontend', express.static(path.join(__dirname, '../frontend')));

// Ruta principal explícita
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/podologo/index.html'));
});

// Registro de endpoints de la API REST
app.use('/api/clinicas', clinicaRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/consultas', consultaRoutes);
app.use('/api/citas', citaRoutes); // Mantiene retrocompatibilidad con frontend existente
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

app.listen(PORT, async () => {
  console.log(`🚀 Servidor de Podología corriendo en el puerto ${PORT}`);
  try {
    const res = await db.query('SELECT NOW() AS hora_actual');
    console.log(' Conexión exitosa a MySQL (Clinica_Podologia):', res.rows[0].hora_actual);
  } catch (error) {
    console.error(' Error al conectar con MySQL:', error.message);
  }
});