import { VerificationCodeType, VerificationMethod } from '@prisma/client';

export interface CreateVerificationCodeRequest {
  type: VerificationCodeType;
  method: VerificationMethod;
  target: string; // Email ou numéro de téléphone
  metadata?: any;
}

export interface VerifyCodeRequest {
  code: string;
  type: VerificationCodeType;
}

export interface VerificationCodeResponse {
  success: boolean;
  message: string;
  nextAllowedAt?: string; // ISO string
  remainingAttempts?: number;
  expiresAt?: string; // ISO string
}

export interface VerificationCodeInfo {
  id: string;
  type: VerificationCodeType;
  method: VerificationMethod;
  target: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  isUsed: boolean;
  createdAt: Date;
}

export interface VerificationAttemptInfo {
  type: VerificationCodeType;
  method: VerificationMethod;
  target: string;
  sentAt: Date;
  nextAllowedAt: Date;
}

export interface UserVerificationMethods {
  email: string;
  phoneNumber?: string;
  availableMethods: VerificationMethod[];
  preferredMethod?: VerificationMethod;
}

// Énumérations exportées pour le frontend
export const VerificationCodeTypes = {
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION' as VerificationCodeType,
  PASSWORD_RESET: 'PASSWORD_RESET' as VerificationCodeType,
  TWO_FACTOR_AUTH: 'TWO_FACTOR_AUTH' as VerificationCodeType,
  PHONE_VERIFICATION: 'PHONE_VERIFICATION' as VerificationCodeType,
  ACCOUNT_DELETION: 'ACCOUNT_DELETION' as VerificationCodeType,
  SENSITIVE_ACTION: 'SENSITIVE_ACTION' as VerificationCodeType,
};

export const VerificationMethods = {
  EMAIL: 'EMAIL' as VerificationMethod,
  SMS: 'SMS' as VerificationMethod,
};

// Messages d'erreur standardisés
export const VerificationErrors = {
  CODE_EXPIRED: 'Code expiré',
  CODE_INVALID: 'Code invalide',
  TOO_MANY_ATTEMPTS: 'Trop de tentatives',
  RATE_LIMITED: 'Délai d\'attente non écoulé',
  SEND_FAILED: 'Erreur lors de l\'envoi',
  USER_NOT_FOUND: 'Utilisateur non trouvé',
  INVALID_TARGET: 'Destinataire invalide',
  METHOD_NOT_AVAILABLE: 'Méthode non disponible',
};