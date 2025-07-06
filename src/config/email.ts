import nodemailer from 'nodemailer';
import { config } from './env';

// Configuration du transporteur email
export const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: config.emailHost,
    port: config.emailPort,
    secure: config.emailSecure, // true pour 465, false pour autres ports
    auth: {
      user: config.emailUser,
      pass: config.emailPassword,
    },
  });
};

// Templates d'emails
export const emailTemplates = {
  interviewReminder: {
    subject: '🎯 Rappel: Entretien {company} dans {timeUntil}',
    template: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Rappel d'entretien</h2>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #1e293b;">{{company}} - {{position}}</h3>
          <p style="margin: 10px 0; color: #64748b;">
            <strong>Date:</strong> {{date}}<br>
            <strong>Type:</strong> {{type}}<br>
            <strong>Durée:</strong> {{duration}} minutes
          </p>
          {{#if notes}}
          <p style="margin: 10px 0; color: #64748b;">
            <strong>Notes:</strong> {{notes}}
          </p>
          {{/if}}
          {{#if interviewers}}
          <p style="margin: 10px 0; color: #64748b;">
            <strong>Interviewers:</strong> {{interviewers}}
          </p>
          {{/if}}
        </div>
        <p style="color: #64748b;">Bonne chance ! 🍀</p>
      </div>
    `
  },
  applicationFollowUp: {
    subject: '📋 Suivi de candidature: {company}',
    template: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Suivi de candidature</h2>
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #1e293b;">{{company}} - {{position}}</h3>
          <p style="margin: 10px 0; color: #64748b;">
            Candidature envoyée il y a {{daysSince}} jours.
          </p>
          <p style="margin: 10px 0; color: #64748b;">
            Il serait peut-être temps de faire un suivi ! 📞
          </p>
        </div>
      </div>
    `
  },
  weeklyReport: {
    subject: '📊 Rapport hebdomadaire de vos candidatures',
    template: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">Rapport hebdomadaire</h2>
        <div style="background: #faf5ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Cette semaine:</strong></p>
          <ul>
            <li>{{newApplications}} nouvelles candidatures</li>
            <li>{{interviews}} entretiens programmés</li>
            <li>{{responses}} réponses reçues</li>
          </ul>
          <p><strong>Prochains entretiens:</strong></p>
          {{#each upcomingInterviews}}
          <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 4px;">
            <strong>{{company}}</strong> - {{position}}<br>
            <small>{{date}} à {{time}}</small>
          </div>
          {{/each}}
        </div>
      </div>
    `
  }
};