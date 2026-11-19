import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const SIMULAR = process.env.EMAIL_SIMULATE === 'true';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: Number(process.env.EMAIL_PORT) === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Envía un correo o lo simula según EMAIL_SIMULATE
 */
export async function enviarCorreo({ para, asunto, html }) {
  // ===== MODO SIMULACIÓN =====
  if (SIMULAR) {
    console.log('========================================');
    console.log('📧 SIMULACIÓN DE CORREO (no se envió realmente)');
    console.log('Para:     ', para);
    console.log('Asunto:   ', asunto);
    console.log('Contenido:', html?.substring(0, 120) + '...');
    console.log('========================================');
    return { ok: true, simulado: true };
  }

  // ===== ENVÍO REAL =====
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: para,
      subject: asunto,
      html,
    });

    console.log('✅ Correo enviado:', info.messageId);
    return { ok: true, simulado: false, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error al enviar correo:', error.message);
    return { ok: false, error: error.message };
  }
}

/**
 * Plantilla: Solicitud aprobada
 */
export function plantillaAprobada({ nombre, codigo, espacio, fecha, horario }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0F172A;">
      <div style="background:#1E3A5F; color:white; padding:16px 24px; border-radius:8px 8px 0 0;">
        <h2 style="margin:0; font-size:18px;">SGME - Medios Educativos</h2>
        <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">Universidad CESMAG</p>
      </div>
      <div style="border:1px solid #E2E8F0; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
        <p>Hola <strong>${nombre}</strong>,</p>
        <p>Tu solicitud de reserva <strong>${codigo}</strong> ha sido 
          <span style="color:#047857; font-weight:bold;">APROBADA</span>.</p>
        <ul style="line-height:1.8;">
          <li><strong>Espacio:</strong> ${espacio}</li>
          <li><strong>Fecha:</strong> ${fecha}</li>
          <li><strong>Horario:</strong> ${horario}</li>
        </ul>
        <p style="font-size:13px; color:#64748B;">
          Puedes consultar el estado de tu solicitud en cualquier momento con el código asignado.
        </p>
      </div>
    </div>
  `;
}

/**
 * Plantilla: Solicitud rechazada
 */
export function plantillaRechazada({ nombre, codigo, motivo }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0F172A;">
      <div style="background:#1E3A5F; color:white; padding:16px 24px; border-radius:8px 8px 0 0;">
        <h2 style="margin:0; font-size:18px;">SGME - Medios Educativos</h2>
        <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">Universidad CESMAG</p>
      </div>
      <div style="border:1px solid #E2E8F0; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
        <p>Hola <strong>${nombre}</strong>,</p>
        <p>Tu solicitud de reserva <strong>${codigo}</strong> ha sido 
          <span style="color:#B91C1C; font-weight:bold;">RECHAZADA</span>.</p>
        ${motivo ? `<p><strong>Motivo:</strong> ${motivo}</p>` : ''}
        <p style="font-size:13px; color:#64748B;">
          Si tienes dudas, comunícate con el área de Medios Educativos.
        </p>
      </div>
    </div>
  `;
}