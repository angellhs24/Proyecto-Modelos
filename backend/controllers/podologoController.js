const db = require('../config/db');

// Obtener todos los podólogos
const obtenerPodologos = async (req, res) => {
  try {
    const resultado = await db.query(
      `SELECT Cedula_podologo, Nombre, ape_paterno, ape_materno, 
              TRIM(CONCAT(Nombre, ' ', ape_paterno, ' ', COALESCE(ape_materno, ''))) AS nombre_completo,
              Telefono_pod, Email 
       FROM Podologos 
       ORDER BY Nombre ASC`
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener podólogos:', error);
    res.status(500).json({ error: 'Error al obtener los podólogos' });
  }
};

// Obtener un podólogo por Cédula
const obtenerPodologoPorCedula = async (req, res) => {
  const { cedula } = req.params;
  try {
    const resultado = await db.query(
      `SELECT Cedula_podologo, Nombre, ape_paterno, ape_materno, 
              TRIM(CONCAT(Nombre, ' ', ape_paterno, ' ', COALESCE(ape_materno, ''))) AS nombre_completo,
              Telefono_pod, Email 
       FROM Podologos 
       WHERE Cedula_podologo = ?`,
      [cedula]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Podólogo no encontrado' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al obtener podólogo:', error);
    res.status(500).json({ error: 'Error al obtener el podólogo' });
  }
};

// Autenticación de podólogo (Login)
const loginPodologo = async (req, res) => {
  const { email, password, usuario } = req.body;
  const loginTerm = email || usuario;

  if (!loginTerm || !password) {
    return res.status(400).json({ error: 'Usuario/Email y contraseña requeridos' });
  }

  try {
    const resultado = await db.query(
      `SELECT Cedula_podologo, Nombre, ape_paterno, ape_materno, 
              TRIM(CONCAT(Nombre, ' ', ape_paterno, ' ', COALESCE(ape_materno, ''))) AS nombre_completo,
              Telefono_pod, Email, Password_hash 
       FROM Podologos 
       WHERE Email = ? OR Cedula_podologo = ? OR Nombre LIKE ?`,
      [loginTerm, loginTerm, `%${loginTerm}%`]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const podologo = resultado.rows[0];

    // Verificación de contraseña (compatible con texto plano del DML o hash)
    if (podologo.Password_hash !== password) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    const { Password_hash, ...podologoPublic } = podologo;

    res.json({
      mensaje: 'Inicio de sesión exitoso',
      podologo: podologoPublic
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error durante la autenticación' });
  }
};

// Registro de podólogo
const registrarPodologo = async (req, res) => {
  const {
    Cedula_podologo,
    Nombre,
    ape_paterno,
    ape_materno,
    Telefono_pod,
    Email,
    Password_hash,
    password
  } = req.body;

  const passwordFinal = Password_hash || password;

  if (!Cedula_podologo || !Nombre || !ape_paterno || !passwordFinal) {
    return res.status(400).json({ error: 'Cédula, nombre, apellido paterno y contraseña son obligatorios' });
  }

  try {
    await db.query(
      `INSERT INTO Podologos (Cedula_podologo, Nombre, ape_paterno, ape_materno, Telefono_pod, Email, Password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        Cedula_podologo,
        Nombre,
        ape_paterno,
        ape_materno || null,
        Telefono_pod || null,
        Email || null,
        passwordFinal
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
        Email
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
  registrarPodologo
};
