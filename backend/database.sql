-- =====================================================================
-- Ecosistema de Gestión Podológica Clínica
-- Base de Datos: Clinica_Podologia
-- Motor: MySQL 8.x / MariaDB
-- =====================================================================

DROP DATABASE IF EXISTS Clinica_Podologia;
CREATE DATABASE IF NOT EXISTS Clinica_Podologia 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;
USE Clinica_Podologia;

-- -------------------------------------------------------------
-- 1. CATÁLOGOS Y SEGURIDAD (RBAC)
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Roles (
    Rol_id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE 
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Usuarios (
    Usuario_id INT AUTO_INCREMENT PRIMARY KEY,
    fk_rol_id INT NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    activo BOOL DEFAULT TRUE,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuarios_roles 
        FOREIGN KEY (fk_rol_id) REFERENCES Roles(Rol_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 2. INFRAESTRUCTURA Y PERSONAL
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Clinicas (
    Clinica_id INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Calle_clinica VARCHAR(150),
    Municipio_clinica VARCHAR(100),
    Telefono VARCHAR(20),
    Activa BOOL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Pacientes (
    No_expediente BIGINT PRIMARY KEY,
    fk_usuario_id INT UNIQUE, 
    Nombres VARCHAR(100) NOT NULL,
    ape_paterno VARCHAR(50) NOT NULL,
    ape_materno VARCHAR(50),
    telefono VARCHAR(20),
    Fecha_nacimiento DATE,
    Sexo CHAR(1),
    Calzado DECIMAL(4,1),
    Calle_direccion VARCHAR(150),
    Municipio VARCHAR(100),
    Ocupacion VARCHAR(100),
    es_diabetico BOOL DEFAULT FALSE,
    es_hipertenso BOOL DEFAULT FALSE,
    Antecedentes_patologicos TEXT,
    Notas TEXT,
    Fecha_registro DATE,
    CONSTRAINT fk_pacientes_usuarios
        FOREIGN KEY (fk_usuario_id) REFERENCES Usuarios(Usuario_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Podologos (
    Cedula_podologo VARCHAR(50) PRIMARY KEY,
    fk_usuario_id INT UNIQUE NOT NULL,
    Nombre VARCHAR(100) NOT NULL,
    ape_paterno VARCHAR(50) NOT NULL,
    ape_materno VARCHAR(50),
    Telefono_pod VARCHAR(20),
    CONSTRAINT fk_podologos_usuarios
        FOREIGN KEY (fk_usuario_id) REFERENCES Usuarios(Usuario_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Recepcionistas (
    Recepcionista_id INT AUTO_INCREMENT PRIMARY KEY,
    fk_usuario_id INT UNIQUE NOT NULL,
    fk_clinica_id INT NOT NULL,
    Nombre VARCHAR(100) NOT NULL,
    ape_paterno VARCHAR(50) NOT NULL,
    Telefono VARCHAR(20),
    CONSTRAINT fk_recepcionistas_usuarios
        FOREIGN KEY (fk_usuario_id) REFERENCES Usuarios(Usuario_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_recepcionistas_clinicas
        FOREIGN KEY (fk_clinica_id) REFERENCES Clinicas(Clinica_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 3. EXPEDIENTE CLÍNICO Y CONSULTAS
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Consultas (
    Consulta_id VARCHAR(50) PRIMARY KEY,
    fk_no_expediente BIGINT NOT NULL,
    fk_clinica_id INT NOT NULL,
    fk_cedula_podologo VARCHAR(50) NOT NULL,
    fecha_hora DATETIME NOT NULL,
    estado VARCHAR(30) NOT NULL,
    motivo_o_notas TEXT,
    Peso DECIMAL(5,2),
    Altura DECIMAL(3,2),
    tipo_pisada VARCHAR(50),
    alineacion VARCHAR(50),
    observaciones TEXT,
    CONSTRAINT fk_consultas_pacientes 
        FOREIGN KEY (fk_no_expediente) REFERENCES Pacientes(No_expediente)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_consultas_clinicas 
        FOREIGN KEY (fk_clinica_id) REFERENCES Clinicas(Clinica_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_consultas_podologos 
        FOREIGN KEY (fk_cedula_podologo) REFERENCES Podologos(Cedula_podologo)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Diagnosticos (
    Diagnostico_id VARCHAR(50) PRIMARY KEY,
    fk_consulta_id VARCHAR(50) NOT NULL,
    padecimiento VARCHAR(100) NOT NULL,
    pie_izquierdo BOOL DEFAULT FALSE,
    pie_derecho BOOL DEFAULT FALSE,
    tipo_diagnostico VARCHAR(50),
    detalles_adicionales TEXT,
    CONSTRAINT fk_diagnosticos_consultas 
        FOREIGN KEY (fk_consulta_id) REFERENCES Consultas(Consulta_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Tratamientos (
    Tratamiento_id VARCHAR(50) PRIMARY KEY,
    fk_consulta_id VARCHAR(50) NOT NULL,
    procedimiento_servicio VARCHAR(100) NOT NULL,
    pie_izquierdo BOOL DEFAULT FALSE,
    pie_derecho BOOL DEFAULT FALSE,
    tratamiento_aplicado TEXT,
    fecha_inicio DATE,
    fecha_fin DATE,
    frecuencia VARCHAR(100),
    CONSTRAINT fk_tratamientos_consultas 
        FOREIGN KEY (fk_consulta_id) REFERENCES Consultas(Consulta_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Documentos_escaneados (
    Documento_id VARCHAR(50) PRIMARY KEY,
    fk_consulta_id VARCHAR(50) NOT NULL,
    tipo_documento VARCHAR(50),
    url_archivo VARCHAR(255) NOT NULL,
    fecha_subida DATE NOT NULL,
    CONSTRAINT fk_documentos_consultas 
        FOREIGN KEY (fk_consulta_id) REFERENCES Consultas(Consulta_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Recetas (
    Receta_id VARCHAR(50) PRIMARY KEY,
    fk_consulta_id VARCHAR(50) NOT NULL,
    fk_paciente_id BIGINT NOT NULL,
    indicaciones_generales TEXT,
    fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_recetas_consultas
        FOREIGN KEY (fk_consulta_id) REFERENCES Consultas(Consulta_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_recetas_pacientes
        FOREIGN KEY (fk_paciente_id) REFERENCES Pacientes(No_expediente)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Detalles_Receta (
    Detalle_id INT AUTO_INCREMENT PRIMARY KEY,
    fk_receta_id VARCHAR(50) NOT NULL,
    medicamento VARCHAR(150) NOT NULL,
    dosis VARCHAR(50) NOT NULL,
    via_administracion VARCHAR(50) DEFAULT 'Tópica',
    frecuencia VARCHAR(50) DEFAULT 'Cada 12 horas',
    duracion VARCHAR(50) DEFAULT '7 días',
    CONSTRAINT fk_detalles_receta
        FOREIGN KEY (fk_receta_id) REFERENCES Recetas(Receta_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 4. INVENTARIO, PAGOS Y MAPAS PODOLÓGICOS
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Inventario (
    Articulo_id INT AUTO_INCREMENT PRIMARY KEY,
    fk_clinica_id INT NOT NULL,
    nombre_articulo VARCHAR(100) NOT NULL,
    categoria VARCHAR(50),
    cantidad_stock INT DEFAULT 0,
    unidad_medida VARCHAR(20),
    stock_minimo INT DEFAULT 5,
    ultima_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_inventario_clinicas
        FOREIGN KEY (fk_clinica_id) REFERENCES Clinicas(Clinica_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Pagos (
    Pago_id VARCHAR(50) PRIMARY KEY,
    fk_consulta_id VARCHAR(50) NOT NULL,
    fk_recepcionista_id INT, 
    monto DECIMAL(10,2) NOT NULL,
    metodo_pago VARCHAR(50),
    estado_pago VARCHAR(20) DEFAULT 'Pendiente',
    fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pagos_consultas
        FOREIGN KEY (fk_consulta_id) REFERENCES Consultas(Consulta_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_pagos_recepcionistas
        FOREIGN KEY (fk_recepcionista_id) REFERENCES Recepcionistas(Recepcionista_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Detalles_Mapa_Podologico (
    Mapa_id INT AUTO_INCREMENT PRIMARY KEY,
    fk_consulta_id VARCHAR(50) NOT NULL,
    zona_pie VARCHAR(50) NOT NULL, 
    tipo_lesion VARCHAR(100) NOT NULL, 
    observaciones TEXT,
    CONSTRAINT fk_mapa_consultas
        FOREIGN KEY (fk_consulta_id) REFERENCES Consultas(Consulta_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 5. AUDITORÍA Y SEGURIDAD
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Bitacora_Auditoria (
    Log_id INT AUTO_INCREMENT PRIMARY KEY,
    fk_usuario_id INT NOT NULL, 
    accion_realizada VARCHAR(255) NOT NULL, 
    tabla_afectada VARCHAR(50),
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    direccion_ip VARCHAR(45),
    CONSTRAINT fk_bitacora_usuarios
        FOREIGN KEY (fk_usuario_id) REFERENCES Usuarios(Usuario_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 6. DATOS SEMILLA (SEED DATA)
-- -------------------------------------------------------------

INSERT INTO Roles (nombre_rol) VALUES 
('Admin'), 
('Cliente'), 
('Recepcionista'), 
('Podologo');

INSERT INTO Usuarios (fk_rol_id, email, password_hash) VALUES 
(1, 'admin@elitefoot.com', 'hash_simulado_admin123'),
(2, 'cliente_juan@gmail.com', 'hash_simulado_cliente123'),
(3, 'recepcion@elitefoot.com', 'hash_simulado_recep123'),
(4, 'dr.perez@elitefoot.com', 'hash_simulado_podo123');

INSERT INTO Clinicas (Nombre, Calle_clinica, Municipio_clinica, Telefono) VALUES 
('Elite Foot Care - Sucursal Centro', 'Av. Principal 123', 'Ecatepec', '5512345678');

INSERT INTO Recepcionistas (fk_usuario_id, fk_clinica_id, Nombre, ape_paterno, Telefono) VALUES 
(3, 1, 'María', 'López', '5587654321');

INSERT INTO Podologos (Cedula_podologo, fk_usuario_id, Nombre, ape_paterno, ape_materno, Telefono_pod) VALUES 
('CED12345678', 4, 'Carlos', 'Pérez', 'García', '5599887766');

INSERT INTO Pacientes (No_expediente, fk_usuario_id, Nombres, ape_paterno, ape_materno, Fecha_nacimiento, Sexo, Fecha_registro) VALUES 
(2026101101, 2, 'Juan', 'Martínez', 'Hernández', '1985-05-15', 'M', CURDATE());

INSERT INTO Consultas (Consulta_id, fk_no_expediente, fk_clinica_id, fk_cedula_podologo, fecha_hora, estado, motivo_o_notas) VALUES 
('CNS-001', 2026101101, 1, 'CED12345678', '2026-10-15 10:00:00', 'Programada', 'Dolor en uña del pie derecho');
