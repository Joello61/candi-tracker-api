import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(50, 'Le nom ne peut pas dépasser 50 caractères'),
  email: z.string()
    .email('Format d\'email invalide')
    .toLowerCase(),
  password: z.string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'),
});

export const loginSchema = z.object({
  email: z.string()
    .email('Format d\'email invalide')
    .toLowerCase(),
  password: z.string()
    .min(1, 'Le mot de passe est requis'),
});

export const forgotPasswordSchema = z.object({
  email: z.string()
    .email('Format d\'email invalide')
    .toLowerCase()
    .min(1, 'Email requis'),
});

// Schéma pour la réinitialisation avec code
export const resetPasswordSchema = z.object({
  email: z.string()
    .email('Format d\'email invalide')
    .toLowerCase()
    .min(1, 'Email requis'),
  code: z.string()
    .length(6, 'Le code doit contenir 6 chiffres')
    .regex(/^\d{6}$/, 'Le code doit être numérique'),
  newPassword: z.string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'),
});

// Schéma pour vérifier un code de réinitialisation (optionnel)
export const verifyResetCodeSchema = z.object({
  email: z.string()
    .email('Format d\'email invalide')
    .toLowerCase(),
  code: z.string()
    .length(6, 'Le code doit contenir 6 chiffres')
    .regex(/^\d{6}$/, 'Le code doit être numérique'),
});


export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyResetCodeInput = z.infer<typeof verifyResetCodeSchema>;