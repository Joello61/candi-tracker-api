import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Erreur capturée:', err);

  // Erreur de validation Zod
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Données invalides',
      details: err.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message
      })),
      code: 'VALIDATION_ERROR'
    });
    return;
  }

  // Erreur Prisma
  if (err.name === 'PrismaClientKnownRequestError') {
    res.status(400).json({
      error: 'Erreur de base de données',
      code: 'DATABASE_ERROR'
    });
    return;
  }

  // Erreur personnalisée
  if (err.statusCode) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code || 'CUSTOM_ERROR'
    });
    return;
  }

  // Erreur par défaut
  res.status(500).json({
    error: 'Erreur interne du serveur',
    code: 'INTERNAL_ERROR'
  });
};