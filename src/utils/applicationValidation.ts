import { z } from 'zod';
import { ApplicationStatus } from '@prisma/client';

export const createApplicationSchema = z.object({
  company: z.string()
    .min(1, 'Le nom de l\'entreprise est requis')
    .max(100, 'Le nom de l\'entreprise ne peut pas dépasser 100 caractères'),
  position: z.string()
    .min(1, 'Le poste est requis')
    .max(100, 'Le poste ne peut pas dépasser 100 caractères'),
  status: z.nativeEnum(ApplicationStatus).optional().default(ApplicationStatus.APPLIED),
  appliedAt: z.string().datetime().optional(),
  notes: z.string().max(1000, 'Les notes ne peuvent pas dépasser 1000 caractères').optional(),
  salary: z.string().max(50, 'Le salaire ne peut pas dépasser 50 caractères').optional(),
  location: z.string().max(100, 'La localisation ne peut pas dépasser 100 caractères').optional(),
  jobUrl: z.string().url('URL invalide').optional().or(z.literal('')),
  contactName: z.string().max(100, 'Le nom du contact ne peut pas dépasser 100 caractères').optional(),
  contactEmail: z.string().email('Email invalide').optional().or(z.literal('')),
});

export const updateApplicationSchema = createApplicationSchema.partial();

export const applicationQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0, 'La page doit être supérieure à 0').optional().default('1'),
  limit: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0 && val <= 100, 'La limite doit être entre 1 et 100').optional().default('10'),
  status: z.nativeEnum(ApplicationStatus).optional(),
  company: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['appliedAt', 'company', 'position', 'status', 'createdAt']).optional().default('appliedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type ApplicationQuery = z.infer<typeof applicationQuerySchema>;