import { resend, emailConfig, validateResendConfig, EmailData } from '../config/resend';
import { config } from '../config/env';

interface User {
  id: string;
  name: string;
  email: string;
}

interface Interview {
  id: string;
  scheduledAt: string;
  type: string;
  application: {
    company: string;
    position: string;
  };
}

interface Application {
  id: string;
  company: string;
  position: string;
  appliedAt: string;
}

class EmailService {
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = validateResendConfig();
  }

  // Méthode générale d'envoi d'email
  async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        console.warn('Resend non configuré - email non envoyé:', emailData.subject);
        return false;
      }

      const result = await resend.emails.send({
        from: emailConfig.from,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        replyTo: emailData.reply_to,
        cc: emailData.cc,
        bcc: emailData.bcc,
        attachments: emailData.attachments,
      });

      if (result.error) {
        console.error('Erreur Resend:', result.error);
        return false;
      }

      console.log('Email envoyé avec succès:', {
        id: result.data?.id,
        to: emailData.to,
        subject: emailData.subject
      });

      return true;
    } catch (error) {
      console.error('Erreur lors de l\'envoi d\'email:', error);
      return false;
    }
  }

  // Email de bienvenue
  async sendWelcomeEmail(user: User): Promise<boolean> {
    const html = this.generateWelcomeHTML(user);
    const text = this.generateWelcomeText(user);

    return this.sendEmail({
      to: user.email,
      subject: emailConfig.templates.welcome.subject,
      html,
      text
    });
  }

  // Email de vérification d'adresse
  async sendEmailVerification(user: User, verificationToken: string): Promise<boolean> {
    const verificationUrl = `${config.frontendUrl}/auth/verify-email?token=${verificationToken}`;
    const html = this.generateEmailVerificationHTML(user, verificationUrl);
    const text = this.generateEmailVerificationText(user, verificationUrl);

    return this.sendEmail({
      to: user.email,
      subject: emailConfig.templates.emailVerification.subject,
      html,
      text
    });
  }

  // Email de réinitialisation de mot de passe
  async sendPasswordReset(user: User, resetToken: string): Promise<boolean> {
    const resetUrl = `${config.frontendUrl}/auth/reset-password?token=${resetToken}`;
    const html = this.generatePasswordResetHTML(user, resetUrl);
    const text = this.generatePasswordResetText(user, resetUrl);

    return this.sendEmail({
      to: user.email,
      subject: emailConfig.templates.passwordReset.subject,
      html,
      text
    });
  }

  // Rappel d'entretien
  async sendInterviewReminder(user: User, interview: Interview): Promise<boolean> {
    const html = this.generateInterviewReminderHTML(user, interview);
    const text = this.generateInterviewReminderText(user, interview);

    return this.sendEmail({
      to: user.email,
      subject: `${emailConfig.templates.interviewReminder.subject} - ${interview.application.company}`,
      html,
      text
    });
  }

  // Rapport hebdomadaire
  async sendWeeklyReport(user: User, stats: {
    applications: Application[];
    interviews: Interview[];
    totalApplications: number;
    responseRate: number;
  }): Promise<boolean> {
    const html = this.generateWeeklyReportHTML(user, stats);
    const text = this.generateWeeklyReportText(user, stats);

    return this.sendEmail({
      to: user.email,
      subject: emailConfig.templates.weeklyReport.subject,
      html,
      text
    });
  }

  // Suivi de candidature
  async sendApplicationFollowUp(user: User, application: Application): Promise<boolean> {
    const html = this.generateApplicationFollowUpHTML(user, application);
    const text = this.generateApplicationFollowUpText(user, application);

    return this.sendEmail({
      to: user.email,
      subject: `${emailConfig.templates.applicationFollowUp.subject} - ${application.company}`,
      html,
      text
    });
  }

  // ===== GÉNÉRATEURS DE CONTENU HTML =====

  private generateWelcomeHTML(user: User): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bienvenue sur Candi Tracker</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; color: white; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">Bienvenue sur Candi Tracker !</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Votre assistant personnel pour la recherche d'emploi</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #667eea; margin-top: 0;">Bonjour ${user.name} ! 👋</h2>
            <p>Félicitations ! Votre compte Candi Tracker a été créé avec succès. Vous pouvez maintenant :</p>
            
            <ul style="color: #555;">
              <li>Suivre toutes vos candidatures</li>
              <li>Organiser vos entretiens</li>
              <li>Analyser vos statistiques</li>
              <li>Recevoir des rappels automatiques</li>
              <li>Gérer vos documents</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.frontendUrl}/app/dashboard" 
               style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Accéder à mon tableau de bord
            </a>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; text-align: center;">
            <p>Besoin d'aide ? Répondez simplement à cet email, nous sommes là pour vous aider !</p>
            <p>L'équipe Candi Tracker</p>
          </div>
        </body>
      </html>
    `;
  }

  private generateEmailVerificationHTML(user: User, verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Vérifiez votre email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #667eea; padding: 30px; border-radius: 10px; color: white; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">Vérification d'email</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #667eea; margin-top: 0;">Bonjour ${user.name},</h2>
            <p>Pour finaliser la création de votre compte Candi Tracker, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous :</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Vérifier mon email
            </a>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #856404;">
              <strong>Important :</strong> Ce lien expire dans 24 heures pour votre sécurité.
            </p>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666;">
            <p>Si vous n'avez pas créé de compte, ignorez simplement cet email.</p>
            <p>L'équipe Candi Tracker</p>
          </div>
        </body>
      </html>
    `;
  }

  private generatePasswordResetHTML(user: User, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Réinitialisation de mot de passe</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #dc3545; padding: 30px; border-radius: 10px; color: white; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">Réinitialisation de mot de passe</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #dc3545; margin-top: 0;">Bonjour ${user.name},</h2>
            <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Réinitialiser mon mot de passe
            </a>
          </div>
          
          <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #721c24;">
              <strong>Sécurité :</strong> Ce lien expire dans 1 heure. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
            </p>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666;">
            <p>L'équipe Candi Tracker</p>
          </div>
        </body>
      </html>
    `;
  }

  private generateInterviewReminderHTML(user: User, interview: Interview): string {
    const interviewDate = new Date(interview.scheduledAt).toLocaleString('fr-FR');
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Rappel d'entretien</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #17a2b8; padding: 30px; border-radius: 10px; color: white; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">Rappel d'entretien</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #17a2b8; margin-top: 0;">Bonjour ${user.name},</h2>
            <p>N'oubliez pas votre entretien prévu :</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #17a2b8;">
              <h3 style="margin-top: 0; color: #333;">${interview.application.company}</h3>
              <p style="margin: 5px 0;"><strong>Poste :</strong> ${interview.application.position}</p>
              <p style="margin: 5px 0;"><strong>Type :</strong> ${interview.type}</p>
              <p style="margin: 5px 0;"><strong>Date :</strong> ${interviewDate}</p>
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.frontendUrl}/app/interviews/${interview.id}" 
               style="background: #17a2b8; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Voir les détails
            </a>
          </div>
          
          <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #0c5460;">
              <strong>Conseil :</strong> Préparez vos questions et relisez votre CV !
            </p>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; text-align: center;">
            <p>Bonne chance !</p>
            <p>L'équipe Candi Tracker</p>
          </div>
        </body>
      </html>
    `;
  }

  private generateWeeklyReportHTML(user: User, stats: {
    applications: Application[];
    interviews: Interview[];
    totalApplications: number;
    responseRate: number;
  }): string {
    const applicationsList = stats.applications
      .slice(0, 5) // Limiter à 5 dernières candidatures
      .map(app => `
        <div style="background: white; padding: 15px; border-radius: 6px; border-left: 3px solid #28a745; margin-bottom: 10px;">
          <h4 style="margin: 0 0 5px 0; color: #333;">${app.company}</h4>
          <p style="margin: 0; color: #666; font-size: 14px;">${app.position}</p>
          <p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">Candidature envoyée le ${new Date(app.appliedAt).toLocaleDateString('fr-FR')}</p>
        </div>
      `).join('');

    const interviewsList = stats.interviews
      .slice(0, 3) // Limiter à 3 prochains entretiens
      .map(interview => `
        <div style="background: white; padding: 15px; border-radius: 6px; border-left: 3px solid #17a2b8; margin-bottom: 10px;">
          <h4 style="margin: 0 0 5px 0; color: #333;">${interview.application.company}</h4>
          <p style="margin: 0; color: #666; font-size: 14px;">${interview.application.position} - ${interview.type}</p>
          <p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">Prévu le ${new Date(interview.scheduledAt).toLocaleDateString('fr-FR')}</p>
        </div>
      `).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Rapport hebdomadaire</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; border-radius: 10px; color: white; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">Votre rapport hebdomadaire</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Résumé de vos activités cette semaine</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #28a745; margin-top: 0;">Bonjour ${user.name} !</h2>
            <p>Voici un résumé de votre activité de recherche d'emploi cette semaine :</p>
          </div>

          <!-- Statistiques -->
          <div style="display: flex; margin-bottom: 30px;">
            <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; margin-right: 10px; flex: 1; border: 2px solid #e9ecef;">
              <h3 style="margin: 0; font-size: 32px; color: #28a745;">${stats.totalApplications}</h3>
              <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Candidatures totales</p>
            </div>
            <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; margin-left: 10px; flex: 1; border: 2px solid #e9ecef;">
              <h3 style="margin: 0; font-size: 32px; color: #17a2b8;">${stats.responseRate}%</h3>
              <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Taux de réponse</p>
            </div>
          </div>

          <!-- Nouvelles candidatures -->
          ${stats.applications.length > 0 ? `
          <div style="margin-bottom: 30px;">
            <h3 style="color: #28a745; margin-bottom: 15px;">Nouvelles candidatures (${stats.applications.length})</h3>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
              ${applicationsList}
              ${stats.applications.length > 5 ? `
                <p style="text-align: center; margin: 15px 0 0 0; color: #666; font-size: 14px;">
                  et ${stats.applications.length - 5} autres candidatures...
                </p>
              ` : ''}
            </div>
          </div>
          ` : ''}

          <!-- Entretiens à venir -->
          ${stats.interviews.length > 0 ? `
          <div style="margin-bottom: 30px;">
            <h3 style="color: #17a2b8; margin-bottom: 15px;">Entretiens à venir (${stats.interviews.length})</h3>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
              ${interviewsList}
              ${stats.interviews.length > 3 ? `
                <p style="text-align: center; margin: 15px 0 0 0; color: #666; font-size: 14px;">
                  et ${stats.interviews.length - 3} autres entretiens...
                </p>
              ` : ''}
            </div>
          </div>
          ` : ''}

          <!-- Encouragement -->
          <div style="background: #d1edff; border: 1px solid #b3d7ff; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #0056b3;">Continuez sur cette lancée !</h3>
            <p style="margin: 0; color: #0056b3;">
              ${stats.totalApplications > 5 
                ? 'Excellent travail ! Votre persévérance va porter ses fruits.' 
                : 'Chaque candidature vous rapproche de votre objectif. Continuez !'}
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.frontendUrl}/app/dashboard" 
               style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Voir mon tableau de bord complet
            </a>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; text-align: center;">
            <p>Vous recevez ce rapport car vous avez activé les notifications hebdomadaires.</p>
            <p>L'équipe Candi Tracker</p>
          </div>
        </body>
      </html>
    `;
  }

  private generateApplicationFollowUpHTML(user: User, application: Application): string {
    const daysSinceApplication = Math.floor(
      (Date.now() - new Date(application.appliedAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Suivi de candidature</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #ffc107; padding: 30px; border-radius: 10px; color: #000; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">Suivi de candidature</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.8;">Il est temps de relancer !</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #ffc107; margin-top: 0;">Bonjour ${user.name},</h2>
            <p>Il est recommandé de faire un suivi pour votre candidature chez <strong>${application.company}</strong>.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333;">${application.company}</h3>
              <p style="margin: 5px 0;"><strong>Poste :</strong> ${application.position}</p>
              <p style="margin: 5px 0;"><strong>Candidature envoyée :</strong> ${new Date(application.appliedAt).toLocaleDateString('fr-FR')}</p>
              <p style="margin: 5px 0;"><strong>Délai écoulé :</strong> ${daysSinceApplication} jour${daysSinceApplication > 1 ? 's' : ''}</p>
            </div>
          </div>

          <!-- Conseils de relance -->
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #856404;">Conseils pour votre relance</h3>
            <ul style="color: #856404; margin: 0; padding-left: 20px;">
              <li>Rappeler brièvement votre intérêt pour le poste</li>
              <li>Mentionner un élément spécifique de l'entreprise</li>
              <li>Rester poli et professionnel</li>
              <li>Proposer une rencontre ou un entretien téléphonique</li>
            </ul>
          </div>

          <!-- Template de message -->
          <div style="background: #e9ecef; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h4 style="margin-top: 0; color: #495057;">Exemple de message de relance :</h4>
            <div style="background: white; padding: 15px; border-radius: 5px; font-style: italic; color: #666; border-left: 3px solid #6c757d;">
              "Bonjour,<br><br>
              Je me permets de revenir vers vous concernant ma candidature pour le poste de ${application.position} envoyée le ${new Date(application.appliedAt).toLocaleDateString('fr-FR')}.<br><br>
              Je reste très motivé(e) par cette opportunité et serais ravi(e) d'échanger avec vous sur ma candidature.<br><br>
              Cordialement,<br>
              ${user.name}"
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.frontendUrl}/app/applications/${application.id}" 
               style="background: #ffc107; color: #000; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Voir ma candidature
            </a>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; text-align: center;">
            <p>Bonne chance pour votre relance !</p>
            <p>L'équipe Candi Tracker</p>
          </div>
        </body>
      </html>
    `;
  }

  // ===== GÉNÉRATEURS DE CONTENU TEXTE =====

  private generateWelcomeText(user: User): string {
    return `
Bienvenue sur Candi Tracker !

Bonjour ${user.name},

Félicitations ! Votre compte a été créé avec succès.

Vous pouvez maintenant :
- Suivre toutes vos candidatures
- Organiser vos entretiens  
- Analyser vos statistiques
- Recevoir des rappels automatiques
- Gérer vos documents

Accédez à votre tableau de bord : ${config.frontendUrl}/app/dashboard

L'équipe Candi Tracker
    `;
  }

  private generateEmailVerificationText(user: User, verificationUrl: string): string {
    return `
Vérification d'email - Candi Tracker

Bonjour ${user.name},

Pour finaliser la création de votre compte, veuillez confirmer votre adresse email en cliquant sur ce lien :

${verificationUrl}

Ce lien expire dans 24 heures pour votre sécurité.

Si vous n'avez pas créé de compte, ignorez cet email.

L'équipe Candi Tracker
    `;
  }

  private generatePasswordResetText(user: User, resetUrl: string): string {
    return `
Réinitialisation de mot de passe - Candi Tracker

Bonjour ${user.name},

Vous avez demandé la réinitialisation de votre mot de passe.

Cliquez sur ce lien pour créer un nouveau mot de passe :
${resetUrl}

Ce lien expire dans 1 heure.

Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.

L'équipe Candi Tracker
    `;
  }

  private generateInterviewReminderText(user: User, interview: Interview): string {
    const interviewDate = new Date(interview.scheduledAt).toLocaleString('fr-FR');
    
    return `
Rappel d'entretien - Candi Tracker

Bonjour ${user.name},

N'oubliez pas votre entretien :

Entreprise : ${interview.application.company}
Poste : ${interview.application.position}
Type : ${interview.type}
Date : ${interviewDate}

Voir les détails : ${config.frontendUrl}/app/interviews/${interview.id}

Bonne chance !

L'équipe Candi Tracker
    `;
  }

  private generateWeeklyReportText(user: User, stats: any): string {
    return `
Rapport hebdomadaire - Candi Tracker

Bonjour ${user.name},

Voici votre résumé de la semaine :

- ${stats.totalApplications} candidatures envoyées
- ${stats.applications.length} nouvelles candidatures
- ${stats.interviews.length} entretiens programmés
- ${stats.responseRate}% de taux de réponse

Continuez sur cette lancée !

L'équipe Candi Tracker
    `;
  }

  private generateApplicationFollowUpText(user: User, application: Application): string {
    return `
Suivi de candidature recommandé - Candi Tracker

Bonjour ${user.name},

Il est temps de relancer votre candidature chez ${application.company} pour le poste de ${application.position}.

Candidature envoyée le : ${new Date(application.appliedAt).toLocaleDateString('fr-FR')}

Voir la candidature : ${config.frontendUrl}/app/applications/${application.id}

L'équipe Candi Tracker
    `;
  }
}

// Export du service
export const emailService = new EmailService();
export default emailService;