// src/utils/userValidation.ts
import { z } from 'zod';
import { UserRole } from '@prisma/client';

// Validation pour la mise à jour du profil
export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(50, 'Le nom ne peut pas dépasser 50 caractères')
    .optional(),
  email: z
    .string()
    .email('Format d\'email invalide')
    .optional(),
  avatar: z
    .string()
    .url('URL d\'avatar invalide')
    .optional()
    .or(z.literal(''))
    .or(z.null()),
  // Ces champs ne peuvent être modifiés que par un admin
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
}).refine((data) => {
  // Au moins un champ doit être fourni
  return Object.keys(data).length > 0;
}, {
  message: 'Au moins un champ doit être fourni pour la mise à jour'
});

// Validation pour le changement de mot de passe
export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .optional(),
  newPassword: z
    .string()
    .min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'
    ),
  confirmPassword: z
    .string()
    .min(1, 'La confirmation du mot de passe est requise'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

// Validation pour les paramètres utilisateur (AVEC enabled2FA)
export const updateUserSettingsSchema = z.object({
  theme: z
    .enum(['light', 'dark', 'system'])
    .optional(),
  language: z
    .string()
    .min(2, 'Code de langue invalide')
    .max(5, 'Code de langue trop long')
    .optional(),
  timezone: z
    .string()
    .min(1, 'Timezone requise')
    .optional(),
  dateFormat: z
    .enum(['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'])
    .optional(),
  timeFormat: z
    .enum(['24h', '12h'])
    .optional(),
  sidebarCollapsed: z
    .boolean()
    .optional(),
  itemsPerPage: z
    .number()
    .int()
    .min(5, 'Minimum 5 éléments par page')
    .max(100, 'Maximum 100 éléments par page')
    .optional(),
  defaultApplicationView: z
    .enum(['list', 'grid', 'cards'])
    .optional(),
  showWelcomeMessage: z
    .boolean()
    .optional(),
  defaultDashboardTab: z
    .string()
    .min(1, 'Onglet par défaut requis')
    .optional(),
  // NOUVEAU : Validation pour la 2FA
  enabled2FA: z
    .boolean()
    .optional(),
});

// NOUVELLE VALIDATION : Toggle 2FA
export const toggle2FASchema = z.object({
  enabled: z
    .boolean({
      required_error: 'Le paramètre "enabled" est requis',
      invalid_type_error: 'Le paramètre "enabled" doit être un booléen'
    })
});

// NOUVELLES VALIDATIONS : Vérifications d'authentification
export const verifyEmailSchema = z.object({
  userId: z
    .string()
    .min(1, 'UserId requis'),
  code: z
    .string()
    .length(6, 'Le code doit contenir 6 chiffres')
    .regex(/^\d{6}$/, 'Le code doit être numérique')
});

export const verify2FASchema = z.object({
  userId: z
    .string()
    .min(1, 'UserId requis'),
  code: z
    .string()
    .length(6, 'Le code doit contenir 6 chiffres')
    .regex(/^\d{6}$/, 'Le code doit être numérique')
});

export const resendCodeSchema = z.object({
  userId: z
    .string()
    .min(1, 'UserId requis'),
  type: z
    .enum(['EMAIL_VERIFICATION', 'TWO_FACTOR_AUTH'], {
      errorMap: () => ({ message: 'Type invalide. Utilisez EMAIL_VERIFICATION ou TWO_FACTOR_AUTH' })
    })
});

// Validation pour l'administration des utilisateurs
export const adminUpdateUserSchema = z.object({
  name: z
    .string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(50, 'Le nom ne peut pas dépasser 50 caractères')
    .optional(),
  email: z
    .string()
    .email('Format d\'email invalide')
    .optional(),
  role: z
    .nativeEnum(UserRole)
    .optional(),
  isActive: z
    .boolean()
    .optional(),
  emailVerified: z
    .boolean()
    .optional(),
  avatar: z
    .string()
    .url('URL d\'avatar invalide')
    .optional()
    .or(z.literal(''))
    .or(z.null()),
});

// Validation pour les filtres de recherche d'utilisateurs
export const userFiltersSchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/, 'Page doit être un nombre')
    .transform(Number)
    .refine(val => val > 0, 'Page doit être supérieure à 0')
    .optional(),
  limit: z
    .string()
    .regex(/^\d+$/, 'Limit doit être un nombre')
    .transform(Number)
    .refine(val => val > 0 && val <= 100, 'Limit doit être entre 1 et 100')
    .optional(),
  search: z
    .string()
    .max(100, 'Recherche trop longue')
    .optional(),
  role: z
    .nativeEnum(UserRole)
    .optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform(val => val === 'true')
    .optional(),
  sortBy: z
    .enum(['createdAt', 'name', 'email', 'lastLoginAt', 'role'])
    .optional(),
  sortOrder: z
    .enum(['asc', 'desc'])
    .optional(),
});

// Validation pour l'upload d'avatar
export const avatarUploadSchema = z.object({
  file: z.object({
    mimetype: z
      .string()
      .refine(
        (type) => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type),
        'Format de fichier non supporté. Utilisez JPEG, PNG, WebP ou GIF'
      ),
    size: z
      .number()
      .max(5 * 1024 * 1024, 'La taille du fichier ne peut pas dépasser 5MB'),
  })
});

// NOUVELLES VALIDATIONS : Paramètres de sécurité
export const securitySettingsSchema = z.object({
  enabled2FA: z.boolean().optional(),
  // Futurs paramètres de sécurité peuvent être ajoutés ici
  // enableEmailNotifications: z.boolean().optional(),
  // enableSMSNotifications: z.boolean().optional(),
  // sessionTimeout: z.number().min(5).max(1440).optional(), // en minutes
});

// Types dérivés des schémas
export type UpdateProfileData = z.infer<typeof updateProfileSchema>;
export type ChangePasswordData = z.infer<typeof changePasswordSchema>;
export type UpdateUserSettingsData = z.infer<typeof updateUserSettingsSchema>;
export type Toggle2FAData = z.infer<typeof toggle2FASchema>;
export type VerifyEmailData = z.infer<typeof verifyEmailSchema>;
export type Verify2FAData = z.infer<typeof verify2FASchema>;
export type ResendCodeData = z.infer<typeof resendCodeSchema>;
export type AdminUpdateUserData = z.infer<typeof adminUpdateUserSchema>;
export type UserFiltersData = z.infer<typeof userFiltersSchema>;
export type AvatarUploadData = z.infer<typeof avatarUploadSchema>;
export type SecuritySettingsData = z.infer<typeof securitySettingsSchema>;