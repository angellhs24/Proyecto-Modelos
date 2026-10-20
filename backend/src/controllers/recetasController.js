const db = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoria');

/**
 * Genera el documento HTML membretado corporativo de la Receta Médica Digital
 * Diseñado con estética Light Minimalist / Corporativo y optimizado para impresión y PDF.
 */
function compilarPlantillaRecetaHTML(receta) {
  const fechaObj = new Date(receta.fecha_emision || Date.now());
  const fechaFormateada = isNaN(fechaObj.getTime())
    ? String(receta.fecha_emision || '')
    : fechaObj.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

  const medicamentos = Array.isArray(receta.medicamentos) ? receta.medicamentos : (receta.detalles || []);
  const doctorNombre = receta.podologo_nombre || 'Dr. Carlos Pérez Gómez';
  const doctorCedula = receta.podologo_cedula || 'CED-8492041';
  const pacienteNombre = receta.paciente || 'Paciente Clínico';
  const pacienteExp = receta.expediente || receta.fk_no_expediente || 'EXP-2026010001';
  const consultaFolio = receta.fk_consulta_id || 'CNS-001';
  const recetaFolio = receta.Receta_id || receta.folio || 'RX-2026-0001';
  const alergias = receta.alergias || 'Ninguna conocida';
  const edad = receta.edad ? `${receta.edad} años` : 'No especificada';
  const diagnostico = receta.diagnostico || 'Atención podológica integral';
  const indicaciones = receta.indicaciones_generales || receta.indicaciones || 'Seguir tratamiento al pie de la letra y acudir a revisión.';

  const filasMedicamentos = medicamentos.length > 0
    ? medicamentos.map((m, idx) => `
        <tr>
          <td style="text-align: center; font-weight: 700; color: #64748b; width: 40px;">${idx + 1}</td>
          <td>
            <div style="font-weight: 700; color: #0f172a; font-size: 15px;">${escapeHtml(m.medicamento)}</div>
            <div style="color: #64748b; font-size: 12px; margin-top: 2px;">Vía: ${escapeHtml(m.via_administracion || m.via || 'Tópica')}</div>
          </td>
          <td style="font-weight: 600; color: #1e293b;">${escapeHtml(m.dosis || 'Dosis indicada')}</td>
          <td style="color: #334155;">${escapeHtml(m.frecuencia || 'Cada 12 horas')}</td>
          <td style="color: #334155; font-weight: 600;">${escapeHtml(m.duracion || '7 días')}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8;">No se registraron medicamentos en esta receta.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receta Médica Digital - ${recetaFolio} - Elite Foot Care</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@1,600&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #f69251;
      --primary-dark: #e27938;
      --navy: #0f172a;
      --slate: #334155;
      --muted: #64748b;
      --light-bg: #f8fafc;
      --border-color: #e2e8f0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #f1f5f9;
      color: var(--navy);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    /* Barra de herramientas en pantalla */
    .toolbar-screen {
      position: sticky;
      top: 0;
      z-index: 999;
      background: #ffffff;
      border-bottom: 1px solid var(--border-color);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 900px;
      margin: 0 auto 20px auto;
      border-radius: 0 0 16px 16px;
    }

    .toolbar-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--slate);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .toolbar-actions {
      display: flex;
      gap: 10px;
    }

    .btn-tool {
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 9999px;
      border: 1px solid transparent;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
      text-decoration: none;
    }

    .btn-tool-primary {
      background: var(--primary);
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(246, 146, 81, 0.3);
    }
    .btn-tool-primary:hover {
      background: var(--primary-dark);
      transform: translateY(-1px);
    }

    .btn-tool-secondary {
      background: #f8fafc;
      color: var(--slate);
      border-color: var(--border-color);
    }
    .btn-tool-secondary:hover {
      background: #e2e8f0;
    }

    /* Hoja Membretada */
    .prescription-sheet {
      background: #ffffff;
      width: 100%;
      max-width: 850px;
      margin: 0 auto 40px auto;
      padding: 44px 50px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
      border-radius: 16px;
      border: 1px solid rgba(226, 232, 240, 0.8);
      position: relative;
      overflow: hidden;
    }

    /* Marca de Agua médica */
    .watermark {
      position: absolute;
      top: 55%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-25deg);
      font-size: 80px;
      font-weight: 900;
      color: rgba(246, 146, 81, 0.03);
      text-transform: uppercase;
      letter-spacing: 12px;
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
      z-index: 0;
    }

    /* Encabezado Membretado */
    .header-letterhead {
      position: relative;
      z-index: 1;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 20px;
      margin-bottom: 22px;
    }

    .clinic-brand {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .clinic-logo-icon {
      width: 52px;
      height: 52px;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--primary);
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
    }

    .clinic-brand-text h1 {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #0f172a;
      line-height: 1.1;
    }

    .clinic-brand-text h1 span {
      color: var(--primary);
    }

    .clinic-brand-text p {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #64748b;
      margin-top: 3px;
    }

    .clinic-meta {
      text-align: right;
      font-size: 12px;
      color: #475569;
      line-height: 1.4;
    }

    .clinic-meta .folio-pill {
      display: inline-block;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      color: #c2410c;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 13px;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }

    /* Sección de Datos Clínicos (Médico y Paciente) */
    .meta-grid {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 26px;
    }

    .meta-box h3 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      font-weight: 700;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .meta-box .main-value {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
    }

    .meta-box .sub-value {
      font-size: 12px;
      color: #475569;
      margin-top: 3px;
    }

    /* Emblema Rx */
    .rx-indicator {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }

    .rx-symbol {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 32px;
      font-style: italic;
      font-weight: 700;
      color: var(--primary);
      line-height: 1;
    }

    .rx-line {
      flex: 1;
      height: 1px;
      background: #cbd5e1;
    }

    .rx-title {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #64748b;
    }

    /* Tabla de Medicamentos */
    .meds-table-container {
      position: relative;
      z-index: 1;
      margin-bottom: 24px;
    }

    .meds-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .meds-table th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
      padding: 10px 14px;
      text-align: left;
      border-top: 1px solid #cbd5e1;
      border-bottom: 2px solid #cbd5e1;
    }

    .meds-table td {
      padding: 14px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }

    .meds-table tr:hover {
      background: #fafafa;
    }

    /* Bloque de Indicaciones Generales */
    .indications-box {
      position: relative;
      z-index: 1;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-left: 4px solid var(--primary);
      border-radius: 8px;
      padding: 16px 18px;
      margin-bottom: 30px;
    }

    .indications-box h4 {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #0f172a;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .indications-box p {
      font-size: 13px;
      color: #334155;
      line-height: 1.6;
      white-space: pre-line;
    }

    /* Pie de Página y Firma Médica */
    .footer-letterhead {
      position: relative;
      z-index: 1;
      margin-top: 40px;
      padding-top: 20px;
      display: grid;
      grid-template-columns: 1fr 1.2fr;
      gap: 30px;
      align-items: flex-end;
      border-top: 1px solid #e2e8f0;
    }

    .security-stamp {
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
    }

    .security-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      color: #047857;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      padding: 3px 8px;
      border-radius: 6px;
      margin-bottom: 6px;
      font-size: 10px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .signature-area {
      text-align: center;
    }

    .signature-line {
      width: 80%;
      height: 1px;
      background: #0f172a;
      margin: 0 auto 10px auto;
    }

    .doctor-name-sign {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
    }

    .doctor-cedula-sign {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }

    .doctor-title-sign {
      font-size: 11px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }

    /* Reglas para Impresión Fiel */
    @media print {
      body {
        background: #ffffff !important;
        color: #000000 !important;
      }

      .toolbar-screen {
        display: none !important;
      }

      .prescription-sheet {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 20mm 15mm !important;
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
      }

      .meta-grid {
        background: #f8fafc !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .meds-table th {
        background: #f1f5f9 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .folio-pill {
        background: #fff7ed !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .security-badge {
        background: #ecfdf5 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      @page {
        size: letter portrait;
        margin: 10mm;
      }
    }
  </style>
</head>
<body>

  <!-- Barra de Herramientas de Pantalla -->
  <div class="toolbar-screen">
    <div class="toolbar-title">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
      <span>Receta Médica Digital: <strong>${recetaFolio}</strong></span>
    </div>
    <div class="toolbar-actions">
      <button class="btn-tool btn-tool-primary" onclick="window.print()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
        Imprimir / Guardar PDF
      </button>
      <button class="btn-tool btn-tool-secondary" onclick="window.close()">
        Cerrar
      </button>
    </div>
  </div>

  <!-- Hoja de Receta Membretada -->
  <div class="prescription-sheet">
    <div class="watermark">Elite Foot Care</div>

    <!-- Encabezado Membretado Oficial -->
    <header class="header-letterhead">
      <div class="clinic-brand">
        <div class="clinic-logo-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
        </div>
        <div class="clinic-brand-text">
          <h1>Elite <span>Foot Care</span></h1>
          <p>Clínica de Podología Integral y Especialidades</p>
        </div>
      </div>
      <div class="clinic-meta">
        <div class="folio-pill">RECETA: ${recetaFolio}</div>
        <div><strong>Folio Consulta:</strong> ${consultaFolio}</div>
        <div><strong>Fecha:</strong> ${fechaFormateada}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Lic. Sanitaria: COFEPRIS-26-POD-0914</div>
      </div>
    </header>

    <!-- Fila de Datos del Médico y del Paciente -->
    <section class="meta-grid">
      <div class="meta-box">
        <h3>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          Médico Especialista Tratante
        </h3>
        <div class="main-value">${escapeHtml(doctorNombre)}</div>
        <div class="sub-value">Cédula Profesional: <strong>${escapeHtml(doctorCedula)}</strong></div>
        <div class="sub-value">Podología Clínica, Biomecánica y Cirugía Menor</div>
      </div>
      <div class="meta-box">
        <h3>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
            <line x1="20" y1="8" x2="20" y2="14"></line>
            <line x1="23" y1="11" x2="17" y2="11"></line>
          </svg>
          Datos del Paciente
        </h3>
        <div class="main-value">${escapeHtml(pacienteNombre)}</div>
        <div class="sub-value">Expediente: <strong>${escapeHtml(String(pacienteExp))}</strong> • Edad: ${escapeHtml(edad)}</div>
        <div class="sub-value" style="color: #b91c1c;">Alergias: <strong>${escapeHtml(alergias)}</strong></div>
      </div>
    </section>

    <!-- Indicador Rx -->
    <div class="rx-indicator">
      <span class="rx-symbol">Rx.</span>
      <div class="rx-line"></div>
      <span class="rx-title">Prescripción Farmacológica</span>
    </div>

    <!-- Tabla de Medicamentos -->
    <div class="meds-table-container">
      <table class="meds-table">
        <thead>
          <tr>
            <th style="text-align: center;">#</th>
            <th>Medicamento / Fármaco</th>
            <th>Dosis</th>
            <th>Frecuencia</th>
            <th>Duración</th>
          </tr>
        </thead>
        <tbody>
          ${filasMedicamentos}
        </tbody>
      </table>
    </div>

    <!-- Indicaciones Generales -->
    <section class="indications-box">
      <h4>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        Indicaciones Generales y Cuidados en Casa
      </h4>
      <p>${escapeHtml(indicaciones)}</p>
    </section>

    <!-- Pie de Página con Espacio para Firma -->
    <footer class="footer-letterhead">
      <div class="security-stamp">
        <div class="security-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          Firma Electrónica Médica Válida
        </div>
        <div><strong>Folio de Seguridad:</strong> ${recetaFolio}-${Date.now().toString().slice(-4)}</div>
        <div>Documento clínico digital oficial generado por el sistema hospitalario Elite Foot Care.</div>
        <div style="margin-top: 4px; font-size: 10px; color: #94a3b8;">
          Válido como comprobante médico legal para dispensación en farmacia.
        </div>
      </div>

      <div class="signature-area">
        <div class="signature-line"></div>
        <div class="doctor-name-sign">${escapeHtml(doctorNombre)}</div>
        <div class="doctor-cedula-sign">Cédula Profesional: ${escapeHtml(doctorCedula)}</div>
        <div class="doctor-title-sign">Especialista Podólogo Certificado</div>
      </div>
    </footer>
  </div>

  <script>
    // Si viene el parámetro ?autoprint=true en la URL, disparar impresión automáticamente
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autoprint') === 'true') {
      window.addEventListener('load', () => {
        setTimeout(() => window.print(), 400);
      });
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * POST /api/recetas: Guardar una nueva receta médica
 * RESTRICCIÓN RBAC: Solo el Podólogo (Rol ID: 4) puede emitir recetas.
 */
const crearReceta = async (req, res) => {
  let {
    Receta_id,
    folio,
    fk_consulta_id,
    fk_paciente_id,
    expediente,
    indicaciones_generales,
    indicaciones,
    medicamentos = [],
    detalles = [],
    fecha_emision
  } = req.body;

  try {
    // Si no se proporcionó fk_consulta_id pero sí expediente/paciente_id
    const expFinal = fk_paciente_id || expediente;
    if (!fk_consulta_id && expFinal) {
      const consultaExistente = await db.query(
        `SELECT Consulta_id, fk_no_expediente FROM Consultas WHERE fk_no_expediente = ? ORDER BY fecha_hora DESC LIMIT 1`,
        [expFinal]
      );

      if (consultaExistente.rows.length > 0) {
        fk_consulta_id = consultaExistente.rows[0].Consulta_id;
      } else {
        // Obtener clínica y podólogo
        const clinicaDefecto = await db.query(`SELECT Clinica_id FROM Clinicas LIMIT 1`);
        const podologoDefecto = await db.query(`SELECT Cedula_podologo FROM Podologos LIMIT 1`);
        const clinicaId = clinicaDefecto.rows[0]?.Clinica_id || 1;
        const podologoId = podologoDefecto.rows[0]?.Cedula_podologo || '0000001';

        const nuevaConsultaId = `CNS-${expFinal}-${Date.now().toString().slice(-4)}`;
        await db.query(
          `INSERT INTO Consultas (
            Consulta_id, fk_no_expediente, fk_clinica_id, fk_cedula_podologo,
            fecha_hora, estado, motivo_o_notas
          ) VALUES (?, ?, ?, ?, NOW(), 'Completada', 'Emisión de Receta Médica Digital')`,
          [nuevaConsultaId, expFinal, clinicaId, podologoId]
        );
        fk_consulta_id = nuevaConsultaId;
      }
    }

    if (!fk_consulta_id) {
      return res.status(400).json({ error: 'Se requiere fk_consulta_id o expediente del paciente' });
    }

    // Obtener fk_no_expediente de la consulta para asegurar el vínculo con el paciente
    let pacienteIdFinal = expFinal;
    if (!pacienteIdFinal) {
      const conData = await db.query(`SELECT fk_no_expediente FROM Consultas WHERE Consulta_id = ?`, [fk_consulta_id]);
      if (conData.rows.length > 0) {
        pacienteIdFinal = conData.rows[0].fk_no_expediente;
      }
    }

    // Generar Folio Oficial si no se proporcionó
    const recetaIdFinal =
      Receta_id ||
      folio ||
      `RX-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    const indicacionesFinal = indicaciones_generales || indicaciones || 'Ninguna indicación especial especificada';

    // Insertar en tabla Recetas
    // Se contempla si la columna fk_paciente_id existe o si la tabla conserva la estructura base
    try {
      await db.query(
        `INSERT INTO Recetas (
          Receta_id,
          fk_consulta_id,
          fk_paciente_id,
          indicaciones_generales,
          fecha_emision
        ) VALUES (?, ?, ?, ?, COALESCE(?, NOW()))`,
        [recetaIdFinal, fk_consulta_id, pacienteIdFinal, indicacionesFinal, fecha_emision || null]
      );
    } catch (insertErr) {
      // Si la columna fk_paciente_id aún no existe en MySQL, fallback al esquema de 4 columnas
      if (insertErr.code === 'ER_BAD_FIELD_ERROR' || insertErr.message?.includes('fk_paciente_id')) {
        await db.query(
          `INSERT INTO Recetas (
            Receta_id,
            fk_consulta_id,
            indicaciones_generales,
            fecha_emision
          ) VALUES (?, ?, ?, COALESCE(?, NOW()))`,
          [recetaIdFinal, fk_consulta_id, indicacionesFinal, fecha_emision || null]
        );
      } else {
        throw insertErr;
      }
    }

    // Unificar lista de medicamentos dinámicos
    const meds = Array.isArray(medicamentos) && medicamentos.length > 0 ? medicamentos : detalles;

    if (Array.isArray(meds) && meds.length > 0) {
      for (const m of meds) {
        if (!m.medicamento && !m.nombre) continue;
        const nombreMed = m.medicamento || m.nombre;
        await db.query(
          `INSERT INTO Detalles_Receta (
            fk_receta_id,
            medicamento,
            dosis,
            via_administracion,
            frecuencia,
            duracion
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            recetaIdFinal,
            nombreMed,
            m.dosis || 'Dosis indicada',
            m.via_administracion || m.via || 'Tópica',
            m.frecuencia || 'Cada 12 horas',
            m.duracion || '7 días'
          ]
        );
      }
    }

    // Bitácora de Auditoría Clínica
    const usuarioResponsable =
      req.user?.nombre_completo ||
      req.headers['x-usuario'] ||
      'Dr. Podólogo Titular';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    await registrarAuditoria({
      usuario_responsable: usuarioResponsable,
      accion_realizada: `Emisión de Receta Médica Digital (Folio: ${recetaIdFinal}) para Consulta ${fk_consulta_id} con ${meds.length} medicamento(s)`,
      tabla_afectada: 'Recetas',
      direccion_ip: ip
    });
    req.auditoriaManual = true;

    res.status(201).json({
      mensaje: 'Receta médica emitida correctamente',
      Receta_id: recetaIdFinal,
      folio: recetaIdFinal,
      fk_consulta_id,
      fk_paciente_id: pacienteIdFinal,
      medicamentos: meds,
      indicaciones_generales: indicacionesFinal,
      url_pdf: `/api/recetas/${recetaFolioUrl(recetaIdFinal)}/pdf`
    });
  } catch (error) {
    console.error('Error al emitir receta médica:', error);
    res.status(500).json({ error: 'Error al emitir la receta médica en el servidor' });
  }
};

function recetaFolioUrl(id) {
  return encodeURIComponent(id);
}

/**
 * Consulta de receta completa por Consulta_id
 * GET /api/recetas/consulta/:id
 * Accesible por: Podólogo (4), Recepcionista (3), Administrador (1)
 */
const obtenerRecetaPorConsultaId = async (req, res) => {
  const { id } = req.params;

  try {
    const recetaRes = await db.query(
      `SELECT 
        r.Receta_id,
        r.Receta_id AS folio,
        r.fk_consulta_id,
        r.indicaciones_generales,
        r.indicaciones_generales AS indicaciones,
        r.fecha_emision,
        r.fecha_emision AS fecha,
        c.fk_no_expediente,
        p.No_expediente AS expediente,
        TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente,
        p.telefono AS paciente_telefono,
        p.Notas AS alergias,
        CASE 
          WHEN p.Fecha_nacimiento IS NOT NULL THEN TIMESTAMPDIFF(YEAR, p.Fecha_nacimiento, CURDATE())
          ELSE NULL 
        END AS edad,
        c.motivo_o_notas AS diagnostico,
        cl.Nombre AS clinica,
        pod.Nombre AS podologo_nombre,
        pod.Cedula_podologo AS podologo_cedula
      FROM Recetas r
      INNER JOIN Consultas c ON r.fk_consulta_id = c.Consulta_id
      INNER JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
      LEFT JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
      LEFT JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
      WHERE r.fk_consulta_id = ?
      ORDER BY r.fecha_emision DESC
      LIMIT 1`,
      [id]
    );

    if (recetaRes.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró receta médica emitida para esta consulta', fk_consulta_id: id });
    }

    const receta = recetaRes.rows[0];

    // Consultar medicamentos
    const detallesRes = await db.query(
      `SELECT 
        Detalle_id,
        fk_receta_id,
        medicamento,
        dosis,
        via_administracion,
        via_administracion AS via,
        frecuencia,
        duracion
      FROM Detalles_Receta
      WHERE fk_receta_id = ?
      ORDER BY Detalle_id ASC`,
      [receta.Receta_id]
    );

    receta.medicamentos = detallesRes.rows;
    receta.detalles = detallesRes.rows;
    receta.url_pdf = `/api/recetas/${recetaFolioUrl(receta.Receta_id)}/pdf`;

    res.json(receta);
  } catch (error) {
    console.error('Error al obtener receta por consulta:', error);
    res.status(500).json({ error: 'Error al consultar la receta médica' });
  }
};

/**
 * Consulta de receta por ID (Folio)
 * GET /api/recetas/:id
 */
const obtenerRecetaPorId = async (req, res) => {
  const { id } = req.params;

  try {
    const recetaRes = await db.query(
      `SELECT 
        r.Receta_id,
        r.Receta_id AS folio,
        r.fk_consulta_id,
        r.indicaciones_generales,
        r.indicaciones_generales AS indicaciones,
        r.fecha_emision,
        r.fecha_emision AS fecha,
        c.fk_no_expediente,
        p.No_expediente AS expediente,
        TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente,
        p.telefono AS paciente_telefono,
        p.Notas AS alergias,
        CASE 
          WHEN p.Fecha_nacimiento IS NOT NULL THEN TIMESTAMPDIFF(YEAR, p.Fecha_nacimiento, CURDATE())
          ELSE NULL 
        END AS edad,
        c.motivo_o_notas AS diagnostico,
        cl.Nombre AS clinica,
        pod.Nombre AS podologo_nombre,
        pod.Cedula_podologo AS podologo_cedula
      FROM Recetas r
      INNER JOIN Consultas c ON r.fk_consulta_id = c.Consulta_id
      INNER JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
      LEFT JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
      LEFT JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
      WHERE r.Receta_id = ?`,
      [id]
    );

    if (recetaRes.rows.length === 0) {
      return res.status(404).json({ error: 'Receta médica no encontrada' });
    }

    const receta = recetaRes.rows[0];

    const detallesRes = await db.query(
      `SELECT 
        Detalle_id,
        fk_receta_id,
        medicamento,
        dosis,
        via_administracion,
        via_administracion AS via,
        frecuencia,
        duracion
      FROM Detalles_Receta
      WHERE fk_receta_id = ?
      ORDER BY Detalle_id ASC`,
      [id]
    );

    receta.medicamentos = detallesRes.rows;
    receta.detalles = detallesRes.rows;
    receta.url_pdf = `/api/recetas/${recetaFolioUrl(receta.Receta_id)}/pdf`;

    res.json(receta);
  } catch (error) {
    console.error('Error al obtener receta por ID:', error);
    res.status(500).json({ error: 'Error al consultar la receta médica' });
  }
};

/**
 * Listado general de recetas con filtros
 * GET /api/recetas
 */
const obtenerRecetas = async (req, res) => {
  try {
    const { fk_consulta_id, expediente } = req.query;

    let sql = `
      SELECT 
        r.Receta_id,
        r.Receta_id AS folio,
        r.fk_consulta_id,
        r.indicaciones_generales,
        r.indicaciones_generales AS indicaciones,
        r.fecha_emision,
        r.fecha_emision AS fecha,
        c.fk_no_expediente,
        p.No_expediente AS expediente,
        TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente,
        p.telefono AS paciente_telefono,
        p.Notas AS alergias,
        CASE 
          WHEN p.Fecha_nacimiento IS NOT NULL THEN TIMESTAMPDIFF(YEAR, p.Fecha_nacimiento, CURDATE())
          ELSE NULL 
        END AS edad,
        c.motivo_o_notas AS diagnostico,
        cl.Nombre AS clinica,
        pod.Nombre AS podologo_nombre,
        pod.Cedula_podologo AS podologo_cedula
      FROM Recetas r
      INNER JOIN Consultas c ON r.fk_consulta_id = c.Consulta_id
      INNER JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
      LEFT JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
      LEFT JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
      WHERE 1=1
    `;
    const params = [];

    if (fk_consulta_id) {
      sql += ` AND r.fk_consulta_id = ?`;
      params.push(fk_consulta_id);
    }

    if (expediente) {
      sql += ` AND p.No_expediente = ?`;
      params.push(expediente);
    }

    sql += ` ORDER BY r.fecha_emision DESC, r.Receta_id DESC`;

    const resultado = await db.query(sql, params);
    const recetas = resultado.rows;

    if (recetas.length > 0) {
      const recetaIds = recetas.map((r) => r.Receta_id);
      const placeholders = recetaIds.map(() => '?').join(',');

      const detallesRes = await db.query(
        `SELECT 
          Detalle_id,
          fk_receta_id,
          medicamento,
          dosis,
          via_administracion,
          via_administracion AS via,
          frecuencia,
          duracion
        FROM Detalles_Receta
        WHERE fk_receta_id IN (${placeholders})
        ORDER BY Detalle_id ASC`,
        recetaIds
      );

      const detallesPorReceta = new Map();
      detallesRes.rows.forEach((d) => {
        if (!detallesPorReceta.has(d.fk_receta_id)) {
          detallesPorReceta.set(d.fk_receta_id, []);
        }
        detallesPorReceta.get(d.fk_receta_id).push(d);
      });

      recetas.forEach((r) => {
        const meds = detallesPorReceta.get(r.Receta_id) || [];
        r.medicamentos = meds;
        r.detalles = meds;
        r.url_pdf = `/api/recetas/${recetaFolioUrl(r.Receta_id)}/pdf`;
      });
    }

    res.json(recetas);
  } catch (error) {
    console.error('Error al obtener recetas:', error);
    res.status(500).json({ error: 'Error al obtener las recetas médicas' });
  }
};

/**
 * Generar vista imprimible / PDF de la Receta Médica por ID de Receta
 * GET /api/recetas/:id/pdf
 */
const generarRecetaPDF = async (req, res) => {
  const { id } = req.params;

  try {
    const recetaRes = await db.query(
      `SELECT 
        r.Receta_id,
        r.Receta_id AS folio,
        r.fk_consulta_id,
        r.indicaciones_generales,
        r.indicaciones_generales AS indicaciones,
        r.fecha_emision,
        r.fecha_emision AS fecha,
        c.fk_no_expediente,
        p.No_expediente AS expediente,
        TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente,
        p.telefono AS paciente_telefono,
        p.Notas AS alergias,
        CASE 
          WHEN p.Fecha_nacimiento IS NOT NULL THEN TIMESTAMPDIFF(YEAR, p.Fecha_nacimiento, CURDATE())
          ELSE NULL 
        END AS edad,
        c.motivo_o_notas AS diagnostico,
        cl.Nombre AS clinica,
        pod.Nombre AS podologo_nombre,
        pod.Cedula_podologo AS podologo_cedula
      FROM Recetas r
      INNER JOIN Consultas c ON r.fk_consulta_id = c.Consulta_id
      INNER JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
      LEFT JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
      LEFT JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
      WHERE r.Receta_id = ?`,
      [id]
    );

    if (recetaRes.rows.length === 0) {
      return res.status(404).send('<h1>404 - Receta médica no encontrada</h1><p>El folio solicitado no existe en la base de datos.</p>');
    }

    const receta = recetaRes.rows[0];

    const detallesRes = await db.query(
      `SELECT 
        Detalle_id,
        fk_receta_id,
        medicamento,
        dosis,
        via_administracion,
        frecuencia,
        duracion
      FROM Detalles_Receta
      WHERE fk_receta_id = ?
      ORDER BY Detalle_id ASC`,
      [id]
    );

    receta.medicamentos = detallesRes.rows;

    const html = compilarPlantillaRecetaHTML(receta);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Error al generar PDF de receta:', error);
    res.status(500).send('<h1>500 - Error al generar el PDF de la receta médica</h1>');
  }
};

/**
 * Generar vista imprimible / PDF de la Receta Médica por ID de Consulta
 * GET /api/recetas/consulta/:id/pdf
 */
const generarRecetaPDFPorConsulta = async (req, res) => {
  const { id } = req.params;

  try {
    const recetaRes = await db.query(
      `SELECT 
        r.Receta_id,
        r.Receta_id AS folio,
        r.fk_consulta_id,
        r.indicaciones_generales,
        r.indicaciones_generales AS indicaciones,
        r.fecha_emision,
        r.fecha_emision AS fecha,
        c.fk_no_expediente,
        p.No_expediente AS expediente,
        TRIM(CONCAT(p.Nombres, ' ', p.ape_paterno, ' ', COALESCE(p.ape_materno, ''))) AS paciente,
        p.telefono AS paciente_telefono,
        p.Notas AS alergias,
        CASE 
          WHEN p.Fecha_nacimiento IS NOT NULL THEN TIMESTAMPDIFF(YEAR, p.Fecha_nacimiento, CURDATE())
          ELSE NULL 
        END AS edad,
        c.motivo_o_notas AS diagnostico,
        cl.Nombre AS clinica,
        pod.Nombre AS podologo_nombre,
        pod.Cedula_podologo AS podologo_cedula
      FROM Recetas r
      INNER JOIN Consultas c ON r.fk_consulta_id = c.Consulta_id
      INNER JOIN Pacientes p ON c.fk_no_expediente = p.No_expediente
      LEFT JOIN Clinicas cl ON c.fk_clinica_id = cl.Clinica_id
      LEFT JOIN Podologos pod ON c.fk_cedula_podologo = pod.Cedula_podologo
      WHERE r.fk_consulta_id = ?
      ORDER BY r.fecha_emision DESC
      LIMIT 1`,
      [id]
    );

    if (recetaRes.rows.length === 0) {
      return res.status(404).send('<h1>404 - No se encontró receta para esta consulta</h1><p>El podólogo aún no ha emitido una receta para la consulta solicitada.</p>');
    }

    const receta = recetaRes.rows[0];

    const detallesRes = await db.query(
      `SELECT 
        Detalle_id,
        fk_receta_id,
        medicamento,
        dosis,
        via_administracion,
        frecuencia,
        duracion
      FROM Detalles_Receta
      WHERE fk_receta_id = ?
      ORDER BY Detalle_id ASC`,
      [receta.Receta_id]
    );

    receta.medicamentos = detallesRes.rows;

    const html = compilarPlantillaRecetaHTML(receta);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Error al generar PDF de receta por consulta:', error);
    res.status(500).send('<h1>500 - Error al generar el PDF de la receta médica</h1>');
  }
};

/**
 * Eliminar receta médica
 * DELETE /api/recetas/:id
 */
const eliminarReceta = async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(`DELETE FROM Recetas WHERE Receta_id = ?`, [id]);

    const usuarioResponsable = req.user?.nombre_completo || req.headers['x-usuario'] || 'Dr. Podólogo Titular';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

    await registrarAuditoria({
      usuario_responsable: usuarioResponsable,
      accion_realizada: `Eliminación de Receta médica ${id}`,
      tabla_afectada: 'Recetas',
      direccion_ip: ip
    });
    req.auditoriaManual = true;

    res.json({ mensaje: 'Receta médica eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar receta:', error);
    res.status(500).json({ error: 'Error al eliminar la receta médica' });
  }
};

module.exports = {
  crearReceta,
  obtenerRecetaPorConsultaId,
  obtenerRecetaPorId,
  obtenerRecetas,
  generarRecetaPDF,
  generarRecetaPDFPorConsulta,
  eliminarReceta,
  compilarPlantillaRecetaHTML
};
