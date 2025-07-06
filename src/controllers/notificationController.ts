import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { NotificationService } from '../services/notificationService';
import {
  notificationQuerySchema,
  updateNotificationSettingsSchema,
  createNotificationSchema,
} from '../utils/notificationValidation';
import { ZodError } from 'zod';

export const getNotifications = async (
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

    const queryParams = notificationQuerySchema.parse(req.query);
    const { page, limit, unreadOnly } = queryParams;

    const result = await NotificationService.getUserNotifications(
      req.userId,
      page,
      limit,
      unreadOnly
    );

    res.json({
      message: 'Notifications récupérées avec succès',
      data: result,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Paramètres invalides',
        details: error.errors,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    console.error('Erreur récupération notifications:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const getNotificationStats = async (
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

    const stats = await NotificationService.getNotificationStats(req.userId);

    res.json({
      message: 'Statistiques récupérées avec succès',
      data: { stats },
    });
  } catch (error) {
    console.error('Erreur récupération stats notifications:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const markAsRead = async (
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
        error: 'ID de notification requis',
        code: 'MISSING_ID',
      });
      return;
    }

    const success = await NotificationService.markAsRead(req.userId, id);

    if (!success) {
      res.status(404).json({
        error: 'Notification non trouvée',
        code: 'NOTIFICATION_NOT_FOUND',
      });
      return;
    }

    res.json({
      message: 'Notification marquée comme lue',
    });
  } catch (error) {
    console.error('Erreur marquage lecture:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const markAllAsRead = async (
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

    const count = await NotificationService.markAllAsRead(req.userId);

    res.json({
      message: `${count} notification(s) marquée(s) comme lue(s)`,
      data: { count },
    });
  } catch (error) {
    console.error('Erreur marquage toutes lectures:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const deleteNotification = async (
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
        error: 'ID de notification requis',
        code: 'MISSING_ID',
      });
      return;
    }

    const success = await NotificationService.deleteNotification(req.userId, id);

    if (!success) {
      res.status(404).json({
        error: 'Notification non trouvée',
        code: 'NOTIFICATION_NOT_FOUND',
      });
      return;
    }

    res.json({
      message: 'Notification supprimée avec succès',
    });
  } catch (error) {
    console.error('Erreur suppression notification:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const getNotificationSettings = async (
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

    const settings = await NotificationService.getNotificationSettings(req.userId);

    res.json({
      message: 'Paramètres récupérés avec succès',
      data: { settings },
    });
  } catch (error) {
    console.error('Erreur récupération paramètres:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const updateNotificationSettings = async (
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

    const validatedData = updateNotificationSettingsSchema.parse(req.body);

    const settings = await NotificationService.updateNotificationSettings(
      req.userId,
      validatedData
    );

    res.json({
      message: 'Paramètres mis à jour avec succès',
      data: { settings },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Données invalides',
        details: error.errors,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    console.error('Erreur mise à jour paramètres:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const createNotification = async (
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

    const validatedData = createNotificationSchema.parse(req.body);

    await NotificationService.sendNotification(
      req.userId,
      validatedData.type,
      validatedData.title,
      validatedData.message,
      validatedData.data,
      validatedData.priority,
      validatedData.actionUrl
    );

    res.status(201).json({
      message: 'Notification créée avec succès',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Données invalides',
        details: error.errors,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    console.error('Erreur création notification:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const cleanupNotifications = async (
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

    const { days } = req.query;
    const olderThanDays = days ? parseInt(days as string) : 30;

    const count = await NotificationService.cleanupOldNotifications(
      req.userId,
      olderThanDays
    );

    res.json({
      message: `${count} notification(s) supprimée(s)`,
      data: { count },
    });
  } catch (error) {
    console.error('Erreur nettoyage notifications:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  }
};