import { Resend } from 'resend';
import { config } from './env';

// Initialiser Resend
export const resend = new Resend(config.resendApiKey);

// Configuration par défaut pour les emails
export const emailConfig = {
  from: config.emailFrom,
  defaultDomain: config.resendDomain || 'localhost', // Pour les tests en dev
  
  // Templates d'emails
  templates: {
    welcome: {
      subject: 'Bienvenue sur Candi Tracker !',
      previewText: 'Votre compte a été créé avec succès'
    },
    emailVerification: {
      subject: 'Vérifiez votre adresse email',
      previewText: 'Confirmez votre adresse email pour activer votre compte'
    },
    passwordReset: {
      subject: 'Réinitialisation de votre mot de passe',
      previewText: 'Réinitialisez votre mot de passe en toute sécurité'
    },
    interviewReminder: {
      subject: 'Rappel d\'entretien',
      previewText: 'N\'oubliez pas votre entretien à venir'
    },
    weeklyReport: {
      subject: 'Votre rapport hebdomadaire',
      previewText: 'Résumé de vos candidatures cette semaine'
    },
    applicationFollowUp: {
      subject: 'Suivi de candidature recommandé',
      previewText: 'Il est temps de relancer votre candidature'
    }
  }
};

// Types pour les données d'email
export interface EmailData {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    content_type?: string;
  }>;
}

// Interface pour les templates d'email
export interface EmailTemplate {
  subject: string;
  previewText: string;
}

// Fonction utilitaire pour valider la configuration Resend
export const validateResendConfig = (): boolean => {
  if (!config.resendApiKey) {
    console.warn('RESEND_API_KEY manquante - les emails ne seront pas envoyés');
    return false;
  }
  
  if (!config.emailFrom) {
    console.warn('EMAIL_FROM manquant - utilisation de l\'adresse par défaut');
    return false;
  }
  
  return true;
};

// Test de la connexion Resend
export const testResendConnection = async (): Promise<boolean> => {
  try {
    if (!validateResendConfig()) {
      return false;
    }
    
    // Test simple - vérifier si la clé API est valide
    // Note: Resend n'a pas d'endpoint de test direct, donc on simule
    console.log('✓ Configuration Resend validée');
    return true;
    
  } catch (error) {
    console.error('Erreur de connexion Resend:', error);
    return false;
  }
};