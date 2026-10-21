const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// 1. Dashboard y Métricas Ejecutivas
router.get('/metricas', adminController.obtenerMetricas);

// 2. Gestión de Podólogos
router.get('/podologos', adminController.obtenerPodologosAdmin);
router.post('/podologos', adminController.crearPodologoAdmin);
router.put('/podologos/:cedula', adminController.actualizarPodologoAdmin);
router.put('/podologos/:cedula/estado', adminController.cambiarEstadoPodologo);
router.delete('/podologos/:cedula', adminController.eliminarPodologoDefinitivo);

// 3. Gestión de Recepcionistas
router.get('/recepcionistas', adminController.obtenerRecepcionistasAdmin);
router.post('/recepcionistas', adminController.crearRecepcionistaAdmin);
router.put('/recepcionistas/:id', adminController.actualizarRecepcionistaAdmin);
router.put('/recepcionistas/:id/estado', adminController.cambiarEstadoRecepcionista);
router.delete('/recepcionistas/:id', adminController.eliminarRecepcionistaDefinitivo);

// 4. Gestión de Clientes / Pacientes
router.get('/pacientes', adminController.obtenerPacientesAdmin);
router.put('/pacientes/:no_expediente', adminController.actualizarPacienteAdmin);

// 5. Centro de Anuncios Web
router.post('/avisos', adminController.enviarAvisoPaciente);
router.get('/avisos', adminController.obtenerHistorialAvisos);
router.put('/avisos/:id/estado', adminController.toggleEstadoAviso);
router.delete('/avisos/:id', adminController.eliminarAviso);

// 6. Gestión de Clínicas y Sedes
router.get('/clinicas', adminController.obtenerClinicasAdmin);
router.post('/clinicas', adminController.crearClinicaAdmin);
router.put('/clinicas/:id', adminController.actualizarClinicaAdmin);
router.put('/clinicas/:id/estado', adminController.cambiarEstadoClinica);
router.delete('/clinicas/:id', adminController.eliminarClinicaDefinitivo);

module.exports = router;
