import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { InterviewService } from '../services/interviewService';
import {
  createInterviewSchema,
  updateInterviewSchema,
  interviewQuerySchema,
  CreateInterviewInput,
  UpdateInterviewInput,
} from '../utils/interviewValidation';
import { ZodError } from 'zod';

export const createInterview = async (
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

    const validatedData = createInterviewSchema.parse(req.body);
    
    const interview = await InterviewService.createInterview(
      req.userId,
      validatedData
    );

    if (!interview) {
      res.status(403).json({
        error: 'Candidature non trouvée ou accès refusé',
        code: 'APPLICATION_NOT_FOUND',
      });
      return;
    }

    res.status(201).json({
      message: 'Entretien créé avec succès',
      data: { interview },
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

    if (error instanceof Error && error.message.includes('déjà programmé')) {
      res.status(409).json({
        error: error.message,
        code: 'SCHEDULING_CONFLICT',
      });
      return;
    }

    console.error('Erreur lors de la création de l\'entretien:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const getInterviews = async (
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

    const queryParams = interviewQuerySchema.parse(req.query);
    
    const {
      page,
      limit,
      type,
      applicationId,
      startDate,
      endDate,
      sortBy,
      sortOrder,
      upcoming,
      past,
    } = queryParams;

    const filters = {
      type,
      applicationId,
      startDate,
      endDate,
      sortBy,
      sortOrder,
      upcoming,
      past,
    };

    const result = await InterviewService.getInterviews(
      req.userId,
      filters,
      page,
      limit
    );

    res.json({
      message: 'Entretiens récupérés avec succès',
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

    console.error('Erreur lors de la récupération des entretiens:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const getInterviewById = async (
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
        error: 'ID d\'entretien requis',
        code: 'MISSING_ID',
      });
      return;
    }

    const interview = await InterviewService.getInterviewById(req.userId, id);

    if (!interview) {
      res.status(404).json({
        error: 'Entretien non trouvé',
        code: 'INTERVIEW_NOT_FOUND',
      });
      return;
    }

    res.json({
      message: 'Entretien récupéré avec succès',
      data: { interview },
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'entretien:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const updateInterview = async (
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
        error: 'ID d\'entretien requis',
        code: 'MISSING_ID',
      });
      return;
    }

    const validatedData = updateInterviewSchema.parse(req.body);

    const interview = await InterviewService.updateInterview(
      req.userId,
      id,
      validatedData
    );

    if (!interview) {
      res.status(404).json({
        error: 'Entretien non trouvé',
        code: 'INTERVIEW_NOT_FOUND',
      });
      return;
    }

    res.json({
      message: 'Entretien mis à jour avec succès',
      data: { interview },
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

    if (error instanceof Error && error.message.includes('déjà programmé')) {
      res.status(409).json({
        error: error.message,
        code: 'SCHEDULING_CONFLICT',
      });
      return;
    }

    console.error('Erreur lors de la mise à jour de l\'entretien:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const deleteInterview = async (
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
        error: 'ID d\'entretien requis',
        code: 'MISSING_ID',
      });
      return;
    }

    const success = await InterviewService.deleteInterview(req.userId, id);

    if (!success) {
      res.status(404).json({
        error: 'Entretien non trouvé',
        code: 'INTERVIEW_NOT_FOUND',
      });
      return;
    }

    res.json({
      message: 'Entretien supprimé avec succès',
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'entretien:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const getInterviewStats = async (
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

    const stats = await InterviewService.getInterviewStats(req.userId);

    res.json({
      message: 'Statistiques des entretiens récupérées avec succès',
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

export const getUpcomingInterviews = async (
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
    
    const interviews = await InterviewService.getUpcomingInterviews(
      req.userId,
      limit
    );

    res.json({
      message: 'Entretiens à venir récupérés avec succès',
      data: { interviews },
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des entretiens à venir:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const getCalendarEvents = async (
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

    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        error: 'Les dates de début et de fin sont requises',
        code: 'MISSING_DATES',
      });
      return;
    }

    const events = await InterviewService.getCalendarEvents(
      req.userId,
      startDate as string,
      endDate as string
    );

    res.json({
      message: 'Événements du calendrier récupérés avec succès',
      data: { events },
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des événements:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const checkConflicts = async (
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

    const { scheduledAt, duration, excludeInterviewId } = req.query;

    if (!scheduledAt) {
      res.status(400).json({
        error: 'La date est requise',
        code: 'MISSING_DATE',
      });
      return;
    }

    const conflicts = await InterviewService.checkConflicts(
      req.userId,
      scheduledAt as string,
      duration ? parseInt(duration as string) : undefined,
      excludeInterviewId as string
    );

    res.json({
      message: 'Vérification des conflits terminée',
      data: { 
        hasConflicts: conflicts.length > 0,
        conflicts 
      },
    });
  } catch (error) {
    console.error('Erreur lors de la vérification des conflits:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};