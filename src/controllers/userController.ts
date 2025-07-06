import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { userService } from '../services/userService';
import { 
  updateProfileSchema, 
  changePasswordSchema, 
  updateUserSettingsSchema 
} from '../utils/userValidation';
import { ZodError } from 'zod';

/**
 * Récupérer le profil de l'utilisateur connecté
 */
export const getProfile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId!;

    const user = await userService.getUserProfile(userId);

    if (!user) {
      res.status(404).json({
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    res.json({
      message: 'Profil récupéré avec succès',
      data: { user }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Mettre à jour le profil de l'utilisateur
 */
export const updateProfile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId!;
    
    // Validation des données
    const validatedData = updateProfileSchema.parse(req.body);

    const updatedUser = await userService.updateUserProfile(userId, validatedData);

    res.json({
      message: 'Profil mis à jour avec succès',
      data: { user: updatedUser }
    });

  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Données invalides',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        })),
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    if (error instanceof Error) {
      switch (error.message) {
        case 'EMAIL_ALREADY_EXISTS':
          res.status(409).json({
            error: 'Cet email est déjà utilisé',
            code: 'EMAIL_ALREADY_EXISTS'
          });
          return;
      }
    }

    console.error('Erreur lors de la mise à jour du profil:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Changer le mot de passe
 */
export const changePassword = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId!;
    
    // Validation des données
    const validatedData = changePasswordSchema.parse(req.body);

    await userService.changePassword(userId, validatedData);

    res.json({
      message: 'Mot de passe modifié avec succès'
    });

  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Données invalides',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        })),
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    if (error instanceof Error) {
      switch (error.message) {
        case 'USER_NOT_FOUND':
          res.status(404).json({
            error: 'Utilisateur non trouvé',
            code: 'USER_NOT_FOUND'
          });
          return;
        case 'INVALID_CURRENT_PASSWORD':
          res.status(400).json({
            error: 'Mot de passe actuel incorrect',
            code: 'INVALID_CURRENT_PASSWORD'
          });
          return;
      }
    }

    console.error('Erreur lors du changement de mot de passe:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Récupérer les paramètres utilisateur
 */
export const getSettings = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId!;

    const settings = await userService.getUserSettings(userId);

    res.json({
      message: 'Paramètres récupérés avec succès',
      data: { settings }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Mettre à jour les paramètres utilisateur
 */
export const updateSettings = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId!;
    
    // Validation des données
    const validatedData = updateUserSettingsSchema.parse(req.body);

    const settings = await userService.updateUserSettings(userId, validatedData);

    res.json({
      message: 'Paramètres mis à jour avec succès',
      data: { settings }
    });

  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Données invalides',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        })),
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    console.error('Erreur lors de la mise à jour des paramètres:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Upload d'avatar
 */
export const uploadAvatar = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId!;
    const file = req.file;

    if (!file) {
      res.status(400).json({
        error: 'Aucun fichier fourni',
        code: 'NO_FILE_PROVIDED'
      });
      return;
    }

    const result = await userService.uploadAvatar(userId, file);

    res.json({
      message: 'Avatar uploadé avec succès',
      data: { avatar: result }
    });

  } catch (error) {
    console.error('Erreur lors de l\'upload d\'avatar:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Supprimer l'avatar
 */
export const deleteAvatar = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId!;

    await userService.deleteAvatar(userId);

    res.json({
      message: 'Avatar supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression de l\'avatar:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Supprimer le compte utilisateur
 */
export const deleteAccount = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId!;

    await userService.deleteAccount(userId);

    res.json({
      message: 'Compte supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression du compte:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Rechercher des utilisateurs (pour autocomplete)
 */
export const searchUsers = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { q: query, limit = 10 } = req.query;

    if (!query || typeof query !== 'string') {
      res.status(400).json({
        error: 'Paramètre de recherche requis',
        code: 'MISSING_QUERY'
      });
      return;
    }

    const users = await userService.searchUsers(
      query, 
      Math.min(parseInt(limit as string) || 10, 50)
    );

    res.json({
      message: 'Recherche effectuée avec succès',
      data: { users }
    });

  } catch (error) {
    console.error('Erreur lors de la recherche d\'utilisateurs:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Vérifier la disponibilité d'un email
 */
export const checkEmailAvailability = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.query;
    const userId = req.userId!;

    if (!email || typeof email !== 'string') {
      res.status(400).json({
        error: 'Email requis',
        code: 'MISSING_EMAIL'
      });
      return;
    }

    const isAvailable = await userService.isEmailAvailable(email, userId);

    res.json({
      message: 'Vérification effectuée',
      data: { 
        email,
        available: isAvailable 
      }
    });

  } catch (error) {
    console.error('Erreur lors de la vérification de l\'email:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};