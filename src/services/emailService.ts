import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

// Configuration du transporteur email
// Configuration du transporteur email
const createTransporter = () => {
  // Utiliser les variables d'environnement pour la configuration
  // Pour Gmail, vous pouvez utiliser OAuth2 ou un mot de passe d'application
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true', // true pour 465, false pour les autres ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
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
    to: recipients.join(', '), // Nodemailer accepte une liste séparée par des virgules
    subject: `🔔 Nouvelle inscription - ${userData.firstName || ''} ${userData.lastName || ''}`,
    html
  });
};
