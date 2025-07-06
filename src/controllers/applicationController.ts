import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { ApplicationService } from '../services/applicationService';
import {
  createApplicationSchema,
  updateApplicationSchema,
  applicationQuerySchema,
  CreateApplicationInput,
  UpdateApplicationInput,
} from '../utils/applicationValidation';
import { ZodError } from 'zod';

export const createApplication = async (
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

    const validatedData = createApplicationSchema.parse(req.body);
    
    const application = await ApplicationService.createApplication(
      req.userId,
      validatedData
    );

    res.status(201).json({
      message: 'Candidature créée avec succès',
      data: { application },
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

    console.error('Erreur lors de la création de la candidature:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const getApplications = async (
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

    const queryParams = applicationQuerySchema.parse(req.query);
    
    const {
      page,
      limit,
      status,
      company,
      search,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    } = queryParams;

    const filters = {
      status,
      company,
      search,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    };

    const result = await ApplicationService.getApplications(
      req.userId,
      filters,
      page,
      limit
    );

    res.json({
      message: 'Candidatures récupérées avec succès',
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

    console.error('Erreur lors de la récupération des candidatures:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const getApplicationById = async (
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
        error: 'ID de candidature requis',
        code: 'MISSING_ID',
      });
      return;
    }

    const application = await ApplicationService.getApplicationById(
      req.userId,
      id
    );

    if (!application) {
      res.status(404).json({
        error: 'Candidature non trouvée',
        code: 'APPLICATION_NOT_FOUND',
      });
      return;
    }

    res.json({
      message: 'Candidature récupérée avec succès',
      data: { application },
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la candidature:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const updateApplication = async (
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
        error: 'ID de candidature requis',
        code: 'MISSING_ID',
      });
      return;
    }

    const validatedData = updateApplicationSchema.parse(req.body);

    const application = await ApplicationService.updateApplication(
      req.userId,
      id,
      validatedData
    );

    if (!application) {
      res.status(404).json({
        error: 'Candidature non trouvée',
        code: 'APPLICATION_NOT_FOUND',
      });
      return;
    }

    res.json({
      message: 'Candidature mise à jour avec succès',
      data: { application },
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

    console.error('Erreur lors de la mise à jour de la candidature:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const deleteApplication = async (
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
        error: 'ID de candidature requis',
        code: 'MISSING_ID',
      });
      return;
    }

    const success = await ApplicationService.deleteApplication(req.userId, id);

    if (!success) {
      res.status(404).json({
        error: 'Candidature non trouvée',
        code: 'APPLICATION_NOT_FOUND',
      });
      return;
    }

    res.json({
      message: 'Candidature supprimée avec succès',
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de la candidature:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const getApplicationStats = async (
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

    const stats = await ApplicationService.getApplicationStats(req.userId);

    res.json({
      message: 'Statistiques récupérées avec succès',
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

export const getRecentApplications = async (
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

    const limit = parseInt(req.query.limit as string) || 5;
    
    const applications = await ApplicationService.getRecentApplications(
      req.userId,
      limit
    );

    res.json({
      message: 'Candidatures récentes récupérées avec succès',
      data: { applications },
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des candidatures récentes:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};