# Ecosistema de Gestion Podologica Clinica

Sistema integral de gestion clinica multi-sede y atencion podologica boutique, disenado para optimizar el flujo de trabajo en consultorio, el agendamiento rapido de citas, el registro de consultas clinicas especializadas y el seguimiento de pacientes con condiciones de alto riesgo.

---

## Tabla de Contenidos

1. [Vision General del Proyecto](#vision-general-del-proyecto)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Stack Tecnologico](#stack-tecnologico)
4. [Modulos Funcionales](#modulos-funcionales)
5. [Estructura del Repositorio](#estructura-del-repositorio)
6. [Modelo de Datos y Base de Datos](#modelo-de-datos-y-base-de-datos)
7. [Referencia de la API REST](#referencia-de-la-api-rest)
8. [Instalacion y Puesta en Marcha](#instalacion-y-puesta-en-marcha)
9. [Variables de Entorno](#variables-de-entorno)
10. [Flujos de Trabajo Principales](#flujos-de-trabajo-principales)
11. [Guia de Buenas Practicas y Mantenimiento](#guia-de-buenas-practicas-y-mantenimiento)

---

## Vision General del Proyecto

Este proyecto surge como respuesta a la necesidad de centralizar, agilizar y modernizar la operacion podologica de especialistas que prestan servicio en diferentes sedes e instituciones clinicas (como clinicas DIF, casas de dia y consultorios privados).

### Objetivos Clave

- **Agilidad en Punto de Atencion:** Registro inmediato de pacientes y citas en pantalla unica durante la consulta presencial.
- **Enfoque Multi-Sede:** Segmentacion clara y dinamica de expedientes, horarios y citas de acuerdo con la instalacion activa.
- **Gestion Clinica Especializada:** Registro detallado de biometria podologica (tipo de pisada, alineacion, peso, altura), diagnosticos diferenciados por pie (izquierdo/derecho) y tratamientos aplicados.
- **Identificacion de Riesgos:** Alertas clinicas prioritarias para padecimientos cronicos como Diabetes Mellitus e Hipertension Arterial.
- **Experiencia de Usuario Refinada:** Interfaz estilo boutique editorial, optimizada para dispositivos moviles y pantallas de escritorio.

---

## Arquitectura del Sistema

El ecosistema esta construido bajo un patron Monorepo desacoplado que separa claramente la capa de presentacion, la capa de logica de negocio y la capa de persistencia de datos.

```
+-----------------------------------------------------------------------+
|                            FRONTEND (SPA)                             |
|  - Look & Feel Boutique Editorial (Vanilla JS, HTML5, Modern CSS)     |
|  - Vistas: Dashboard, Agenda, Pacientes, Consulta Clinica, Agendar    |
+-----------------------------------^-----------------------------------+
                                    |
                                    | HTTP / JSON REST Requests
                                    v
+-----------------------------------------------------------------------+
|                         BACKEND API (Node.js)                         |
|  - Express.js (Router, Middlewares, CORS, Estaticos)                  |
|  - Controladores Especializados (Clinicas, Pacientes, Consultas, etc) |
+-----------------------------------^-----------------------------------+
                                    |
                                    | mysql2 / Connection Pool
                                    v
+-----------------------------------------------------------------------+
|                    BASE DE DATOS RELACIONAL (MySQL)                   |
|  - Esquema Clinica_Podologia                                          |
|  - Tablas: clinica, paciente, consulta, podologo, diagnostico, etc.   |
+-----------------------------------------------------------------------+
```

---

## Stack Tecnologico

### Backend
- **Entorno de Ejecucion:** Node.js (v18+)
- **Framework Web:** Express.js
- **Conector de Base de Datos:** `mysql2/promise` con administracion de Pool de conexiones
- **Seguridad e Integracion:** CORS, `dotenv` para configuracion por ambiente
- **Servidor de Archivos:** Servidor de recursos estaticos integrado para servir el frontend de forma unificada

### Frontend
- **Arquitectura:** Single Page Application (SPA) basada en Javascript Vanilla modular
- **Diseno Visual:** CSS3 moderno con variables CSS, tecnicas de glassmorphism, diseno responsivo Mobile-First y tipografia editorial (Google Fonts: *Playfair Display* y *Plus Jakarta Sans*)
- **Iconografia:** Font Awesome 6
- **Manejo de Estado:** Estado reactivo centralizado en memoria con sincronizacion asincrona hacia la API

### Persistencia
- **Motor:** MySQL 8.x / MariaDB
- **Diseno Relacional:** Integridad referencial con llaves foraneas, normalizacion de catalogos y fechas estandarizadas

---

## Modulos Funcionales

### 1. Panel Principal (Dashboard)
- Resumen metrico de consultas agendadas y completadas del dia.
- Selector dinamico de sede activa con persistencia de contexto.
- Filtros rapidos por categoria clinica: Todos, Diabeticos, Hipertensos y Citas Confirmadas.
- Lista cronologica interactiva de pacientes del dia con acceso directo a atencion clinica.

### 2. Agenda y Calendario Interactivo
- Vista de calendario mensual interactivo con navegacion acotada a rangos operativos.
- Indicadores visuales de carga de citas por fecha y sede.
- Consulta de detalle de citas por dia seleccionado con estados (Programada, Confirmada, En Atencion, Completada, Cancelada).

### 3. Directorio de Pacientes y Expedientes
- Busqueda reactiva instantanea por nombre, numero de expediente o telefono.
- Ficha clinica integral del paciente con datos demograficos, antecedentes patologicos, calzado habitual y notas de alergias.
- Historial cronologico de todas las atenciones recibidas por el paciente.

### 4. Modulo de Consulta Podologica
- Admision dual: Atencion directa (Walk-in / Sin cita previa) o conversion de cita agendada.
- Registro de mediciones fisicas: peso, altura, tipo de pisada (Neutra, Pronadora, Supinadora) y alineacion.
- Diagnosticos podologicos detallados con marcacion independiente para Pie Izquierdo y Pie Derecho.
- Catalogo y aplicacion de tratamientos con desglose de costos y notas terapeuticas.

### 5. Agendamiento Expres (Alta Rapida)
- Flujo unificado para registrar pacientes de primera vez y agendar su cita en un solo paso.
- Prevencion de duplicados mediante verificacion automatica de expediente.

---

## Estructura del Repositorio

```
clinica-podologia/
├── .github/
│   └── workflows/              # CI/CD (pruebas y despliegues automáticos con GitHub Actions)
├── backend/                    # API REST (Node.js/Express)
│   ├── src/
│   │   ├── config/             # Conexión DB (MySQL pool), variables de entorno
│   │   ├── controllers/        # Controladores (auth, citas, podólogos, pacientes, etc.)
│   │   ├── middlewares/        # authMiddleware.js, auditoriaMiddleware.js
│   │   ├── models/             # Modelos y esquemas de persistencia
│   │   ├── routes/             # Definición de rutas REST y RBAC
│   │   ├── utils/              # Funciones auxiliares de auditoría y fechas
│   │   ├── app.js              # Configuración y middlewares de Express
│   │   └── server.js           # Arranque del listener y verificación de DB
│   ├── .env.example            # Plantilla de variables de entorno
│   ├── package.json            # Dependencias y scripts del backend
│   └── test_rbac.js            # Pruebas de integración RBAC
├── frontend-landing/           # Web pública (landing + agendamiento express sin login)
│   ├── public/
│   │   └── assets/             # Logos, íconos y recursos visuales
│   ├── src/                    # Sitio web público
│   │   ├── css/                # Estilos modernos para la landing
│   │   ├── js/api.js           # Conector a endpoints públicos de citas
│   │   ├── index.html          # Portal principal informativo
│   │   ├── servicios.html      # Catálogo interactivo de tratamientos
│   │   └── agendar.html        # Wizard interactivo de agendamiento
│   └── package.json            # Scripts de ejecución para la landing
├── frontend-admin/             # Panel interno integral (Admin, Recepción, Podólogo)
│   ├── src/
│   │   ├── components/         # Calendario, tablas, modales y expediente
│   │   ├── views/
│   │   │   ├── admin/          # Gestión de podólogos, sedes y pistas de auditoría
│   │   │   ├── recepcion/      # Calendario general, turnos y asignaciones
│   │   │   └── podologo/       # Agenda personal, ECE y recetas
│   │   ├── guards/             # Control de acceso y redirección por rol / token
│   │   └── services/           # Peticiones HTTP inyectando Bearer Token JWT
│   ├── tests/                  # Pruebas unitarias (Jest) y E2E (Playwright)
│   ├── index.html              # Contenedor SPA principal del panel interno
│   └── package.json            # Dependencias y scripts del panel interno
├── .gitignore
├── README.md
└── package.json                # Scripts raíz para orquestar todos los entornos
```

---

## Modelo de Datos y Base de Datos

La base de datos `Clinica_Podologia` articula la informacion a traves de las siguientes entidades principales:

| Entidad | Descripcion | Campos Clave |
| :--- | :--- | :--- |
| **clinica** | Registro de sedes y consultorios | `id_clinica`, `nombre`, `direccion`, `telefono`, `estado` |
| **paciente** | Informacion demografica y medica base | `id_paciente`, `expediente`, `nombre_completo`, `es_diabetico`, `es_hipertenso`, `alergias` |
| **podologo** | Profesionales de la salud autorizados | `id_podologo`, `nombre`, `cedula_profesional`, `especialidad` |
| **consulta** | Acto medico o cita agendada | `id_consulta`, `id_paciente`, `id_clinica`, `fecha_hora`, `motivo`, `estado`, `tipo_pisada` |
| **diagnostico** | Padecimientos identificados en consulta | `id_diagnostico`, `id_consulta`, `padecimiento`, `pie_izquierdo`, `pie_derecho` |
| **tratamiento** | Procedimientos clinicos realizados | `id_tratamiento`, `id_consulta`, `descripcion`, `costo` |
| **documento** | Archivos adjuntos y notas legales | `id_documento`, `id_paciente`, `tipo_documento`, `url_documento` |

---

## Referencia de la API REST

Todos los endpoints responden en formato JSON y siguen las convenciones estandar de codigos de estado HTTP.

### Endpoints Principales

| Metodo | Ruta | Descripcion |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Verificacion de estado y conectividad del servidor |
| `GET` | `/api/clinicas` | Listado de sedes disponibles |
| `GET` | `/api/pacientes` | Busqueda y filtrado de pacientes |
| `POST` | `/api/pacientes` | Registro de nuevo paciente con expediente |
| `GET` | `/api/pacientes/:id` | Detalle del paciente e historial de consultas |
| `PUT` | `/api/pacientes/:id` | Actualizacion de datos demograficos o patologicos |
| `GET` | `/api/consultas` | Listado de consultas/citas filtradas por fecha o clinica |
| `POST` | `/api/consultas` | Registro de nueva consulta (directa o cita agendada) |
| `GET` | `/api/consultas/:id` | Detalle completo de consulta con diagnosticos y tratamientos |
| `PUT` | `/api/consultas/:id/estado` | Cambio de estado de la consulta |
| `GET` | `/api/podologos` | Catalogo de especialistas registrados |
| `GET` | `/api/diagnosticos` | Catalogo de diagnosticos frecuentes |
| `GET` | `/api/tratamientos` | Catalogo de tratamientos y procedimientos |

---

## Instalacion y Puesta en Marcha

### Requisitos Previos

- **Node.js:** Version 18.0.0 o superior
- **NPM:** Version 9.0.0 o superior
- **MySQL Server:** Version 8.0 o compatible (ej. XAMPP, MariaDB, MySQL Workbench)

### Pasos de Configuracion

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/usuario/Ecosistema-Podologia.git
   cd Ecosistema-Podologia
   ```

2. **Instalar dependencias del backend:**
   ```bash
   cd backend
   npm install
   ```

3. **Configurar la base de datos:**
   - Crear una base de datos denominada `Clinica_Podologia` en el servidor MySQL local.
   - Ejecutar el script SQL de estructura inicial si se dispone de el.

4. **Configurar el archivo de entorno:**
   - En la carpeta `backend/`, verificar o crear el archivo `.env` tomando como referencia los parametros de conexion.

5. **Iniciar el servidor en modo desarrollo:**
   - Desde la raiz del proyecto:
     ```bash
     npm run dev
     ```
   - O directamente desde la carpeta `backend`:
     ```bash
     npm start
     ```

6. **Acceder a la aplicacion:**
   - Abrir el navegador en: `http://localhost:4000`

---

## Variables de Entorno

El archivo `.env` en la carpeta `backend/` define las credenciales de conexion y el puerto del servidor:

```ini
PORT=4000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password_aqui
DB_NAME=Clinica_Podologia
DB_PORT=3306
```

---

## Flujos de Trabajo Principales

### Flujo 1: Agendamiento Expres
1. El usuario selecciona la opcion **Agendar** en la barra de navegacion.
2. Ingresa el numero de expediente o datos personales del paciente. Si ya existe, el sistema autocompleta los campos.
3. Se eligen la sede, la fecha y el horario deseado.
4. Al confirmar, el sistema guarda al paciente (si es nuevo) y genera la cita en estado `Programada`.

### Flujo 2: Atencion Clinica Directa (Walk-in)
1. El especialista accede al modulo **Consulta**.
2. Selecciona la modalidad *Atencion Directa (Sin Cita Previa)*.
3. Captura los datos del paciente y registra las metricas biometricas (pisada, alineacion, etc.).
4. Selecciona los diagnosticos marcando pie izquierdo, pie derecho o ambos.
5. Agrega los tratamientos aplicados con su costo.
6. Guarda la consulta, la cual queda registrada con estado `Completada` e indexada al expediente.

### Flujo 3: Conversion de Cita a Consulta
1. Desde el **Dashboard** o la **Agenda**, el especialista localiza la cita programada del dia.
2. Hace clic en *Iniciar Consulta*.
3. El sistema precarga los datos del paciente y la cita en el formulario de consulta.
4. El especialista complementa con diagnosticos y procedimientos, cerrando la atencion medica.

---

## Guia de Buenas Practicas y Mantenimiento

1. **Manejo de Errores en Backend:** Todos los controladores implementan bloques `try/catch` y devuelven mensajes estructurados con codigos HTTP semanticos (`400`, `404`, `500`).
2. **Liberacion de Conexiones:** Las consultas utilizan `mysql2/promise` mediante `pool.query()`, garantizando la liberacion automatica de conexiones al pool.
3. **Compatibilidad Retroactiva:** Se mantiene la ruta `/api/citas` como alias funcional de `/api/consultas` para asegurar la coexistencia fluida de interfaces previas y nuevas.
4. **Diseno Modular CSS:** Las variables globales de color, tipografia y espaciado residen en `:root` dentro de `styles.css`, facilitando la personalizacion o implementacion de nuevos temas sin tocar la logica de Javascript.

---

Desarrollado con altos estandares de ingenieria de software, orientacion clinica y rendimiento.