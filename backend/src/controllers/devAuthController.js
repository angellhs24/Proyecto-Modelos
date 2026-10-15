const db = require('../config/db');
const { generarToken } = require('../middlewares/authMiddleware');

/**
 * Controlador de Autenticación de Desarrollo (Dev Login Temporal)
 * Emite tokens JWT válidos para pruebas con Usuario ID: 3 (Recepcionista) o Usuario ID: 4 (Podólogo).
 */
async function devLogin(req, res) {
  try {
    const usuarioId = parseInt(req.body.usuarioId || req.query.usuarioId, 10);
    const rol = (req.body.rol || req.query.rol || '').toLowerCase();

    let targetId = usuarioId;
    if (!targetId) {
      if (rol.includes('recep')) targetId = 3;
      else if (rol.includes('podo') || rol.includes('medico')) targetId = 4;
      else targetId = 3;
    }

    if (targetId !== 3 && targetId !== 4) {
      return res.status(400).json({
        ok: false,
        error: 'ID de usuario no permitido para Dev Login. Use 3 (Recepcionista) o 4 (Podólogo).'
      });
    }

    let usuario = null;
    let perfil = {};

    try {
      const [usuarios] = await db.pool.query(
        `SELECT u.Usuario_id, u.fk_rol_id, u.email, u.activo, r.nombre_rol
         FROM Usuarios u
         JOIN Roles r ON u.fk_rol_id = r.Rol_id
         WHERE u.Usuario_id = ?`,
        [targetId]
      );

      if (usuarios && usuarios.length > 0) {
        usuario = usuarios[0];

        if (targetId === 3) {
          const [recs] = await db.pool.query(
            `SELECT r.Recepcionista_id, r.fk_clinica_id, r.Nombre, r.ape_paterno, r.Telefono, c.Nombre AS clinica_nombre
             FROM Recepcionistas r
             JOIN Clinicas c ON r.fk_clinica_id = c.Clinica_id
             WHERE r.fk_usuario_id = ?`,
            [targetId]
          );
          if (recs.length > 0) perfil = recs[0];
        } else if (targetId === 4) {
          const [podos] = await db.pool.query(
            `SELECT Cedula_podologo, Nombre, ape_paterno, ape_materno, Telefono_pod
             FROM Podologos
             WHERE fk_usuario_id = ?`,
            [targetId]
          );
          if (podos.length > 0) perfil = podos[0];
        }
      }
    } catch (dbErr) {
      console.warn('Advertencia DB en devLogin:', dbErr.message);
    }

    // Fallback estático con datos del DDL
    if (!usuario) {
      if (targetId === 3) {
        usuario = {
          Usuario_id: 3,
          fk_rol_id: 3,
          email: 'recepcion@elitefoot.com',
          activo: 1,
          nombre_rol: 'Recepcionista'
        };
        perfil = {
          Recepcionista_id: 1,
          fk_clinica_id: 1,
          Nombre: 'María',
          ape_paterno: 'López',
          Telefono: '5587654321',
          clinica_nombre: 'Elite Foot Care - Sucursal Centro'
        };
      } else {
        usuario = {
          Usuario_id: 4,
          fk_rol_id: 4,
          email: 'dr.perez@elitefoot.com',
          activo: 1,
          nombre_rol: 'Podologo'
        };
        perfil = {
          Cedula_podologo: 'CED12345678',
          Nombre: 'Carlos',
          ape_paterno: 'Pérez',
          ape_materno: 'García',
          Telefono_pod: '5599887766'
        };
      }
    }

    const token = generarToken(usuario);
    const redirectUrl = targetId === 3 ? '/recepcion.html' : '/consultorio.html';

    const usuarioRespuesta = {
      id: usuario.Usuario_id,
      Usuario_id: usuario.Usuario_id,
      email: usuario.email,
      fk_rol_id: usuario.fk_rol_id,
      rol: usuario.nombre_rol,
      nombre: perfil.Nombre ? `${perfil.Nombre} ${perfil.ape_paterno || ''}`.trim() : usuario.nombre_rol,
      perfil
    };

    return res.json({
      ok: true,
      mensaje: `Sesión de desarrollo simulada exitosamente para ${usuario.nombre_rol}`,
      token,
      usuario: usuarioRespuesta,
      redirectUrl
    });
  } catch (error) {
    console.error('Error en devLogin:', error);
    return res.status(500).json({ ok: false, error: 'Error interno en devLogin' });
  }
}

module.exports = {
  devLogin
};
