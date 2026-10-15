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
    let usuario = null;

    try {
      const [usuarios] = await db.pool.query(
        `SELECT u.Usuario_id, u.fk_rol_id, u.email, u.password_hash, u.activo, r.nombre_rol
         FROM Usuarios u
         JOIN Roles r ON u.fk_rol_id = r.Rol_id
         WHERE u.email = ?`,
        [email.trim().toLowerCase()]
      );
      if (usuarios && usuarios.length > 0) {
        usuario = usuarios[0];
      }
    } catch (dbErr) {
      // Tabla Usuarios o Roles no existe en MySQL, usar fallback
      console.warn('Advertencia DB (login):', dbErr.message);
    }

    const emailTrim = email.trim().toLowerCase();

    // Si no se encontró en Usuarios, verificar credenciales del sistema / demo
    if (!usuario) {
      if (emailTrim === 'admin@elitefoot.com' || emailTrim === 'admin@clinica.mx' || emailTrim === 'admin') {
        if (password === 'admin123' || password === 'hash_simulado_admin123' || password === 'admin1234') {
          usuario = {
            Usuario_id: 1,
            fk_rol_id: 1,
            email: 'admin@elitefoot.com',
            activo: 1,
            nombre_rol: 'Administrador'
          };
        } else {
          return res.status(401).json({ error: 'Contraseña de administrador incorrecta' });
        }
      } else if (emailTrim === 'recepcion@elitefoot.com' || emailTrim === 'recepcion@clinica.mx') {
        if (password === 'recep123' || password === 'hash_simulado_recep123' || password === 'recep1234') {
          usuario = {
            Usuario_id: 2,
            fk_rol_id: 3,
            email: 'recepcion@elitefoot.com',
            activo: 1,
            nombre_rol: 'Recepcionista'
          };
        } else {
          return res.status(401).json({ error: 'Contraseña de recepción incorrecta' });
        }
      } else if (emailTrim === 'dr.perez@elitefoot.com' || emailTrim === 'demo@clinica.mx') {
        if (password === 'podo123' || password === 'hash_simulado_podo123' || password === 'demo1234') {
          usuario = {
            Usuario_id: 3,
            fk_rol_id: 4,
            email: 'dr.perez@elitefoot.com',
            activo: 1,
            nombre_rol: 'Podólogo'
          };
        } else {
          return res.status(401).json({ error: 'Contraseña de podólogo incorrecta' });
        }
      } else {
        // Buscar directamente en tabla Podologos de MySQL
        try {
          const [podos] = await db.pool.query(
            `SELECT Cedula_podologo, Nombre, ape_paterno, ape_materno, Telefono_pod, Email, Password_hash 
             FROM Podologos 
             WHERE Email = ? OR Cedula_podologo = ?`,
            [emailTrim, email.trim()]
          );
          if (podos && podos.length > 0) {
            const p = podos[0];
            const pPass = p.Password_hash || 'podo123';
            if (password === pPass || (pPass === 'hash_simulado_podo123' && password === 'podo123')) {
              usuario = {
                Usuario_id: 4,
                fk_rol_id: 4,
                email: p.Email,
                activo: 1,
                nombre_rol: 'Podólogo'
              };
            } else {
              return res.status(401).json({ error: 'Contraseña incorrecta' });
            }
          }
        } catch (podoErr) {
          console.warn('Error al consultar Podologos:', podoErr.message);
        }
      }
    }

    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas: usuario o correo no registrado' });
    }

    if (!usuario.activo) {
      return res.status(403).json({ error: 'La cuenta se encuentra inactiva. Contacte al Administrador.' });
    }

    // Datos adicionales del perfil según el rol
    let perfil = {};

    if (usuario.fk_rol_id === 1) {
      perfil = {
        Nombre: 'Lic. Roberto',
        ape_paterno: 'Méndez',
        cargo: 'Administrador General del Sistema',
        clinica_nombre: 'Central de Operaciones Elite Foot Care'
      };
    } else if (usuario.fk_rol_id === 3) {
      try {
        const [recs] = await db.pool.query(
          `SELECT r.Recepcionista_id, r.fk_clinica_id, r.Nombre, r.ape_paterno, r.Telefono, c.Nombre AS clinica_nombre
           FROM Recepcionistas r
           JOIN Clinicas c ON r.fk_clinica_id = c.Clinica_id
           WHERE r.fk_usuario_id = ?`,
          [usuario.Usuario_id]
        );
        if (recs && recs.length > 0) perfil = recs[0];
        else {
          perfil = { Recepcionista_id: 1, fk_clinica_id: 14, Nombre: 'María', ape_paterno: 'López', Telefono: '5544332211', clinica_nombre: 'DIF Lomas de Tecámac' };
        }
      } catch {
        perfil = { Recepcionista_id: 1, fk_clinica_id: 14, Nombre: 'María', ape_paterno: 'López', Telefono: '5544332211', clinica_nombre: 'DIF Lomas de Tecámac' };
      }
    } else if (usuario.fk_rol_id === 4) {
      try {
        const [podos] = await db.pool.query(
          `SELECT Cedula_podologo, Nombre, ape_paterno, ape_materno, Telefono_pod
           FROM Podologos
           WHERE Email = ? OR Cedula_podologo = ? LIMIT 1`,
          [usuario.email, email.trim()]
        );
        if (podos && podos.length > 0) perfil = podos[0];
        else {
          perfil = { Cedula_podologo: 'CED12345678', Nombre: 'Carlos', ape_paterno: 'Pérez', Telefono_pod: '5511223344' };
        }
      } catch {
        perfil = { Cedula_podologo: 'CED12345678', Nombre: 'Carlos', ape_paterno: 'Pérez', Telefono_pod: '5511223344' };
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
