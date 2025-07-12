import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import VerificationService from '../services/verificationService';
import { CreateVerificationCodeRequest, VerifyCodeRequest, VerificationErrors } from '../types/verification';
import { prisma } from '../config/database';
import { z } from 'zod';

// Schémas de validation
const createCodeSchema = z.object({
  type: z.enum(['EMAIL_VERIFICATION', 'PASSWORD_RESET', 'TWO_FACTOR_AUTH', 'PHONE_VERIFICATION', 'ACCOUNT_DELETION', 'SENSITIVE_ACTION']),
  method: z.enum(['EMAIL', 'SMS']),
  target: z.string().min(1, 'Destinataire requis'),
  metadata: z.any().optional()
});

const verifyCodeSchema = z.object({
  code: z.string().length(6, 'Le code doit contenir 6 chiffres').regex(/^\d{6}$/, 'Le code doit être numérique'),
  type: z.enum(['EMAIL_VERIFICATION', 'PASSWORD_RESET', 'TWO_FACTOR_AUTH', 'PHONE_VERIFICATION', 'ACCOUNT_DELETION', 'SENSITIVE_ACTION'])
});

/**
 * Créer et envoyer un code de vérification
 */
export const createVerificationCode = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: VerificationErrors.USER_NOT_FOUND,
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    // Validation des données
    const validatedData = createCodeSchema.parse(req.body);
    const { type, method, target, metadata } = validatedData;

    // Vérifications de sécurité selon le type
    const validationResult = await validateCodeRequest(req.user.id, type, method, target);
    if (!validationResult.isValid) {
      res.status(400).json({
        success: false,
        message: validationResult.message,
        code: validationResult.code
      });
      return;
    }

    // Créer et envoyer le code
    const result = await VerificationService.createAndSendCode({
      userId: req.user.id,
      type,
      method,
      target,
      metadata
    });

    const statusCode = result.success ? 200 : 429; // 429 pour rate limiting

    res.status(statusCode).json({
      success: result.success,
      message: result.message,
      nextAllowedAt: result.nextAllowedAt?.toISOString(),
      data: result.success ? {
        type,
        method,
        target: maskTarget(target, method),
        expiresIn: getExpirationMinutes(type)
      } : null
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: 'Données invalides',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        })),
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    console.error('Erreur création code de vérification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Vérifier un code de vérification
 */
export const verifyCode = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: VerificationErrors.USER_NOT_FOUND,
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    // Validation des données
    const validatedData = verifyCodeSchema.parse(req.body);
    const { code, type } = validatedData;

    // Vérifier le code
    const result = await VerificationService.verifyCode(req.user.id, code, type);

    const statusCode = result.success ? 200 : 400;

    res.status(statusCode).json({
      success: result.success,
      message: result.message,
      data: result.success ? {
        type,
        verifiedAt: new Date().toISOString()
      } : null
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: 'Données invalides',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        })),
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    console.error('Erreur vérification code:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Obtenir les méthodes de vérification disponibles pour l'utilisateur
 */
export const getVerificationMethods = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: VerificationErrors.USER_NOT_FOUND,
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { notificationSettings: true }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: VerificationErrors.USER_NOT_FOUND,
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    const availableMethods = ['EMAIL'];
    if (user.notificationSettings?.phoneNumber) {
      availableMethods.push('SMS');
    }

    res.json({
      success: true,
      message: 'Méthodes de vérification récupérées',
      data: {
        email: maskTarget(user.email, 'EMAIL'),
        phoneNumber: user.notificationSettings?.phoneNumber 
          ? maskTarget(user.notificationSettings.phoneNumber, 'SMS')
          : null,
        availableMethods,
        preferredMethod: user.notificationSettings?.smsEnabled && user.notificationSettings?.phoneNumber 
          ? 'SMS' 
          : 'EMAIL'
      }
    });

  } catch (error) {
    console.error('Erreur récupération méthodes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Obtenir l'historique des codes de vérification (pour debug/admin)
 */
export const getVerificationHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: VerificationErrors.USER_NOT_FOUND,
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    // Seuls les admins peuvent voir l'historique complet
    if (req.user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
        code: 'FORBIDDEN'
      });
      return;
    }

    const targetUserId = req.params.userId || req.user.id;

    const codes = await prisma.verificationCode.findMany({
      where: { userId: targetUserId },
      select: {
        id: true,
        type: true,
        method: true,
        target: true,
        expiresAt: true,
        attempts: true,
        maxAttempts: true,
        isUsed: true,
        usedAt: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limiter à 50 derniers codes
    });

    const attempts = await prisma.verificationAttempt.findMany({
      where: { userId: targetUserId },
      select: {
        type: true,
        method: true,
        target: true,
        sentAt: true,
        nextAllowedAt: true
      },
      orderBy: { sentAt: 'desc' },
      take: 20 // Limiter à 20 dernières tentatives
    });

    res.json({
      success: true,
      message: 'Historique récupéré',
      data: {
        codes: codes.map(code => ({
          ...code,
          target: maskTarget(code.target, code.method)
        })),
        attempts: attempts.map(attempt => ({
          ...attempt,
          target: maskTarget(attempt.target, attempt.method)
        }))
      }
    });

  } catch (error) {
    console.error('Erreur récupération historique:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Vérifier le statut de rate limiting pour un utilisateur
 */
export const checkRateLimit = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: VerificationErrors.USER_NOT_FOUND,
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    const { type, method, target } = req.query;

    if (!type || !method || !target) {
      res.status(400).json({
        success: false,
        message: 'Paramètres manquants (type, method, target)',
        code: 'MISSING_PARAMETERS'
      });
      return;
    }

    const canSend = await VerificationService.canSendCode(
      req.user.id,
      type as any,
      method as any,
      target as string
    );

    res.json({
      success: true,
      message: 'Statut de rate limiting récupéré',
      data: {
        canSend: canSend.canSend,
        nextAllowedAt: canSend.nextAllowedAt?.toISOString(),
        message: canSend.message
      }
    });

  } catch (error) {
    console.error('Erreur vérification rate limit:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

// === FONCTIONS UTILITAIRES ===

/**
 * Valider une demande de code selon le type et le contexte
 */
async function validateCodeRequest(
  userId: string, 
  type: string, 
  method: string, 
  target: string
): Promise<{ isValid: boolean; message?: string; code?: string }> {
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { notificationSettings: true }
  });

  if (!user) {
    return { isValid: false, message: VerificationErrors.USER_NOT_FOUND, code: 'USER_NOT_FOUND' };
  }

  // Validation selon la méthode
  if (method === 'EMAIL') {
    // Vérifier que l'email correspond à celui de l'utilisateur ou est autorisé
    if (type === 'EMAIL_VERIFICATION' && target !== user.email) {
      return { isValid: false, message: 'Email non autorisé', code: 'INVALID_TARGET' };
    }
    
    // Pour les autres types, permettre l'email de l'utilisateur
    if (!isValidEmail(target)) {
      return { isValid: false, message: 'Format email invalide', code: 'INVALID_EMAIL' };
    }
  }

  if (method === 'SMS') {
    // Vérifier que l'utilisateur a un numéro configuré
    if (!user.notificationSettings?.phoneNumber) {
      return { isValid: false, message: 'Numéro de téléphone non configuré', code: 'NO_PHONE_NUMBER' };
    }

    // Pour la vérification de téléphone, permettre un nouveau numéro
    if (type !== 'PHONE_VERIFICATION' && target !== user.notificationSettings.phoneNumber) {
      return { isValid: false, message: 'Numéro non autorisé', code: 'INVALID_TARGET' };
    }

    if (!isValidPhoneNumber(target)) {
      return { isValid: false, message: 'Format de numéro invalide', code: 'INVALID_PHONE' };
    }
  }

  // Validations spécifiques par type
  switch (type) {
    case 'EMAIL_VERIFICATION':
      if (user.emailVerified && target === user.email) {
        return { isValid: false, message: 'Email déjà vérifié', code: 'ALREADY_VERIFIED' };
      }
      break;

    case 'PASSWORD_RESET':
      // Toujours autoriser (même si l'utilisateur est connecté)
      break;

    case 'TWO_FACTOR_AUTH':
      // Vérifier si 2FA est activé pour l'utilisateur
      // Note: Tu pourrais ajouter un champ 2FA dans le modèle User
      break;

    case 'ACCOUNT_DELETION':
      // Vérifier que le compte peut être supprimé
      if (!user.isActive) {
        return { isValid: false, message: 'Compte déjà désactivé', code: 'ACCOUNT_INACTIVE' };
      }
      break;
  }

  return { isValid: true };
}

/**
 * Masquer partiellement un email ou numéro de téléphone
 */
function maskTarget(target: string, method: string): string {
  if (method === 'EMAIL') {
    const [localPart, domain] = target.split('@');
    if (localPart.length <= 2) {
      return `${localPart[0]}*@${domain}`;
    }
    return `${localPart.substring(0, 2)}****@${domain}`;
  }
  
  if (method === 'SMS') {
    if (target.length <= 4) {
      return `****${target.slice(-2)}`;
    }
    return `****${target.slice(-4)}`;
  }
  
  return target;
}

/**
 * Obtenir la durée d'expiration en minutes selon le type
 */
function getExpirationMinutes(type: string): number {
  const expirationTimes: Record<string, number> = {
    EMAIL_VERIFICATION: 60 * 24, // 24 heures
    PASSWORD_RESET: 15,          // 15 minutes
    TWO_FACTOR_AUTH: 5,          // 5 minutes
    PHONE_VERIFICATION: 10,      // 10 minutes
    ACCOUNT_DELETION: 30,        // 30 minutes
    SENSITIVE_ACTION: 10,        // 10 minutes
  };
  
  return expirationTimes[type] || 15;
}

/**
 * Valider un format d'email
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valider un format de numéro de téléphone
 */
function isValidPhoneNumber(phone: string): boolean {
  // Format international basique (peut être affiné selon tes besoins)
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
  return phoneRegex.test(phone);
}