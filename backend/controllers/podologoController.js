const db = require('../config/db');
const medicoController = require('./medicoController');

// Obtener todos los podólogos
const obtenerPodologos = async (req, res) => {
  try {
    const [rows] = await db.pool.query(
      `SELECT Cedula_podologo, fk_usuario_id, Nombre, ape_paterno, ape_materno, 
              TRIM(CONCAT(Nombre, ' ', ape_paterno, ' ', COALESCE(ape_materno, ''))) AS nombre_completo,
              Telefono_pod 
       FROM Podologos 
       ORDER BY Nombre ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener podólogos:', error);
    res.status(500).json({ error: 'Error al obtener los podólogos' });
  }
};

// Obtener un podólogo por Cédula
const obtenerPodologoPorCedula = async (req, res) => {
  const { cedula } = req.params;
  try {
    const [rows] = await db.pool.query(
      `SELECT Cedula_podologo, fk_usuario_id, Nombre, ape_paterno, ape_materno, 
              TRIM(CONCAT(Nombre, ' ', ape_paterno, ' ', COALESCE(ape_materno, ''))) AS nombre_completo,
              Telefono_pod 
       FROM Podologos 
       WHERE Cedula_podologo = ?`,
      [cedula]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Podólogo no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener podólogo:', error);
    res.status(500).json({ error: 'Error al obtener el podólogo' });
  }
};

// Autenticación de podólogo (Compatible con Usuarios y Podólogos)
const loginPodologo = async (req, res) => {
  const { email, password, usuario } = req.body;
  const loginTerm = (email || usuario || '').trim();

  if (!loginTerm || !password) {
    return res.status(400).json({ error: 'Usuario/Email y contraseña requeridos' });
  }

  try {
    const [usuarios] = await db.pool.query(
      `SELECT u.Usuario_id, u.fk_rol_id, u.email, u.password_hash, u.activo,
              p.Cedula_podologo, p.Nombre, p.ape_paterno, p.ape_materno, p.Telefono_pod
       FROM Usuarios u
       JOIN Podologos p ON u.Usuario_id = p.fk_usuario_id
       WHERE u.email = ? OR p.Cedula_podologo = ? OR p.Nombre LIKE ?`,
      [loginTerm, loginTerm, `%${loginTerm}%`]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const podologoUser = usuarios[0];
    const passwordMatch =
      podologoUser.password_hash === password ||
      (podologoUser.password_hash === 'hash_simulado_podo123' && (password === 'podo123' || password === 'hash_simulado_podo123'));

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    const { password_hash, ...podologoPublic } = podologoUser;

    res.json({
      mensaje: 'Inicio de sesión exitoso',
      podologo: podologoPublic
    });
  } catch (error) {
    console.error('Error en login de podólogo:', error);
    res.status(500).json({ error: 'Error durante la autenticación' });
  }
};

// Registro de podólogo en Usuarios y Podologos
const registrarPodologo = async (req, res) => {
  const {
    Cedula_podologo,
    Nombre,
    ape_paterno,
    ape_materno,
    Telefono_pod,
    Email,
    email,
    Password_hash,
    password
  } = req.body;

  const emailFinal = (Email || email || '').trim().toLowerCase();
  const passwordFinal = Password_hash || password || 'hash_simulado_podo123';

  if (!Cedula_podologo || !Nombre || !ape_paterno || !emailFinal) {
    return res.status(400).json({ error: 'Cédula, nombre, apellido paterno y correo son obligatorios' });
  }

  try {
    // 1. Insertar en Usuarios (Rol 4 = Podólogo)
    const [uResult] = await db.pool.query(
      `INSERT INTO Usuarios (fk_rol_id, email, password_hash, activo) VALUES (4, ?, ?, TRUE)`,
      [emailFinal, passwordFinal]
    );

    // 2. Insertar en Podologos
    await db.pool.query(
      `INSERT INTO Podologos (Cedula_podologo, fk_usuario_id, Nombre, ape_paterno, ape_materno, Telefono_pod)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        Cedula_podologo,
        uResult.insertId,
        Nombre,
        ape_paterno,
        ape_materno || null,
        Telefono_pod || null
      ]
    );

    res.status(201).json({
      mensaje: 'Podólogo registrado con éxito',
      podologo: {
        Cedula_podologo,
        Nombre,
        ape_paterno,
        ape_materno,
        Telefono_pod,
        email: emailFinal
      }
    });
  } catch (error) {
    console.error('Error al registrar podólogo:', error);
    res.status(500).json({ error: 'Error al registrar el podólogo (cédula o email posiblemente duplicados)' });
  }
};

module.exports = {
  obtenerPodologos,
  obtenerPodologoPorCedula,
  loginPodologo,
  registrarPodologo,
  // Re-exportar todos los métodos de gestión médica del podólogo
  ...medicoController
};
