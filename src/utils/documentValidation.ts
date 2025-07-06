import { z } from 'zod';
import { DocumentType } from '@prisma/client';

export const uploadDocumentSchema = z.object({
  applicationId: z.string()
    .min(1, 'L\'ID de candidature est requis'),
  name: z.string()
    .min(1, 'Le nom du document est requis')
    .max(255, 'Le nom ne peut pas dépasser 255 caractères'),
  type: z.nativeEnum(DocumentType, {
    errorMap: () => ({ message: 'Type de document invalide' })
  }).optional(),
});

export const updateDocumentSchema = z.object({
  name: z.string()
    .min(1, 'Le nom du document est requis')
    .max(255, 'Le nom ne peut pas dépasser 255 caractères')
    .optional(),
  type: z.nativeEnum(DocumentType, {
    errorMap: () => ({ message: 'Type de document invalide' })
  }).optional(),
});

export const documentQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0).optional().default('1'),
  limit: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0 && val <= 100).optional().default('10'),
  type: z.nativeEnum(DocumentType).optional(),
  applicationId: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'type', 'createdAt', 'size']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type DocumentQuery = z.infer<typeof documentQuerySchema>;