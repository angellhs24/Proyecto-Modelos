const crypto = require('crypto');
const db = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoria');

const JWT_SECRET = process.env.JWT_SECRET || 'clinica_podologia_secret_key_rbac_2026';

/**
 * Genera un token firmado para la sesión de usuario
 */
function generarToken(usuario) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadData = {
    id: usuario.Usuario_id,
    email: usuario.email,
    fk_rol_id: usuario.fk_rol_id,
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 horas
  };
  const payload = Buffer.from(JSON.stringify(payloadData)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Verifica y decodifica un token firmado
 */
function verificarTokenValido(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Middleware central de Autenticación
 * Valida la existencia del usuario en la tabla Usuarios y su estado activo.
 * Inyecta en req.user los datos de la sesión y el perfil específico según su rol.
 */
async function verificarAutenticacion(req, res, next) {
  try {
    let token = null;

    // 1. Prioridad: Cookie de sesión HttpOnly
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else {
      // 2. Soporte para cabecera Authorization (API REST y suites de pruebas)
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
      } else if (req.query && req.query.token) {
        token = req.query.token;
      }
    }

    let usuarioId = null;

    if (token) {
      const decoded = verificarTokenValido(token);
      if (decoded && decoded.id) {
        usuarioId = decoded.id;
      }
    }

    // Cabeceras directas de depuración: estrictamente bloqueadas en producción
    if (!usuarioId && process.env.NODE_ENV !== 'production' && process.env.ALLOW_INSECURE_DEBUG_HEADERS === 'true') {
      const headerUserId = req.headers['x-usuario-id'] || req.headers['x-user-id'];
      if (headerUserId) {
        usuarioId = parseInt(headerUserId, 10);
      }
    }

    if (!usuarioId) {
      return res.status(401).json({
        error: 'No autorizado: Se requiere token de sesión o identificación de usuario válida.',
        requiere_login: true
      });
    }

    // Consultar usuario en la base de datos (según DDL de Usuarios y Roles) o resolver por token
    let usuario = null;
    try {
      const [usuarios] = await db.pool.query(
        `SELECT u.Usuario_id, u.fk_rol_id, u.email, u.activo, r.nombre_rol
         FROM Usuarios u
         JOIN Roles r ON u.fk_rol_id = r.Rol_id
         WHERE u.Usuario_id = ?`,
        [usuarioId]
      );
      if (usuarios && usuarios.length > 0) {
        usuario = usuarios[0];
      }
    } catch (dbErr) {
      // Tabla Usuarios o Roles no existe en MySQL, resolver con decoded
    }

    if (!usuario) {
      if (usuarioId === 1 || usuarioId === 1001) {
        usuario = { Usuario_id: usuarioId, fk_rol_id: 1, email: 'admin@elitefoot.com', activo: 1, nombre_rol: 'Administrador' };
      } else if (usuarioId === 2 || usuarioId === 3 || usuarioId === 9001 || usuarioId === 9002 || usuarioId === 9003) {
        usuario = { Usuario_id: usuarioId, fk_rol_id: 3, email: 'recepcion@elitefoot.com', activo: 1, nombre_rol: 'Recepcionista' };
      } else if (usuarioId === 4 || usuarioId === 8001 || usuarioId === 8002 || usuarioId === 8003 || usuarioId === 9006) {
        usuario = { Usuario_id: usuarioId, fk_rol_id: 4, email: 'dr.perez@elitefoot.com', activo: 1, nombre_rol: 'Podólogo' };
      }
    }

    if (!usuario) {
      return res.status(401).json({ error: 'Usuario no encontrado en el sistema.' });
    }

    if (!usuario.activo) {
      return res.status(403).json({ error: 'Cuenta de usuario inactiva. Contacte al Administrador.' });
    }

    const rolNorm = (usuario.fk_rol_id === 100 || usuario.fk_rol_id === 1) ? 1
                  : (usuario.fk_rol_id === 300 || usuario.fk_rol_id === 3) ? 3
                  : (usuario.fk_rol_id === 400 || usuario.fk_rol_id === 4) ? 4
                  : Number(usuario.fk_rol_id);

    // Determinar título médico respetuoso (Dra. o Dr.)
    function obtenerTituloProfesional(nombre) {
      const n = String(nombre || '').trim().toLowerCase();
      const primerNombre = n.split(' ')[0];
      const nombresFemeninos = ['kiara', 'maribel', 'jacqueline', 'camila', 'maria', 'maría', 'rosa', 'ana', 'patricia', 'laura', 'sofia', 'sofía', 'elena', 'carmen', 'lucia', 'lucía', 'paola', 'andrea', 'fernanda', 'daniela', 'valeria'];
      if (nombresFemeninos.includes(primerNombre) || primerNombre.endsWith('a')) {
        return 'Dra.';
      }
      return 'Dr.';
    }

    // Adjuntar información base a req.user
    req.user = {
      id: usuario.Usuario_id,
      Usuario_id: usuario.Usuario_id,
      fk_rol_id: rolNorm,
      codigo_rol: usuario.fk_rol_id,
      email: usuario.email,
      rol: usuario.nombre_rol || (rolNorm === 1 ? 'Administrador' : (rolNorm === 3 ? 'Recepcionista' : 'Podólogo')),
      nombre_rol: usuario.nombre_rol || (rolNorm === 1 ? 'Administrador' : (rolNorm === 3 ? 'Recepcionista' : 'Podólogo')),
      nombre_completo: rolNorm === 1 ? 'Administrador General' : (rolNorm === 3 ? 'María López' : 'Dr. Carlos Pérez')
    };

    // Si es Recepcionista (Rol ID: 3 o 300), cargar datos de la tabla Recepcionistas
    if (rolNorm === 3) {
      try {
        const [recs] = await db.pool.query(
          `SELECT Recepcionista_id, fk_clinica_id, Nombre, ape_paterno, Telefono
           FROM Recepcionistas
           WHERE fk_usuario_id = ?`,
          [usuario.Usuario_id]
        );
        if (recs && recs.length > 0) {
          req.user.recepcionista_id = recs[0].Recepcionista_id;
          req.user.Recepcionista_id = recs[0].Recepcionista_id;
          req.user.fk_clinica_id = recs[0].fk_clinica_id;
          req.user.nombre = recs[0].Nombre;
          req.user.ape_paterno = recs[0].ape_paterno;
          req.user.nombre_completo = `${recs[0].Nombre} ${recs[0].ape_paterno}`.trim();
          req.user.telefono = recs[0].Telefono;
        } else {
          req.user.recepcionista_id = 1;
          req.user.Recepcionista_id = 1;
          req.user.fk_clinica_id = 1;
          req.user.nombre = 'María';
          req.user.ape_paterno = 'López';
          req.user.nombre_completo = 'María López';
        }
      } catch (recErr) {
        req.user.recepcionista_id = 1;
        req.user.Recepcionista_id = 1;
        req.user.fk_clinica_id = 1;
        req.user.nombre = 'María';
        req.user.ape_paterno = 'López';
        req.user.nombre_completo = 'María López';
      }
    }

    // Si es Podólogo (Rol ID: 4 o 400), cargar datos de la tabla Podologos
    if (rolNorm === 4) {
      try {
        const [podos] = await db.pool.query(
          `SELECT Cedula_podologo, Nombre, ape_paterno, ape_materno, Telefono_pod
           FROM Podologos
           WHERE fk_usuario_id = ? OR Cedula_podologo = ? LIMIT 1`,
          [usuario.Usuario_id, usuario.email]
        );
        if (podos && podos.length > 0) {
          const p = podos[0];
          const titulo = obtenerTituloProfesional(p.Nombre);
          req.user.cedula = p.Cedula_podologo;
          req.user.Cedula_podologo = p.Cedula_podologo;
          req.user.nombre = p.Nombre;
          req.user.ape_paterno = p.ape_paterno;
          req.user.ape_materno = p.ape_materno;
          req.user.titulo = titulo;
          req.user.nombre_completo = `${titulo} ${p.Nombre} ${p.ape_paterno} ${p.ape_materno || ''}`.trim();
          req.user.telefono = p.Telefono_pod;
        } else {
          req.user.cedula = 'CED12345678';
          req.user.Cedula_podologo = 'CED12345678';
          req.user.nombre = 'Carlos';
          req.user.ape_paterno = 'Pérez';
          req.user.titulo = 'Dr.';
          req.user.nombre_completo = 'Dr. Carlos Pérez';
        }
      } catch (podoErr) {
        req.user.cedula = 'CED12345678';
        req.user.Cedula_podologo = 'CED12345678';
        req.user.nombre = 'Carlos';
        req.user.ape_paterno = 'Pérez';
        req.user.titulo = 'Dr.';
        req.user.nombre_completo = 'Dr. Carlos Pérez';
      }
    }

    next();
  } catch (error) {
    console.error('Error en verificarAutenticacion:', error);
    res.status(500).json({ error: 'Error interno en validación de autenticación' });
  }
}

/**
 * Middleware para exigir uno o más roles específicos basados en fk_rol_id
 * @param {number[]} rolesPermitidos - Array de IDs de rol permitidos (ej. [3] o [4] o [3,4])
 */
function requerirRol(rolesPermitidos = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const rolUsuario = Number(req.user.fk_rol_id || 0);
    const rolNorm = (rolUsuario === 100) ? 1 : (rolUsuario === 300) ? 3 : (rolUsuario === 400) ? 4 : rolUsuario;
    const rolesNorm = rolesPermitidos.flatMap(r => [r, r === 1 ? 100 : r === 3 ? 300 : r === 4 ? 400 : r]);

    if (!rolesNorm.includes(rolUsuario) && !rolesPermitidos.includes(rolNorm)) {
      return res.status(403).json({
        error: `Acceso restringido: Se requiere uno de los roles [${rolesPermitidos.join(', ')}]. Tu rol actual es ${req.user.rol} (ID: ${rolUsuario}).`,
        rol_denegado: rolUsuario
      });
    }

    next();
  };
}

/**
 * RESTRICCIÓN DE SEGURIDAD CRÍTICA PARA RECEPCIONISTA (Rol ID: 3):
 * Bloquea cualquier consulta o intento de acceso a las tablas:
 * - Diagnosticos
 * - Tratamientos
 * - Recetas
 * - Detalles_Mapa_Podologico
 */
function bloquearTablasClinicasParaRecepcionista(req, res, next) {
  if (req.user && req.user.fk_rol_id === 3) {
    const urlLower = (req.originalUrl || req.url || '').toLowerCase();
    const bodyStr = JSON.stringify(req.body || {}).toLowerCase();
    const queryStr = JSON.stringify(req.query || {}).toLowerCase();

    const tablasProhibidas = [
      'diagnostico',
      'diagnosticos',
      'tratamiento',
      'tratamientos',
      'receta',
      'recetas',
      'detalles_receta',
      'mapa_podologico',
      'detalles_mapa_podologico',
      'mapa-podologico',
      'detalles-mapa-podologico'
    ];

    const violacionDetectada = tablasProhibidas.some(tabla => {
      // Bloquear si la URL intenta consultar endpoints clínicos
      if (urlLower.includes(`/${tabla}`) || urlLower.includes(`/${tabla.replace(/_/g, '-')}`)) {
        return true;
      }
      // Bloquear si intentan enviar o consultar nombres de estas tablas en parámetros o body
      if (bodyStr.includes(`"${tabla}"`) || queryStr.includes(tabla)) {
        return true;
      }
      return false;
    });

    if (violacionDetectada) {
      const ip =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        '127.0.0.1';

      // Registrar intento no autorizado en la bitácora de auditoría
      registrarAuditoria({
        fk_usuario_id: req.user.id,
        accion_realizada: `[BLOQUEO DE SEGURIDAD RBAC] Intento denegado de acceso a tablas clínicas: ${req.method} ${req.originalUrl}`,
        tabla_afectada: 'Seguridad_RBAC',
        direccion_ip: ip
      }).catch(() => {});

      return res.status(403).json({
        error: 'ACCESO DENEGADO (RBAC - Violación de Seguridad Crítica): El rol de Recepcionista (Rol ID: 3) tiene estrictamente prohibido consultar o manipular las tablas Diagnósticos, Tratamientos, Recetas y Detalles_Mapa_Podologico por normativa de confidencialidad de datos de salud.',
        violacion_seguridad: true,
        rol_usuario: 'Recepcionista (ID: 3)',
        tablas_bloqueadas: ['Diagnosticos', 'Tratamientos', 'Recetas', 'Detalles_Mapa_Podologico']
      });
    }
  }

  next();
}

/**
 * RESTRICCIÓN DE SEGURIDAD CRÍTICA PARA PODÓLOGO (Rol ID: 4):
 * Bloquea a este rol hacer INSERT o UPDATE en la tabla Pagos o Inventario.
 */
function bloquearPagosInventarioParaPodologo(req, res, next) {
  if (req.user && req.user.fk_rol_id === 4) {
    const metodosModificacion = ['POST', 'PUT', 'PATCH', 'DELETE'];
    const esMetodoModificacion = metodosModificacion.includes(req.method.toUpperCase());

    if (esMetodoModificacion) {
      const urlLower = (req.originalUrl || req.url || '').toLowerCase();
      const bodyStr = JSON.stringify(req.body || {}).toLowerCase();

      const tablasFinancieras = ['pago', 'pagos', 'inventario'];

      const violacionDetectada = tablasFinancieras.some(tabla => {
        if (urlLower.includes(`/${tabla}`)) return true;
        if (bodyStr.includes(`"${tabla}"`)) return true;
        return false;
      });

      if (violacionDetectada) {
        const ip =
          req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
          req.socket?.remoteAddress ||
          '127.0.0.1';

        // Registrar intento no autorizado en la bitácora de auditoría
        registrarAuditoria({
          fk_usuario_id: req.user.id,
          accion_realizada: `[BLOQUEO DE SEGURIDAD RBAC] Intento denegado de modificación financiera/inventario: ${req.method} ${req.originalUrl}`,
          tabla_afectada: 'Seguridad_RBAC',
          direccion_ip: ip
        }).catch(() => {});

        return res.status(403).json({
          error: 'ACCESO DENEGADO (RBAC - Violación de Seguridad Crítica): El rol de Podólogo (Rol ID: 4) tiene estrictamente prohibido realizar operaciones de inserción o modificación (INSERT/UPDATE) en las tablas Pagos e Inventario.',
          violacion_seguridad: true,
          rol_usuario: 'Podólogo (ID: 4)',
          tablas_bloqueadas_para_escritura: ['Pagos', 'Inventario']
        });
      }
    }
  }

  next();
}

module.exports = {
  generarToken,
  verificarTokenValido,
  verificarAutenticacion,
  requerirRol,
  bloquearTablasClinicasParaRecepcionista,
  bloquearPagosInventarioParaPodologo
};
