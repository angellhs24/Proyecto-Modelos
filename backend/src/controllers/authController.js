const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const mailer = require('../utils/mailer');
const { generarToken, verificarAutenticacion } = require('../middlewares/authMiddleware');

// Almacén seguro en memoria para tokens y códigos temporales de recuperación (15 min)
const tokensRecuperacion = new Map();

// Limpieza automática periódica de tokens expirados cada 10 minutos
setInterval(() => {
  const ahora = Date.now();
  for (const [token, datos] of tokensRecuperacion.entries()) {
    if (ahora > datos.expiraEn) {
      tokensRecuperacion.delete(token);
    }
  }
}, 10 * 60 * 1000);

/**
 * Compara una contraseña con soporte de:
 * 1. Hashes seguros Bcrypt ($2b$, $2a$)
 * 2. Compatibilidad con credenciales/hashes del DDL
 */
async function verificarPassword(passwordIngresado, passDb) {
  if (!passwordIngresado || !passDb) return false;

  if (passDb.startsWith('$2a$') || passDb.startsWith('$2b$') || passDb.startsWith('$2y$')) {
    try {
      return await bcrypt.compare(passwordIngresado, passDb);
    } catch {
      return false;
    }
  }

  return (passwordIngresado === passDb) ||
    (passDb === 'hash_simulado_admin123' && (passwordIngresado === 'admin123' || passwordIngresado === 'admin1234' || passwordIngresado === 'hash_simulado_admin123')) ||
    (passDb === 'hash_simulado_recep123' && (passwordIngresado === 'recep123' || passwordIngresado === 'recep1234' || passwordIngresado === 'hash_simulado_recep123')) ||
    (passDb === 'hash_simulado_podo123' && (passwordIngresado === 'podo123' || passwordIngresado === 'podo1234' || passwordIngresado === 'hash_simulado_podo123'));
}

/**
 * Iniciar sesión (Login)
 * Cifra/compara contraseñas con Bcrypt y emite cookies HttpOnly seguras
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
        const u = usuarios[0];
        const passDb = u.password_hash || '';
        
        const passwordValido = await verificarPassword(password, passDb);

        if (!passwordValido) {
          return res.status(401).json({ error: 'Credenciales inválidas: contraseña incorrecta' });
        }
        usuario = u;
      }
    } catch (dbErr) {
      // Tabla Usuarios o Roles no existe en MySQL, usar fallback
      console.warn('Advertencia DB (login):', dbErr.message);
    }

    const emailTrim = email.trim().toLowerCase();

    // Si no se encontró en Usuarios, verificar credenciales del sistema / demo
    if (!usuario) {
      if (emailTrim === 'admin@elitefoot.com' || emailTrim === 'admin@clinica.mx' || emailTrim === 'admin' || emailTrim === 'luisangelhs2610@gmail.com') {
        const passOk = await verificarPassword(password, '$2b$10$YjlmCDgtzjzk5VV/6d2fWO5osu902un9Vf16HSyqDVRcjTr1KVsw6') || password === 'admin1234' || password === 'admin123';
        if (passOk) {
          usuario = {
            Usuario_id: 1001,
            fk_rol_id: 1,
            rolId: 1,
            codigo_rol: 100,
            email: emailTrim,
            activo: 1,
            nombre_rol: 'Administrador'
          };
        } else {
          return res.status(401).json({ error: 'Contraseña de administrador incorrecta' });
        }
      } else if (emailTrim === 'recepcion@elitefoot.com' || emailTrim === 'recepcion@clinica.mx' || emailTrim === 'luiscudu59@gmail.com' || emailTrim === 'camilavazquezvelazquez@gmail.com' || emailTrim === 'sebastian@elitefoot.com') {
        let expectedPass = 'recep14';
        if (emailTrim === 'camilavazquezvelazquez@gmail.com') expectedPass = 'recep28';
        if (emailTrim === 'sebastian@elitefoot.com') expectedPass = 'recep35';
        if (emailTrim.includes('recepcion@')) expectedPass = 'recep123';

        if (password === expectedPass || password === 'recep1234' || password === 'hash_simulado_recep123' || await verificarPassword(password, '$2b$10$JBndqei0Jp6cEqNwtF6w/.WL4L7W6e95KsvoD.zExScW1RIBx1phC')) {
          usuario = {
            Usuario_id: 9001,
            fk_rol_id: 3,
            rolId: 3,
            codigo_rol: 300,
            email: emailTrim,
            activo: 1,
            nombre_rol: 'Recepcionista'
          };
        } else {
          return res.status(401).json({ error: 'Contraseña de recepción incorrecta' });
        }
      } else if (emailTrim === 'maribelbonita@gmail.com' || emailTrim === 'hernandezsantillanluisangel@gmail.com' || emailTrim === 'kiarapink27@gmail.com' || emailTrim === 'dr.perez@elitefoot.com' || emailTrim === 'demo@clinica.mx') {
        let expectedPass = 'podo123';
        if (emailTrim === 'maribelbonita@gmail.com') expectedPass = 'bonita1234';
        if (emailTrim === 'hernandezsantillanluisangel@gmail.com') expectedPass = 'angel1234';
        if (emailTrim === 'kiarapink27@gmail.com') expectedPass = 'kyara1234';

        if (password === expectedPass || password === 'podo123' || password === 'demo1234' || await verificarPassword(password, '$2b$10$m047FFP8P7t8eO84U8Mu2utuRicU/6/HMizZ.3gPbG.6yXlXvF2Ce')) {
          usuario = {
            Usuario_id: 8001,
            fk_rol_id: 4,
            rolId: 4,
            codigo_rol: 400,
            email: emailTrim,
            activo: 1,
            nombre_rol: 'Podólogo'
          };
        } else {
          return res.status(401).json({ error: 'Contraseña de especialista podólogo incorrecta' });
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
                fk_rol_id: 400,
                email: p.Email,
                activo: 1,
                nombre_rol: 'Especialista_Podologo'
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

    // Datos adicionales del perfil según el rol (1/100 Admin, 3/300 Recepción, 4/400 Podólogo)
    let perfil = {};

    const esAdmin = usuario.fk_rol_id === 1 || usuario.fk_rol_id === 100 || (usuario.nombre_rol && usuario.nombre_rol.toLowerCase().includes('admin'));
    const esRecep = usuario.fk_rol_id === 3 || usuario.fk_rol_id === 300 || (usuario.nombre_rol && usuario.nombre_rol.toLowerCase().includes('recep'));
    const esPodo = usuario.fk_rol_id === 4 || usuario.fk_rol_id === 400 || (usuario.nombre_rol && (usuario.nombre_rol.toLowerCase().includes('pod') || usuario.nombre_rol.toLowerCase().includes('especialista')));

    if (esAdmin) {
      perfil = {
        Nombre: 'Lic. Luis Angel',
        ape_paterno: 'Hernández',
        cargo: 'Administrador General del Sistema',
        clinica_nombre: 'Central de Operaciones Elite Foot Care'
      };
    } else if (esRecep) {
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
          perfil = { Recepcionista_id: 'REC-14-001', fk_clinica_id: 14, Nombre: 'Luis Abelardo', ape_paterno: 'Cuellar', Telefono: '5635333422', clinica_nombre: 'DIF Lomas de Tecámac' };
        }
      } catch {
        perfil = { Recepcionista_id: 'REC-14-001', fk_clinica_id: 14, Nombre: 'Luis Abelardo', ape_paterno: 'Cuellar', Telefono: '5635333422', clinica_nombre: 'DIF Lomas de Tecámac' };
      }
    } else if (esPodo) {
      try {
        const [podos] = await db.pool.query(
          `SELECT Cedula_podologo, Nombre, ape_paterno, ape_materno, Telefono_pod
           FROM Podologos
           WHERE Email = ? OR Cedula_podologo = ? OR fk_usuario_id = ? LIMIT 1`,
          [usuario.email, email.trim(), usuario.Usuario_id]
        );
        if (podos && podos.length > 0) perfil = podos[0];
        else {
          perfil = { Cedula_podologo: 'A-54906', Nombre: 'Maribel Benita', ape_paterno: 'Santillan', Telefono_pod: '5515311359' };
        }
      } catch {
        perfil = { Cedula_podologo: 'A-54906', Nombre: 'Maribel Benita', ape_paterno: 'Santillan', Telefono_pod: '5515311359' };
      }
    }

    const token = generarToken(usuario);

    // Incrustar el token JWT en una cookie HttpOnly, Secure y SameSite=Strict
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
      path: '/'
    });

    const rolNorm = (usuario.fk_rol_id === 100) ? 1 : (usuario.fk_rol_id === 300) ? 3 : (usuario.fk_rol_id === 400) ? 4 : usuario.fk_rol_id;

    res.json({
      mensaje: 'Inicio de sesión exitoso',
      token, // Mantenido para clientes API y suites de pruebas automatizadas
      usuario: {
        id: usuario.Usuario_id,
        Usuario_id: usuario.Usuario_id,
        email: usuario.email,
        fk_rol_id: rolNorm,
        rolId: rolNorm,
        codigo_rol: usuario.fk_rol_id,
        rol: usuario.nombre_rol,
        nombre_rol: usuario.nombre_rol,
        perfil
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno en el servidor durante autenticación' });
  }
}

/**
 * Cierre de sesión (Logout): Destruye la cookie de sesión HttpOnly
 */
async function logout(req, res) {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    path: '/'
  });
  return res.json({ ok: true, mensaje: 'Sesión finalizada exitosamente. Cookie destruida.' });
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

/**
 * Solicitar código de recuperación de contraseña (6 dígitos + Token criptográfico)
 */
async function recuperarPassword(req, res) {
  const { email } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'El correo electrónico es obligatorio' });
  }

  const emailTrim = email.trim().toLowerCase();
  // Código criptográficamente seguro de 6 dígitos
  const codigo = String(crypto.randomInt(100000, 999999));
  // Token único para enlazar la sesión de recuperación
  const resetToken = crypto.randomBytes(32).toString('hex');

  try {
    let usuarioEncontrado = null;
    try {
      const [usuarios] = await db.pool.query(
        `SELECT u.Usuario_id, u.email, r.nombre_rol 
         FROM Usuarios u 
         JOIN Roles r ON u.fk_rol_id = r.Rol_id 
         WHERE LOWER(u.email) = ?`,
        [emailTrim]
      );
      if (usuarios && usuarios.length > 0) {
        usuarioEncontrado = usuarios[0];
      }
    } catch (dbErr) {
      console.warn('Advertencia DB al buscar usuario para recuperación:', dbErr.message);
    }

    // Lista de correos institucionales de fallback / demo
    const usuariosDemo = [
      'admin@elitefoot.com', 'luisangelhs2610@gmail.com', 'recepcion@elitefoot.com',
      'maribelbonita@gmail.com', 'hernandezsantillanluisangel@gmail.com', 'kiarapink27@gmail.com',
      'luiscudu59@gmail.com', 'camilavazquezvelazquez@gmail.com', 'sebastian@elitefoot.com',
      'dr.perez@elitefoot.com'
    ];

    if (!usuarioEncontrado && !usuariosDemo.includes(emailTrim)) {
      return res.status(404).json({
        error: 'No se encontró ninguna cuenta profesional asociada a este correo electrónico.'
      });
    }

    const nombreDestinatario = usuarioEncontrado ? usuarioEncontrado.nombre_rol : 'Profesional de la Salud';

    // Almacenar token en memoria con vigencia de 15 minutos
    tokensRecuperacion.set(resetToken, {
      email: emailTrim,
      codigo: codigo,
      usuarioId: usuarioEncontrado ? usuarioEncontrado.Usuario_id : null,
      expiraEn: Date.now() + 15 * 60 * 1000,
      intentos: 0,
      verificado: false
    });

    // Enviar correo (o simular en consola si SMTP no está configurado)
    const resultadoEnvio = await mailer.enviarCodigoRecuperacion(emailTrim, codigo, nombreDestinatario);

    return res.json({
      ok: true,
      mensaje: `Código de verificación de 6 dígitos emitido para ${emailTrim}.`,
      resetToken: resetToken,
      email: emailTrim,
      expiraEn: '15 minutos',
      simulado: resultadoEnvio.simulado || false,
      codigo_demo: resultadoEnvio.simulado ? codigo : undefined
    });
  } catch (err) {
    console.error('Error en recuperarPassword:', err);
    return res.status(500).json({ error: 'Error interno al procesar la solicitud de recuperación' });
  }
}

/**
 * Validar código de 6 dígitos ingresado por el usuario
 */
async function verificarCodigoRecuperacion(req, res) {
  const { email, resetToken, codigo } = req.body;

  if (!resetToken || !codigo) {
    return res.status(400).json({ error: 'El token de recuperación y el código de 6 dígitos son obligatorios' });
  }

  const record = tokensRecuperacion.get(resetToken);

  if (!record || Date.now() > record.expiraEn) {
    if (record) tokensRecuperacion.delete(resetToken);
    return res.status(400).json({ error: 'El código ha expirado o la sesión de recuperación es inválida. Solicita uno nuevo.' });
  }

  if (email && record.email !== email.trim().toLowerCase()) {
    return res.status(400).json({ error: 'El correo no coincide con la sesión de recuperación activa.' });
  }

  if (record.intentos >= 5) {
    tokensRecuperacion.delete(resetToken);
    return res.status(429).json({ error: 'Demasiados intentos fallidos. Por seguridad solicita un nuevo código.' });
  }

  if (record.codigo !== String(codigo).trim()) {
    record.intentos++;
    const restantes = 5 - record.intentos;
    return res.status(400).json({
      error: `Código de verificación incorrecto. Te quedan ${restantes} intento(s).`
    });
  }

  // Código validado exitosamente
  record.verificado = true;

  return res.json({
    ok: true,
    mensaje: 'Código de 6 dígitos verificado exitosamente. Ahora puedes establecer tu nueva contraseña.',
    resetToken: resetToken,
    email: record.email
  });
}

/**
 * Establecer nueva contraseña cifrada con Bcrypt (10 rondas)
 */
async function restablecerPassword(req, res) {
  const { resetToken, nuevaPassword, confirmarPassword } = req.body;

  if (!resetToken || !nuevaPassword) {
    return res.status(400).json({ error: 'Datos incompletos para actualizar la contraseña' });
  }

  if (confirmarPassword && nuevaPassword !== confirmarPassword) {
    return res.status(400).json({ error: 'Las contraseñas no coinciden' });
  }

  if (nuevaPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  const record = tokensRecuperacion.get(resetToken);

  if (!record || !record.verificado || Date.now() > record.expiraEn) {
    return res.status(400).json({ error: 'Sesión de recuperación no autorizada o expirada. Vuelve a iniciar el proceso.' });
  }

  try {
    // Hashear la nueva contraseña con Bcrypt y 10 rondas de salt
    const nuevoHash = await bcrypt.hash(nuevaPassword, 10);

    try {
      await db.pool.query(
        `UPDATE Usuarios SET password_hash = ? WHERE LOWER(email) = ?`,
        [nuevoHash, record.email]
      );
    } catch (dbErr) {
      console.warn('Advertencia DB al actualizar contraseña:', dbErr.message);
    }

    // Invalidar token de recuperación usado
    tokensRecuperacion.delete(resetToken);

    return res.json({
      ok: true,
      mensaje: '¡Contraseña actualizada exitosamente con cifrado seguro! Ya puedes iniciar sesión con tu nueva contraseña.'
    });
  } catch (err) {
    console.error('Error al restablecer contraseña:', err);
    return res.status(500).json({ error: 'Error al actualizar la contraseña en el servidor' });
  }
}

module.exports = {
  login,
  logout,
  obtenerPerfilActual,
  listarUsuariosDemostracion,
  recuperarPassword,
  verificarCodigoRecuperacion,
  restablecerPassword
};

