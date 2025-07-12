import { Request } from 'express';
import { UserRole } from '@prisma/client';

// Interface pour l'utilisateur authentifié
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

// Étendre l'interface Request d'Express pour ajouter nos propriétés
export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: AuthUser;
}

// Interface pour la réponse d'authentification traditionnelle
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;        
    isActive: boolean;     
    emailVerified: boolean; 
  };
  token: string;
}

// === NOUVEAUX TYPES POUR LA 2FA ===

// Réponse lors de la connexion avec 2FA activée
export interface Auth2FAResponse {
  requires2FA: boolean;
  userId: string;
  email: string;
  step: '2FA_VERIFICATION';
}

// Réponse lors de l'inscription nécessitant une vérification email
export interface AuthEmailVerificationResponse {
  requiresEmailVerification: boolean;
  email: string;
  userId: string;
}

// Interface pour les requêtes de vérification
export interface VerifyEmailRequest {
  userId: string;
  code: string;
}

export interface Verify2FARequest {
  userId: string;
  code: string;
}

export interface ResendCodeRequest {
  userId: string;
  type: 'EMAIL_VERIFICATION' | 'TWO_FACTOR_AUTH';
}

// Réponses unifiées selon le flow d'authentification
export type LoginResponse = 
  | { message: string; data: AuthResponse }                          // Connexion directe réussie
  | { message: string; data: Auth2FAResponse }                       // 2FA requis
  | { message: string; data: AuthEmailVerificationResponse }         // Email non vérifié

export type RegisterResponse = 
  | { message: string; data: AuthResponse }                          // Inscription + connexion directe (ancien comportement)
  | { message: string; data: AuthEmailVerificationResponse }         // Inscription + vérification email requise (nouveau comportement)

// Types pour les étapes du processus d'authentification
export enum AuthStep {
  LOGIN = 'LOGIN',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  TWO_FACTOR_AUTH = 'TWO_FACTOR_AUTH',
  COMPLETED = 'COMPLETED',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',      // NOUVEAU
  RESET_PASSWORD = 'RESET_PASSWORD',     // NOUVEAU
}

export interface AuthFlowState {
  step: AuthStep;
  userId?: string;
  email?: string;
  requires2FA?: boolean;
  requiresEmailVerification?: boolean;
}

// Types pour les erreurs d'authentification spécifiques
export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  SOCIAL_ACCOUNT_ONLY = 'SOCIAL_ACCOUNT_ONLY',
  INVALID_VERIFICATION_CODE = 'INVALID_VERIFICATION_CODE',
  INVALID_2FA_CODE = 'INVALID_2FA_CODE',
  TWO_FACTOR_SEND_ERROR = 'TWO_FACTOR_SEND_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  NOT_AUTHENTICATED = 'NOT_AUTHENTICATED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export interface AuthError {
  error: string;
  code: AuthErrorCode;
  data?: any;
}

// Types pour les réponses de vérification
export interface VerificationSuccessResponse {
  message: string;
  data: AuthResponse;
}

export interface VerificationErrorResponse {
  error: string;
  code: AuthErrorCode;
}

export interface ResendCodeResponse {
  message: string;
  data?: {
    nextAllowedAt?: string;
  };
}

export interface ForgotPasswordRequest {
  email: string;
}

// Requête de réinitialisation avec code
export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

// Requête de vérification de code de réinitialisation
export interface VerifyResetCodeRequest {
  email: string;
  code: string;
}

// Réponse de demande de réinitialisation
export interface ForgotPasswordResponse {
  message: string;
  data: {
    email: string;
    codeRequested: boolean;
  };
}

// Réponse de réinitialisation réussie
export interface ResetPasswordResponse {
  message: string;
  data: AuthResponse; // L'utilisateur est automatiquement connecté
}

// Réponse de vérification de code
export interface VerifyResetCodeResponse {
  message: string;
  data: {
    valid: boolean;
    expiresAt: string;
    remainingAttempts: number;
  };
}

// Codes d'erreur spécifiques au reset password
export enum PasswordResetErrorCode {
  INVALID_RESET_CODE = 'INVALID_RESET_CODE',
  TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS',
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
  EMAIL_NOT_FOUND = 'EMAIL_NOT_FOUND',
}

// État du flow forgot password
export interface ForgotPasswordFlowState {
  step: AuthStep.FORGOT_PASSWORD | AuthStep.RESET_PASSWORD;
  email?: string;
  codeRequested?: boolean;
  codeVerified?: boolean;
}

// Réponses d'erreur spécifiques
export interface ForgotPasswordErrorResponse {
  error: string;
  code: PasswordResetErrorCode | AuthErrorCode;
}

export interface ResetPasswordErrorResponse {
  error: string;
  code: PasswordResetErrorCode | AuthErrorCode;
}

// Étendre l'interface Express User pour Passport (OAuth)
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      isActive: boolean;
      emailVerified?: boolean;
      googleId?: string;
      linkedinId?: string;
      provider?: string;
      providerId?: string;
    }
  }
}