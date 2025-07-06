import { z } from 'zod';
import { NotificationType, NotificationPriority } from '@prisma/client';

export const notificationQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0, 'La page doit être supérieure à 0').optional().default('1'),
  limit: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0 && val <= 100, 'La limite doit être entre 1 et 100').optional().default('20'),
  type: z.nativeEnum(NotificationType).optional(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  unreadOnly: z.string().transform(val => val === 'true').optional().default('false'),
  sortBy: z.enum(['createdAt', 'priority', 'type']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const updateNotificationSettingsSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  interviewReminders: z.boolean().optional(),
  applicationFollowUps: z.boolean().optional(),
  weeklyReports: z.boolean().optional(),
  deadlineAlerts: z.boolean().optional(),
  statusUpdates: z.boolean().optional(),
  reminderTiming1: z.number().min(5, 'Minimum 5 minutes').max(10080, 'Maximum 1 semaine (10080 minutes)').optional(), // 5 min à 1 semaine
  reminderTiming2: z.number().min(5, 'Minimum 5 minutes').max(1440, 'Maximum 1 jour (1440 minutes)').optional(),  // 5 min à 1 jour
  reminderTiming3: z.number().min(5, 'Minimum 5 minutes').max(240, 'Maximum 4 heures (240 minutes)').optional(),   // 5 min à 4h
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Format de téléphone invalide (ex: +33123456789)').optional(),
});

export const createNotificationSchema = z.object({
  type: z.nativeEnum(NotificationType, {
    errorMap: () => ({ message: 'Type de notification invalide' })
  }),
  title: z.string()
    .min(1, 'Le titre est requis')
    .max(255, 'Le titre ne peut pas dépasser 255 caractères'),
  message: z.string()
    .min(1, 'Le message est requis')
    .max(1000, 'Le message ne peut pas dépasser 1000 caractères'),
  priority: z.nativeEnum(NotificationPriority).optional().default(NotificationPriority.NORMAL),
  actionUrl: z.string().url('URL invalide').optional(),
  data: z.record(z.any()).optional(),
});

export const bulkMarkReadSchema = z.object({
  notificationIds: z.array(z.string())
    .min(1, 'Au moins un ID de notification requis')
    .max(100, 'Maximum 100 notifications à la fois'),
});

export const bulkDeleteSchema = z.object({
  notificationIds: z.array(z.string())
    .min(1, 'Au moins un ID de notification requis')
    .max(50, 'Maximum 50 notifications à la fois'),
});

export const notificationFiltersSchema = z.object({
  startDate: z.string().datetime('Format de date invalide').optional(),
  endDate: z.string().datetime('Format de date invalide').optional(),
  types: z.array(z.nativeEnum(NotificationType)).optional(),
  priorities: z.array(z.nativeEnum(NotificationPriority)).optional(),
  read: z.boolean().optional(),
});

// Types inférés
export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
export type UpdateNotificationSettingsInput = z.infer<typeof updateNotificationSettingsSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type BulkMarkReadInput = z.infer<typeof bulkMarkReadSchema>;
export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;
export type NotificationFilters = z.infer<typeof notificationFiltersSchema>;

// Schémas pour les webhooks et intégrations externes
export const webhookNotificationSchema = z.object({
  userId: z.string().min(1, 'ID utilisateur requis'),
  type: z.nativeEnum(NotificationType),
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(1000),
  data: z.record(z.any()).optional(),
  priority: z.nativeEnum(NotificationPriority).optional().default(NotificationPriority.NORMAL),
  actionUrl: z.string().url().optional(),
  channels: z.object({
    email: z.boolean().optional().default(false),
    sms: z.boolean().optional().default(false),
    push: z.boolean().optional().default(true),
    internal: z.boolean().optional().default(true),
  }).optional(),
});

export type WebhookNotificationInput = z.infer<typeof webhookNotificationSchema>;

// Validation pour les paramètres de notification en batch
export const batchNotificationSettingsSchema = z.object({
  userIds: z.array(z.string()).min(1).max(1000),
  settings: updateNotificationSettingsSchema,
});

export type BatchNotificationSettingsInput = z.infer<typeof batchNotificationSettingsSchema>;

// Validation pour les notifications programmées
export const scheduleNotificationSchema = z.object({
  userId: z.string().min(1, 'ID utilisateur requis'),
  type: z.nativeEnum(NotificationType),
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(1000),
  scheduledAt: z.string().datetime('Format de date invalide'),
  data: z.record(z.any()).optional(),
  priority: z.nativeEnum(NotificationPriority).optional().default(NotificationPriority.NORMAL),
  actionUrl: z.string().url().optional(),
  channels: z.object({
    email: z.boolean().optional().default(false),
    sms: z.boolean().optional().default(false),
    push: z.boolean().optional().default(true),
    internal: z.boolean().optional().default(true),
  }).optional(),
});

export type ScheduleNotificationInput = z.infer<typeof scheduleNotificationSchema>;

// Validation pour les templates de notification
export const notificationTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.nativeEnum(NotificationType),
  titleTemplate: z.string().min(1).max(255),
  messageTemplate: z.string().min(1).max(1000),
  emailTemplate: z.string().optional(),
  smsTemplate: z.string().max(160).optional(), // Limite SMS
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional().default(true),
});

export type NotificationTemplateInput = z.infer<typeof notificationTemplateSchema>;

// Validation pour les règles de notification automatique
export const notificationRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  trigger: z.enum([
    'APPLICATION_CREATED',
    'APPLICATION_UPDATED',
    'INTERVIEW_CREATED',
    'INTERVIEW_UPDATED',
    'DOCUMENT_UPLOADED',
    'TIME_BASED',
    'STATUS_CHANGE'
  ]),
  conditions: z.record(z.any()),
  notificationTemplate: notificationTemplateSchema,
  isActive: z.boolean().optional().default(true),
  priority: z.nativeEnum(NotificationPriority).optional().default(NotificationPriority.NORMAL),
});

export type NotificationRuleInput = z.infer<typeof notificationRuleSchema>;