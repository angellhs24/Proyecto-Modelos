const { registrarAuditoria } = require('../utils/auditoria');

/**
 * Middleware para auditar automáticamente peticiones POST, PUT, DELETE.
 */
function auditoriaAutomaticaMiddleware(req, res, next) {
  const metodosAuditables = ['POST', 'PUT', 'DELETE', 'PATCH'];

  if (!metodosAuditables.includes(req.method)) {
    return next();
  }

  // Interceptar la finalización de la respuesta
  res.on('finish', () => {
    // Solo auditar si la respuesta fue exitosa (código 200-299) y no fue marcado como manual
    if (res.statusCode >= 200 && res.statusCode < 300 && !req.auditoriaManual) {
      const usuarioId =
        req.user?.id ||
        parseInt(req.headers['x-usuario-id'] || req.headers['x-user-id'], 10) ||
        (req.body?.fk_usuario_id ? parseInt(req.body.fk_usuario_id, 10) : 1);

      const ip =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        req.ip ||
        '127.0.0.1';

      // Determinar tabla y acción basada en la URL y método
      const pathSegments = req.baseUrl ? req.baseUrl.split('/').filter(Boolean) : req.path.split('/').filter(Boolean);
      const recurso = pathSegments[1] || pathSegments[0] || 'Desconocido';

      const tablaMap = {
        recetas: 'Recetas',
        inventario: 'Inventario',
        pagos: 'Pagos',
        'mapa-podologico': 'Detalles_Mapa_Podologico',
        'detalles-mapa-podologico': 'Detalles_Mapa_Podologico',
        consultas: 'Consultas',
        citas: 'Consultas',
        pacientes: 'Pacientes',
        clinicas: 'Clinicas',
        podologos: 'Podologos',
        diagnosticos: 'Diagnosticos',
        tratamientos: 'Tratamientos',
        documentos: 'Documentos_escaneados',
        auditoria: 'Bitacora_Auditoria',
        recepcion: 'Recepcion',
        medico: 'Medico'
      };

      const tablaAfectada = tablaMap[recurso.toLowerCase()] || recurso;

      const accionVerbo = {
        POST: 'Creación de registro en',
        PUT: 'Actualización de registro en',
        PATCH: 'Modificación parcial en',
        DELETE: 'Eliminación de registro en'
      }[req.method] || 'Operación en';

      const accionRealizada = `${accionVerbo} ${tablaAfectada} (${req.originalUrl || req.url})`;

      registrarAuditoria({
        fk_usuario_id: usuarioId,
        accion_realizada: accionRealizada,
        tabla_afectada: tablaAfectada,
        direccion_ip: ip
      }).catch(() => {});
    }
  });

  next();
}

module.exports = {
  auditoriaAutomaticaMiddleware
};
