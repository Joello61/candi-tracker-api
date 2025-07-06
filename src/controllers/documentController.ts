import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { DocumentService } from '../services/documentService';
import {
  uploadDocumentSchema,
  updateDocumentSchema,
  documentQuerySchema,
  UploadDocumentInput,
  UpdateDocumentInput,
} from '../utils/documentValidation';
import { ZodError } from 'zod';
import path from 'path';

export const uploadDocuments = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
      res.status(400).json({
        error: 'Aucun fichier fourni',
        code: 'NO_FILES',
      });
      return;
    }

    const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
    const validatedData = uploadDocumentSchema.parse(req.body);

    const result = await DocumentService.uploadDocuments(
      req.userId,
      files as Express.Multer.File[],
      validatedData
    );

    if (!result.success) {
      res.status(400).json({
        error: 'Échec de l\'upload',
        details: result.errors,
        code: 'UPLOAD_FAILED',
      });
      return;
    }

    res.status(201).json({
      message: 'Documents uploadés avec succès',
      data: {
        documents: result.documents,
        errors: result.errors,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Données invalides',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    console.error('Erreur lors de l\'upload:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const getDocuments = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    const queryParams = documentQuerySchema.parse(req.query);
    
    const {
      page,
      limit,
      type,
      applicationId,
      search,
      sortBy,
      sortOrder,
    } = queryParams;

    const filters = {
      type,
      applicationId,
      search,
      sortBy,
      sortOrder,
    };

    const result = await DocumentService.getDocuments(
      req.userId,
      filters,
      page,
      limit
    );

    res.json({
      message: 'Documents récupérés avec succès',
      data: result,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Paramètres de requête invalides',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    console.error('Erreur lors de la récupération des documents:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const getDocumentById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: 'ID de document requis',
        code: 'MISSING_ID',
      });
      return;
    }

    const document = await DocumentService.getDocumentById(req.userId, id);

    if (!document) {
      res.status(404).json({
        error: 'Document non trouvé',
        code: 'DOCUMENT_NOT_FOUND',
      });
      return;
    }

    res.json({
      message: 'Document récupéré avec succès',
      data: { document },
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du document:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const downloadDocument = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: 'ID de document requis',
        code: 'MISSING_ID',
      });
      return;
    }

    const result = await DocumentService.downloadDocument(req.userId, id);

    if (!result) {
      res.status(404).json({
        error: 'Document non trouvé',
        code: 'DOCUMENT_NOT_FOUND',
      });
      return;
    }

    // Définir les headers pour le téléchargement
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // Envoyer le fichier
    res.sendFile(path.resolve(result.filePath));

  } catch (error) {
    console.error('Erreur lors du téléchargement:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const updateDocument = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: 'ID de document requis',
        code: 'MISSING_ID',
      });
      return;
    }

    const validatedData = updateDocumentSchema.parse(req.body);

    const document = await DocumentService.updateDocument(
      req.userId,
      id,
      validatedData
    );

    if (!document) {
      res.status(404).json({
        error: 'Document non trouvé',
        code: 'DOCUMENT_NOT_FOUND',
      });
      return;
    }

    res.json({
      message: 'Document mis à jour avec succès',
      data: { document },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Données invalides',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    console.error('Erreur lors de la mise à jour du document:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const deleteDocument = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: 'ID de document requis',
        code: 'MISSING_ID',
      });
      return;
    }

    const success = await DocumentService.deleteDocument(req.userId, id);

    if (!success) {
      res.status(404).json({
        error: 'Document non trouvé',
        code: 'DOCUMENT_NOT_FOUND',
      });
      return;
    }

    res.json({
      message: 'Document supprimé avec succès',
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du document:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const getDocumentStats = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    const stats = await DocumentService.getDocumentStats(req.userId);

    res.json({
      message: 'Statistiques des documents récupérées avec succès',
      data: { stats },
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const getDocumentsByApplication = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    const { applicationId } = req.params;

    if (!applicationId) {
      res.status(400).json({
        error: 'ID de candidature requis',
        code: 'MISSING_APPLICATION_ID',
      });
      return;
    }

    const documents = await DocumentService.getDocumentsByApplication(
      req.userId,
      applicationId
    );

    res.json({
      message: 'Documents de la candidature récupérés avec succès',
      data: { documents },
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des documents:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const bulkDeleteDocuments = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    const { documentIds } = req.body;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      res.status(400).json({
        error: 'Liste d\'IDs de documents requise',
        code: 'MISSING_DOCUMENT_IDS',
      });
      return;
    }

    const result = await DocumentService.bulkDelete(req.userId, documentIds);

    res.json({
      message: `${result.deleted} document(s) supprimé(s) avec succès`,
      data: {
        deleted: result.deleted,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error('Erreur lors de la suppression multiple:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};