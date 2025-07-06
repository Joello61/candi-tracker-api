import { z } from 'zod';
import { InterviewType } from '@prisma/client';

export const createInterviewSchema = z.object({
  applicationId: z.string()
    .min(1, 'L\'ID de candidature est requis'),
  type: z.nativeEnum(InterviewType, {
    errorMap: () => ({ message: 'Type d\'entretien invalide' })
  }),
  scheduledAt: z.string()
    .datetime('Format de date invalide')
    .refine(date => new Date(date) > new Date(), 'La date doit être dans le futur'),
  duration: z.number()
    .min(15, 'La durée minimum est de 15 minutes')
    .max(480, 'La durée maximum est de 8 heures')
    .optional(),
  notes: z.string()
    .max(1000, 'Les notes ne peuvent pas dépasser 1000 caractères')
    .optional(),
  feedback: z.string()
    .max(2000, 'Le feedback ne peut pas dépasser 2000 caractères')
    .optional(),
  interviewers: z.array(z.string().min(1, 'Le nom de l\'interviewer ne peut pas être vide'))
    .max(10, 'Maximum 10 interviewers')
    .optional()
    .default([]),
});

export const updateInterviewSchema = createInterviewSchema.partial().omit({ applicationId: true });

export const interviewQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0, 'La page doit être supérieure à 0').optional().default('1'),
  limit: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0 && val <= 100, 'La limite doit être entre 1 et 100').optional().default('10'),
  type: z.nativeEnum(InterviewType).optional(),
  applicationId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(['scheduledAt', 'type', 'createdAt']).optional().default('scheduledAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  upcoming: z.string().transform(val => val === 'true').optional(),
  past: z.string().transform(val => val === 'true').optional(),
});

export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;
export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>;
export type InterviewQuery = z.infer<typeof interviewQuerySchema>;