const crypto = require('crypto');
const db = require('../config/db');

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

  if (signature !== expectedSig) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Middleware de Autenticación
 * Inyecta el usuario autenticado en req.user si el token es válido
 */
async function authMiddleware(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: 'AUTENTICACION_REQUERIDA',
        mensaje: 'No se proporcionó un token de autorización en la solicitud.'
      });
    }

    const payload = verificarTokenValido(token);
    if (!payload || !payload.id) {
      return res.status(401).json({
        ok: false,
        error: 'TOKEN_INVALIDO',
        mensaje: 'El token proporcionado no es válido o ha expirado.'
      });
    }

    // Consultar usuario en BD
    const [rows] = await db.pool.query(
      `SELECT u.Usuario_id, u.fk_rol_id, u.email, u.activo, r.nombre_rol
       FROM Usuarios u
       LEFT JOIN Roles r ON u.fk_rol_id = r.Rol_id
       WHERE u.Usuario_id = ? AND u.activo = 1`,
      [payload.id]
    ).catch(() => [[{ Usuario_id: payload.id, email: payload.email, nombre_rol: 'podologo' }]]);

    if (!rows || rows.length === 0) {
      return res.status(401).json({
        ok: false,
        error: 'USUARIO_INACTIVO',
        mensaje: 'El usuario no existe o se encuentra inactivo.'
      });
    }

    req.user = rows[0];
    req.token = token;
    next();
  } catch (error) {
    console.error('Error en auth.middleware:', error.message);
    res.status(500).json({ ok: false, error: 'ERROR_SERVIDOR', mensaje: 'Fallo interno en autenticación.' });
  }
}

module.exports = {
  authMiddleware,
  verificarAutenticacion: authMiddleware,
  generarToken,
  verificarTokenValido,
  JWT_SECRET
};
