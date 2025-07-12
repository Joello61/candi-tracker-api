import { prisma } from '../config/database';
import { VerificationCodeType, VerificationMethod } from '@prisma/client';
import emailService from './emailService';
import { NotificationService } from './notificationService';
import crypto from 'crypto';

interface VerificationCodeData {
  userId: string;
  type: VerificationCodeType;
  method: VerificationMethod;
  target: string; // Email ou numéro de téléphone
  metadata?: any;
}

interface VerificationResult {
  success: boolean;
  message: string;
  nextAllowedAt?: Date;
  remainingAttempts?: number;
}

export class VerificationService {
  // Délais progressifs pour les renvois (en minutes)
  private static readonly RESEND_DELAYS = [1, 2, 5, 10, 15, 30, 60]; // Minutes
  
  // Durées d'expiration par type (en minutes)
  private static readonly EXPIRATION_TIMES = {
    EMAIL_VERIFICATION: 60 * 24, // 24 heures
    PASSWORD_RESET: 15,          // 15 minutes
    TWO_FACTOR_AUTH: 5,          // 5 minutes
    PHONE_VERIFICATION: 10,      // 10 minutes
    ACCOUNT_DELETION: 30,        // 30 minutes
    SENSITIVE_ACTION: 10,        // 10 minutes
  };

  /**
   * Générer un code à 6 chiffres
   */
  private static generateCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Calculer le délai avant le prochain envoi autorisé
   */
  private static calculateNextDelay(attemptCount: number): number {
    const delayIndex = Math.min(attemptCount, this.RESEND_DELAYS.length - 1);
    return this.RESEND_DELAYS[delayIndex];
  }

  /**
   * Vérifier si l'utilisateur peut envoyer un nouveau code
   */
  static async canSendCode(
    userId: string, 
    type: VerificationCodeType, 
    method: VerificationMethod,
    target: string
  ): Promise<{ canSend: boolean; nextAllowedAt?: Date; message?: string }> {
    try {
      // Chercher la dernière tentative
      const lastAttempt = await prisma.verificationAttempt.findFirst({
        where: {
          userId,
          type,
          method,
          target,
        },
        orderBy: { sentAt: 'desc' }
      });

      if (!lastAttempt) {
        return { canSend: true };
      }

      const now = new Date();
      
      // Vérifier si le délai est écoulé
      if (now >= lastAttempt.nextAllowedAt) {
        return { canSend: true };
      }

      return {
        canSend: false,
        nextAllowedAt: lastAttempt.nextAllowedAt,
        message: `Veuillez attendre avant de renvoyer un code. Prochain envoi autorisé dans ${Math.ceil((lastAttempt.nextAllowedAt.getTime() - now.getTime()) / 60000)} minute(s).`
      };

    } catch (error) {
      console.error('Erreur vérification délai:', error);
      return { canSend: false, message: 'Erreur de validation' };
    }
  }

  /**
   * Créer et envoyer un code de vérification
   */
  static async createAndSendCode(data: VerificationCodeData): Promise<VerificationResult> {
    try {
      // Vérifier si l'utilisateur peut envoyer un code
      const canSend = await this.canSendCode(data.userId, data.type, data.method, data.target);
      
      if (!canSend.canSend) {
        return {
          success: false,
          message: canSend.message || 'Délai d\'attente non écoulé',
          nextAllowedAt: canSend.nextAllowedAt
        };
      }

      // Compter les tentatives précédentes pour calculer le prochain délai
      const attemptCount = await prisma.verificationAttempt.count({
        where: {
          userId: data.userId,
          type: data.type,
          method: data.method,
          target: data.target,
          sentAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Dans les 24 dernières heures
          }
        }
      });

      // Invalider les anciens codes du même type pour cet utilisateur
      await prisma.verificationCode.updateMany({
        where: {
          userId: data.userId,
          type: data.type,
          isUsed: false,
          expiresAt: { gt: new Date() }
        },
        data: { isUsed: true }
      });

      // Générer le nouveau code
      const code = this.generateCode();
      const expirationMinutes = this.EXPIRATION_TIMES[data.type];
      const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

      // Créer le code en base de données
      const verificationCode = await prisma.verificationCode.create({
        data: {
          userId: data.userId,
          code,
          type: data.type,
          method: data.method,
          target: data.target,
          expiresAt,
          metadata: data.metadata
        }
      });

      // Calculer le prochain délai autorisé
      const nextDelayMinutes = this.calculateNextDelay(attemptCount);
      const nextAllowedAt = new Date(Date.now() + nextDelayMinutes * 60 * 1000);

      // Enregistrer la tentative d'envoi
      await prisma.verificationAttempt.create({
        data: {
          userId: data.userId,
          type: data.type,
          method: data.method,
          target: data.target,
          nextAllowedAt
        }
      });

      // Envoyer le code selon la méthode
      const sendResult = await this.sendCode(code, data);

      if (!sendResult) {
        return {
          success: false,
          message: 'Erreur lors de l\'envoi du code'
        };
      }

      console.log(`Code de vérification envoyé: User=${data.userId}, Type=${data.type}, Method=${data.method}`);

      return {
        success: true,
        message: `Code envoyé par ${data.method === 'EMAIL' ? 'email' : 'SMS'}`,
        nextAllowedAt
      };

    } catch (error) {
      console.error('Erreur création/envoi code:', error);
      return {
        success: false,
        message: 'Erreur lors de la création du code'
      };
    }
  }

  /**
   * Envoyer le code selon la méthode choisie
   */
  private static async sendCode(code: string, data: VerificationCodeData): Promise<boolean> {
    try {
      if (data.method === VerificationMethod.EMAIL) {
        return await this.sendCodeByEmail(code, data);
      } else if (data.method === VerificationMethod.SMS) {
        return await this.sendCodeBySMS(code, data);
      }
      return false;
    } catch (error) {
      console.error('Erreur envoi code:', error);
      return false;
    }
  }

  /**
   * Envoyer le code par email
   */
  private static async sendCodeByEmail(code: string, data: VerificationCodeData): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: data.userId },
        select: { name: true, email: true }
      });

      if (!user) return false;

      const subject = this.getEmailSubject(data.type);
      const html = this.generateCodeEmailHTML(code, data.type, user.name);
      const text = this.generateCodeEmailText(code, data.type, user.name);

      return await emailService.sendEmail({
        to: data.target,
        subject,
        html,
        text
      });

    } catch (error) {
      console.error('Erreur envoi email code:', error);
      return false;
    }
  }

  /**
   * Envoyer le code par SMS
   */
  private static async sendCodeBySMS(code: string, data: VerificationCodeData): Promise<boolean> {
    try {
      const message = this.generateSMSMessage(code, data.type);
      
      return await NotificationService.sendSMS({
        to: data.target,
        message
      });

    } catch (error) {
      console.error('Erreur envoi SMS code:', error);
      return false;
    }
  }

  /**
   * Vérifier un code de vérification
   */
  static async verifyCode(
    userId: string,
    code: string,
    type: VerificationCodeType
  ): Promise<VerificationResult> {
    try {
      // Chercher le code valide
      const verificationCode = await prisma.verificationCode.findFirst({
        where: {
          userId,
          code,
          type,
          isUsed: false,
          expiresAt: { gt: new Date() }
        }
      });

      if (!verificationCode) {
        return {
          success: false,
          message: 'Code invalide ou expiré'
        };
      }

      // Vérifier le nombre de tentatives
      if (verificationCode.attempts >= verificationCode.maxAttempts) {
        // Marquer comme utilisé pour empêcher d'autres tentatives
        await prisma.verificationCode.update({
          where: { id: verificationCode.id },
          data: { isUsed: true }
        });

        return {
          success: false,
          message: 'Trop de tentatives. Demandez un nouveau code.'
        };
      }

      // Incrémenter le compteur de tentatives
      await prisma.verificationCode.update({
        where: { id: verificationCode.id },
        data: { 
          attempts: { increment: 1 },
          isUsed: true,
          usedAt: new Date()
        }
      });

      return {
        success: true,
        message: 'Code vérifié avec succès'
      };

    } catch (error) {
      console.error('Erreur vérification code:', error);
      return {
        success: false,
        message: 'Erreur lors de la vérification'
      };
    }
  }

  /**
   * Nettoyer les anciens codes expirés
   */
  static async cleanupExpiredCodes(): Promise<number> {
    try {
      const result = await prisma.verificationCode.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { isUsed: true, createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } // 7 jours
          ]
        }
      });

      console.log(`${result.count} codes de vérification nettoyés`);
      return result.count;
    } catch (error) {
      console.error('Erreur nettoyage codes:', error);
      return 0;
    }
  }

  // === HELPERS POUR LES TEMPLATES ===

  private static getEmailSubject(type: VerificationCodeType): string {
    switch (type) {
      case 'EMAIL_VERIFICATION': return '📧 Vérifiez votre adresse email';
      case 'PASSWORD_RESET': return '🔐 Code de réinitialisation';
      case 'TWO_FACTOR_AUTH': return '🔒 Code d\'authentification';
      case 'PHONE_VERIFICATION': return '📱 Vérification de téléphone';
      case 'ACCOUNT_DELETION': return '⚠️ Confirmation de suppression';
      case 'SENSITIVE_ACTION': return '🔐 Confirmation d\'action sensible';
      default: return '🔢 Code de vérification';
    }
  }

  private static generateCodeEmailHTML(code: string, type: VerificationCodeType, userName: string): string {
    const typeText = this.getTypeDescription(type);
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Code de vérification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #667eea; padding: 30px; border-radius: 10px; color: white; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">🔢 Code de vérification</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #667eea; margin-top: 0;">Bonjour ${userName},</h2>
            <p>${typeText}</p>
            
            <div style="text-align: center; background: #e9ecef; padding: 30px; border-radius: 8px; margin: 25px 0;">
              <div style="font-size: 48px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                ${code}
              </div>
              <p style="margin: 15px 0 0 0; color: #666; font-size: 14px;">
                Ce code expire dans ${this.getExpirationText(type)}
              </p>
            </div>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #856404;">
              <strong>🔒 Sécurité :</strong> Ne partagez jamais ce code. Notre équipe ne vous demandera jamais votre code par téléphone ou email.
            </p>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; text-align: center;">
            <p>Si vous n'avez pas demandé ce code, ignorez cet email.</p>
            <p>L'équipe Candi Tracker</p>
          </div>
        </body>
      </html>
    `;
  }

  private static generateCodeEmailText(code: string, type: VerificationCodeType, userName: string): string {
    return `
Code de vérification - Candi Tracker

Bonjour ${userName},

${this.getTypeDescription(type)}

Votre code de vérification : ${code}

Ce code expire dans ${this.getExpirationText(type)}.

Ne partagez jamais ce code avec qui que ce soit.

L'équipe Candi Tracker
    `;
  }

  private static generateSMSMessage(code: string, type: VerificationCodeType): string {
    return `Candi Tracker: Votre code de vérification est ${code}. Il expire dans ${this.getExpirationText(type)}. Ne le partagez pas.`;
  }

  private static getTypeDescription(type: VerificationCodeType): string {
    switch (type) {
      case 'EMAIL_VERIFICATION': return 'Pour vérifier votre adresse email, utilisez le code ci-dessous :';
      case 'PASSWORD_RESET': return 'Pour réinitialiser votre mot de passe, utilisez le code ci-dessous :';
      case 'TWO_FACTOR_AUTH': return 'Pour compléter votre connexion, utilisez le code ci-dessous :';
      case 'PHONE_VERIFICATION': return 'Pour vérifier votre numéro de téléphone, utilisez le code ci-dessous :';
      case 'ACCOUNT_DELETION': return 'Pour confirmer la suppression de votre compte, utilisez le code ci-dessous :';
      case 'SENSITIVE_ACTION': return 'Pour confirmer cette action sensible, utilisez le code ci-dessous :';
      default: return 'Utilisez le code ci-dessous :';
    }
  }

  private static getExpirationText(type: VerificationCodeType): string {
    const minutes = this.EXPIRATION_TIMES[type];
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      return `${hours} heure${hours > 1 ? 's' : ''}`;
    }
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}

export default VerificationService;