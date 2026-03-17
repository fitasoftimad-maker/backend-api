import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

// Configuration du transporteur email
// Configuration du transporteur email
const createTransporter = () => {
  // Vérification critique des variables d'environnement
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('❌ ERREUR CRITIQUE: Configuration email manquante (SMTP_USER ou SMTP_PASS)');
    if (process.env.NODE_ENV === 'production') {
      console.error('👉 Veuillez vérifier les variables d\'environnement sur votre plateforme d\'hébergement (Render, etc.)');
    }
    // Ne pas crasher complètement pour permettre le diagnostic, mais loguer l'erreur
  }

  // Utiliser les variables d'environnement pour la configuration
  // Pour Gmail, vous pouvez utiliser OAuth2 ou un mot de passe d'application
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    // Options optimisées pour Gmail sur Render/Cloud
    connectionTimeout: 30000, // Augmenté à 30 secondes comme dans le PHP
    greetingTimeout: 30000,
    socketTimeout: 45000,
    dnsTimeout: 10000,
    // Forcer l'IPv4 car IPv6 pose souvent problème sur Render avec Gmail
    family: 4
  } as any);
};

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@softimad.com',
      to: options.to,
      subject: options.subject,
      html: options.html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email envoyé avec succès:', info.messageId);
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email:', error);
    // Ne pas faire échouer l'inscription si l'email échoue
    throw error;
  }
};

export const sendUserRegistrationEmail = async (userData: {
  firstName?: string;
  lastName?: string;
  email: string;
  cin?: string;
  contractType?: string;
  role: string;
}): Promise<void> => {
  // Récupérer les emails depuis la variable d'environnement ou utiliser les valeurs par défaut
  const adminEmails = process.env.ADMIN_NOTIFICATION_EMAIL || 'fita.softimad@gmail.com,johny.softimad@outlook.com';

  // Convertir en tableau si nécessaire ou laisser comme string (nodemailer gère "email1, email2")
  const recipients = adminEmails.split(',').map(email => email.trim());
  console.log('📧 Envoi de notification aux administrateurs:', recipients);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
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
          <p>Un nouvel utilisateur vient de s'inscrire et nécessite votre validation.</p>
          
          <h3>Informations de l'utilisateur :</h3>
          
          <div class="info-row">
            <span class="label">Nom complet :</span> ${userData.firstName || ''} ${userData.lastName || ''}
          </div>
          
          <div class="info-row">
            <span class="label">Email :</span> ${userData.email}
          </div>
          
          <div class="info-row">
            <span class="label">Rôle :</span> ${userData.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
          </div>
          
          ${userData.cin ? `
          <div class="info-row">
            <span class="label">CIN :</span> ${userData.cin}
          </div>
          ` : ''}
          
          ${userData.contractType ? `
          <div class="info-row">
            <span class="label">Type de contrat :</span> ${userData.contractType}
          </div>
          ` : ''}
          
          <p style="margin-top: 20px;">
            <strong>Action requise :</strong> Veuillez vous connecter au tableau de bord administrateur 
            pour valider ou refuser cette inscription.
          </p>
        </div>
        <div class="footer">
          <p>Cet email a été envoyé automatiquement par le système Softimad.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: recipients.join(','), // Convertir le tableau en chaîne séparée par des virgules
    subject: `🔔 Nouvelle inscription - ${userData.firstName || ''} ${userData.lastName || ''}`,
    html
  });
};

export const sendPasswordResetEmail = async (email: string, resetUrl: string): Promise<void> => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 20px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🔒 Réinitialisation de mot de passe - Softimad</h2>
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
