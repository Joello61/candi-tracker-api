import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

export const handleUploadErrors = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        res.status(400).json({
          error: 'Fichier trop volumineux (max 10MB)',
          code: 'FILE_TOO_LARGE',
        });
        return;
      case 'LIMIT_FILE_COUNT':
        res.status(400).json({
          error: 'Trop de fichiers (max 5)',
          code: 'TOO_MANY_FILES',
        });
        return;
      case 'LIMIT_UNEXPECTED_FILE':
        res.status(400).json({
          error: 'Champ de fichier inattendu',
          code: 'UNEXPECTED_FIELD',
        });
        return;
      default:
        res.status(400).json({
          error: 'Erreur d\'upload',
          code: 'UPLOAD_ERROR',
          details: err.message,
        });
        return;
    }
  }

  if (err.message && err.message.includes('Type de fichier non autorisé')) {
    res.status(400).json({
      error: err.message,
      code: 'INVALID_FILE_TYPE',
    });
    return;
  }

  next(err);
};