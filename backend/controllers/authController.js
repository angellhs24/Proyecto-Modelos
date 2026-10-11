const db = require('../config/db');
const { generarToken, verificarAutenticacion } = require('../middlewares/authMiddleware');

/**
 * Iniciar sesión (Login)
 * Compatible con email y password_hash (texto o hash del DDL)
 */
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }

  try {
    const [usuarios] = await db.pool.query(
      `SELECT u.Usuario_id, u.fk_rol_id, u.email, u.password_hash, u.activo, r.nombre_rol
       FROM Usuarios u
       JOIN Roles r ON u.fk_rol_id = r.Rol_id
       WHERE u.email = ?`,
      [email.trim().toLowerCase()]
    );

    if (!usuarios || usuarios.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas: correo no registrado' });
    }

    const usuario = usuarios[0];

    if (!usuario.activo) {
      return res.status(403).json({ error: 'La cuenta se encuentra inactiva. Contacte al Administrador.' });
    }

    // Validación de contraseña (compatible con hash simulado o contraseñas simples del DDL)
    const passwordCoincide =
      usuario.password_hash === password ||
      (usuario.password_hash === 'hash_simulado_recep123' && (password === 'recep123' || password === 'hash_simulado_recep123')) ||
      (usuario.password_hash === 'hash_simulado_podo123' && (password === 'podo123' || password === 'hash_simulado_podo123')) ||
      (usuario.password_hash === 'hash_simulado_admin123' && (password === 'admin123' || password === 'hash_simulado_admin123'));

    if (!passwordCoincide) {
      return res.status(401).json({ error: 'Credenciales inválidas: contraseña incorrecta' });
    }

    // Datos adicionales del perfil según el rol
    let perfil = {};

    if (usuario.fk_rol_id === 3) {
      const [recs] = await db.pool.query(
        `SELECT r.Recepcionista_id, r.fk_clinica_id, r.Nombre, r.ape_paterno, r.Telefono, c.Nombre AS clinica_nombre
         FROM Recepcionistas r
         JOIN Clinicas c ON r.fk_clinica_id = c.Clinica_id
         WHERE r.fk_usuario_id = ?`,
        [usuario.Usuario_id]
      );
      if (recs.length > 0) {
        perfil = recs[0];
      }
    } else if (usuario.fk_rol_id === 4) {
      const [podos] = await db.pool.query(
        `SELECT Cedula_podologo, Nombre, ape_paterno, ape_materno, Telefono_pod
         FROM Podologos
         WHERE fk_usuario_id = ?`,
        [usuario.Usuario_id]
      );
      if (podos.length > 0) {
        perfil = podos[0];
      }
    }

    const token = generarToken(usuario);

    res.json({
      mensaje: 'Inicio de sesión exitoso',
      token,
      usuario: {
        id: usuario.Usuario_id,
        Usuario_id: usuario.Usuario_id,
        email: usuario.email,
        fk_rol_id: usuario.fk_rol_id,
        rol: usuario.nombre_rol,
        perfil
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno en el servidor durante autenticación' });
  }
}

/**
 * Obtener perfil del usuario actualmente autenticado
 */
async function obtenerPerfilActual(req, res) {
  res.json({
    usuario: req.user
  });
}

/**
 * Listar cuentas de prueba disponibles para alternar roles en la UI
 */
async function listarUsuariosDemostracion(req, res) {
  try {
    const [usuarios] = await db.pool.query(
      `SELECT u.Usuario_id, u.email, u.fk_rol_id, r.nombre_rol,
              CASE
                WHEN u.fk_rol_id = 3 THEN (SELECT CONCAT(Nombre, ' ', ape_paterno) FROM Recepcionistas WHERE fk_usuario_id = u.Usuario_id)
                WHEN u.fk_rol_id = 4 THEN (SELECT CONCAT(Nombre, ' ', ape_paterno) FROM Podologos WHERE fk_usuario_id = u.Usuario_id)
                ELSE 'Administrador'
              END AS nombre_completo,
              CASE
                WHEN u.fk_rol_id = 3 THEN (SELECT Recepcionista_id FROM Recepcionistas WHERE fk_usuario_id = u.Usuario_id)
                ELSE NULL
              END AS recepcionista_id,
              CASE
                WHEN u.fk_rol_id = 4 THEN (SELECT Cedula_podologo FROM Podologos WHERE fk_usuario_id = u.Usuario_id)
                ELSE NULL
              END AS cedula_podologo
       FROM Usuarios u
       JOIN Roles r ON u.fk_rol_id = r.Rol_id
       WHERE u.activo = TRUE
       ORDER BY u.fk_rol_id ASC`
    );

    res.json(usuarios);
  } catch (error) {
    console.error('Error al listar demo usuarios:', error);
    res.status(500).json({ error: 'Error al listar usuarios de prueba' });
  }
}

module.exports = {
  login,
  obtenerPerfilActual,
  listarUsuariosDemostracion
};
