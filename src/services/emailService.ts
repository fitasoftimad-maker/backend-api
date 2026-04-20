import nodemailer from 'nodemailer'; // ⚠️ gardé (fallback futur)
import axios from 'axios';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

// ✅ Typage réponse PHP
interface EmailApiResponse {
  success: boolean;
  error?: string;
}

// ✅ URL API PHP
const EMAIL_API_URL = 'https://test.softimad.com/api/send-email.php';

// ✅ Clé sécurisée
const EMAIL_API_KEY = process.env.EMAIL_API_KEY || 'MA_CLE_SECRETE_123';

// ❌ Fallback (non utilisé pour l’instant)
const createTransporter = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('❌ ERREUR CRITIQUE: Configuration email manquante');
  }
  return nodemailer.createTransport({});
};

// ==============================
// ✅ ENVOI EMAIL VIA PHP (LWS)
// ==============================
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    console.log('📤 Envoi email vers:', options.to);

    const response = await axios.post<EmailApiResponse>(
      EMAIL_API_URL,
      {
        to: options.to,
        subject: options.subject,
        html: options.html,
        apiKey: EMAIL_API_KEY
      },
      {
        timeout: 10000
      }
    );

    if (!response.data || !response.data.success) {
      console.error('❌ Erreur côté PHP:', response.data);
      throw new Error(response.data?.error || 'Email non envoyé');
    }

    console.log('✅ Email envoyé via LWS');

  } catch (error: any) {
    console.error('❌ Erreur lors de l\'envoi de l\'email:', error.message);
    throw error;
  }
};

// ==============================
// ✅ EMAIL NOUVELLE INSCRIPTION
// ==============================
export const sendUserRegistrationEmail = async (userData: {
  firstName?: string;
  lastName?: string;
  email: string;
  cin?: string;
  contractType?: string;
  role: string;
}): Promise<void> => {

  console.log('🚀 sendUserRegistrationEmail EXECUTÉ');

  const adminEmails =
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    'fita.softimad@gmail.com,johny.softimad@outlook.com';

  // ✅ CORRECTION CRITIQUE ICI
  const recipients = adminEmails
    .split(',')
    .map(email => email.trim())
    .filter(email => email.length > 0);

  console.log('📧 ADMIN RAW:', adminEmails);
  console.log('📧 RECIPIENTS FINAL:', recipients);

  // ❌ Sécurité : aucun destinataire
  if (recipients.length === 0) {
    console.error('❌ Aucun email admin valide');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; }
        .info-row { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
        .label { font-weight: bold; color: #3b82f6; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🔔 Nouvelle Inscription - Softimad</h2>
        </div>
        <div class="content">
          <p>Bonjour,</p>
          <p>Un nouvel utilisateur vient de s'inscrire.</p>

          <div class="info-row">
            <span class="label">Nom :</span> ${userData.firstName || ''} ${userData.lastName || ''}
          </div>

          <div class="info-row">
            <span class="label">Email :</span> ${userData.email}
          </div>

          <div class="info-row">
            <span class="label">Rôle :</span> ${userData.role}
          </div>

          ${userData.cin ? `<div class="info-row"><span class="label">CIN :</span> ${userData.cin}</div>` : ''}

          ${userData.contractType ? `<div class="info-row"><span class="label">Contrat :</span> ${userData.contractType}</div>` : ''}

        </div>
      </div>
    </body>
    </html>
  `;

  // Envoi individuel car l'API PHP ne gère qu'un seul email à la fois (comme le reset)
  for (const recipient of recipients) {
    try {
      await sendEmail({
        to: recipient,
        subject: `🔔 Nouvelle inscription - ${userData.firstName || ''} ${userData.lastName || ''}`,
        html
      });
    } catch (e) {
      console.error(`❌ Erreur envoi email admin vers ${recipient}:`, e);
    }
  }
};

// ==============================
// ✅ EMAIL RESET PASSWORD
// ==============================
export const sendPasswordResetEmail = async (email: string, resetUrl: string): Promise<void> => {

  console.log('🔑 Envoi reset password à:', email);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: auto; padding: 20px; }
        .header { background: #3b82f6; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .button { background: #3b82f6; color: white; padding: 12px 20px; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🔒 Réinitialisation de mot de passe</h2>
        </div>
        <div class="content">
          <p>Bonjour,</p>
          <p>Vous recevez cet email car vous avez demandé la réinitialisation de votre mot de passe pour votre compte Softimad.</p>
          <p>Veuillez cliquer sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable pendant 10 minutes.</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button" style="color: white;">Réinitialiser mon mot de passe</a>
          </div>
          
          <p style="margin-top: 20px;">Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.</p>
        </div>
        <div class="footer">
          <p>Cet email a été envoyé automatiquement par le système Softimad.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: '🔒 Réinitialisation de mot de passe - Softimad',
    html
  });
};