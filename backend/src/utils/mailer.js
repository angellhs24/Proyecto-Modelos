const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

let transporter = null;

function obtenerTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Si no hay credenciales configuradas en .env, devolvemos null para modo simulación
  if (!user || !pass || user.includes('tu_correo') || pass.includes('tu_contraseña')) {
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: host || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT, 10) || 465,
      secure: process.env.SMTP_SECURE === 'false' ? false : true,
      auth: {
        user: user,
        pass: pass
      }
    });
    return transporter;
  } catch (err) {
    console.error('Error al inicializar transporte SMTP:', err.message);
    return null;
  }
}

/**
 * Enviar código de 6 dígitos para recuperación de contraseña
 * @param {string} email Destinatario
 * @param {string} codigo Código numérico de 6 dígitos
 * @param {string} nombre Nombre o rol del usuario
 */
async function enviarCodigoRecuperacion(email, codigo, nombre = 'Profesional de la Salud') {
  const mailTransport = obtenerTransporter();
  const remitente = process.env.EMAIL_FROM || '"Elite Foot Care — Seguridad Clínica" <seguridad@elitefoot.com>';

  // Plantilla HTML Clínica Profesional
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
      <div style="background-color: #111827; padding: 28px 32px; text-align: center; border-bottom: 3px solid #f69251;">
        <h1 style="color: #ffffff; font-size: 22px; margin: 0; font-weight: 700; letter-spacing: -0.02em;">
          ELITE FOOT CARE
        </h1>
        <p style="color: #9ca3af; font-size: 13px; margin: 6px 0 0; text-transform: uppercase; letter-spacing: 0.08em;">
          Gestión Clínica y Gobernanza Podológica
        </p>
      </div>

      <div style="padding: 36px 32px; color: #1f2937;">
        <h2 style="color: #111827; font-size: 19px; margin-top: 0; margin-bottom: 12px; font-weight: 600;">
          Código de Verificación de Seguridad
        </h2>
        <p style="font-size: 15px; line-height: 1.6; color: #4b5563; margin-bottom: 24px;">
          Hola, <strong>${nombre}</strong>. Hemos recibido una solicitud para restablecer la contraseña de acceso a tu terminal clínica profesional asociada al correo <code>${email}</code>.
        </p>

        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; font-weight: 600; display: block; margin-bottom: 8px;">
            Tu código de confirmación temporal
          </span>
          <span style="font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #111827; display: block; font-family: monospace;">
            ${codigo}
          </span>
          <span style="font-size: 12px; color: #ef4444; font-weight: 500; display: block; margin-top: 10px;">
            ⏱ Válido únicamente por 15 minutos
          </span>
        </div>

        <p style="font-size: 14px; line-height: 1.5; color: #6b7280; margin-bottom: 20px;">
          Ingresa este código de 6 dígitos en la pantalla de recuperación para autenticar tu identidad y definir tu nueva contraseña confidencial.
        </p>

        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; font-size: 12px; color: #9ca3af; line-height: 1.5;">
          <strong>Nota de Seguridad:</strong> Si tú no solicitaste este cambio, puedes ignorar este mensaje. Tus credenciales actuales siguen protegidas por cifrado criptográfico.
        </div>
      </div>

      <div style="background-color: #f9fafb; padding: 18px 32px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
        © 2026 Elite Foot Care — Sistema Clínico Especializado en Salud Podológica.
      </div>
    </div>
  `;

  if (mailTransport) {
    try {
      const info = await mailTransport.sendMail({
        from: remitente,
        to: email,
        subject: `🔐 Tu código de recuperación de contraseña: ${codigo} - Elite Foot Care`,
        text: `Hola ${nombre}, tu código de recuperación para Elite Foot Care es: ${codigo}. Es válido por 15 minutos.`,
        html: htmlContent
      });
      console.log(`📧 [EMAIL ENVIADO] Código ${codigo} enviado exitosamente a ${email} (MessageID: ${info.messageId})`);
      return { ok: true, enviado: true, messageId: info.messageId };
    } catch (sendError) {
      console.error(`⚠️ [EMAIL ERROR] Falló envío real a ${email}:`, sendError.message);
      // Fallback a consola en caso de fallo SMTP para no interrumpir el flujo
      imprimirCodigoConsola(email, codigo, nombre);
      return { ok: true, enviado: false, error: sendError.message, simulado: true };
    }
  } else {
    imprimirCodigoConsola(email, codigo, nombre);
    return { ok: true, enviado: false, simulado: true };
  }
}

function imprimirCodigoConsola(email, codigo, nombre) {
  console.log('\n================================================================');
  console.log('📧 [MODO SIMULACIÓN - CORREO DE RECUPERACIÓN]');
  console.log(`Para: ${email} (${nombre})`);
  console.log(`🔑 CÓDIGO DE 6 DÍGITOS: >>> ${codigo} <<<`);
  console.log('⏱ Válido por: 15 minutos');
  console.log('💡 TIP: Para envío real, configura SMTP_USER y SMTP_PASS en backend/.env');
  console.log('================================================================\n');
}

module.exports = {
  enviarCodigoRecuperacion
};
