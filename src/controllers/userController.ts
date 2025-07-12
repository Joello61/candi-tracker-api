import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import userService from '../services/userService';
import {
  updateProfileSchema,
  changePasswordSchema,
  updateUserSettingsSchema,
  userFiltersSchema
} from '../utils/userValidation';
import { ZodError } from 'zod';

/**
 * Récupérer le profil de l'utilisateur connecté
 */
export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    const profile = await userService.getUserProfile(req.user.id);
    
    if (!profile) {
      res.status(404).json({
        error: 'Profil non trouvé',
        code: 'PROFILE_NOT_FOUND'
      });
      return;
    }

    res.json({
      message: 'Profil récupéré avec succès',
      data: { user: profile }
    });

  } catch (error) {
    console.error('Erreur récupération profil:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Mettre à jour le profil de l'utilisateur
 */
export const updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    // Validation des données
    const validatedData = updateProfileSchema.parse(req.body);

    const updatedProfile = await userService.updateUserProfile(req.user.id, validatedData);

    res.json({
      message: 'Profil mis à jour avec succès',
      data: { user: updatedProfile }
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
      if (error.message === 'EMAIL_ALREADY_EXISTS') {
        res.status(409).json({
          error: 'Cet email est déjà utilisé par un autre compte',
          code: 'EMAIL_ALREADY_EXISTS'
        });
        return;
      }
    }

    console.error('Erreur mise à jour profil:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Changer le mot de passe
 */
export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    // Validation des données
    const validatedData = changePasswordSchema.parse(req.body);

    await userService.changePassword(req.user.id, validatedData);

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
      if (error.message === 'USER_NOT_FOUND') {
        res.status(404).json({
          error: 'Utilisateur non trouvé',
          code: 'USER_NOT_FOUND'
        });
        return;
      }

      if (error.message === 'INVALID_CURRENT_PASSWORD') {
        res.status(400).json({
          error: 'Mot de passe actuel incorrect',
          code: 'INVALID_CURRENT_PASSWORD'
        });
        return;
      }
    }

    console.error('Erreur changement mot de passe:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Récupérer les paramètres de l'utilisateur
 */
export const getSettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    const settings = await userService.getUserSettings(req.user.id);

    res.json({
      message: 'Paramètres récupérés avec succès',
      data: { settings }
    });

  } catch (error) {
    console.error('Erreur récupération paramètres:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Mettre à jour les paramètres de l'utilisateur
 */
export const updateSettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    // Validation des données
    const validatedData = updateUserSettingsSchema.parse(req.body);

    const updatedSettings = await userService.updateUserSettings(req.user.id, validatedData);

    res.json({
      message: 'Paramètres mis à jour avec succès',
      data: { settings: updatedSettings }
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

    console.error('Erreur mise à jour paramètres:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * NOUVELLE MÉTHODE : Basculer l'état de la 2FA
 */
export const toggle2FA = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      res.status(400).json({
        error: 'Le paramètre "enabled" doit être un booléen',
        code: 'INVALID_PARAMETER'
      });
      return;
    }

    const result = await userService.toggle2FA(req.user.id, enabled);

    res.json({
      message: `2FA ${enabled ? 'activée' : 'désactivée'} avec succès`,
      data: result
    });

  } catch (error) {
    console.error('Erreur basculement 2FA:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * NOUVELLE MÉTHODE : Récupérer les paramètres de sécurité
 */
export const getSecuritySettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    const securitySettings = await userService.getUserSecuritySettings(req.user.id);

    res.json({
      message: 'Paramètres de sécurité récupérés avec succès',
      data: { security: securitySettings }
    });

  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      res.status(404).json({
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    console.error('Erreur récupération paramètres sécurité:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Upload d'avatar
 */
export const uploadAvatar = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        error: 'Aucun fichier fourni',
        code: 'NO_FILE_PROVIDED'
      });
      return;
    }

    const result = await userService.uploadAvatar(req.user.id, req.file);

    res.json({
      message: 'Avatar uploadé avec succès',
      data: { avatar: result }
    });

  } catch (error) {
    uploadErrorHandler(error, req, res, () => {});
  }
};

/**
 * Supprimer l'avatar
 */
export const deleteAvatar = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    await userService.deleteAvatar(req.user.id);

    res.json({
      message: 'Avatar supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression avatar:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Supprimer le compte
 */
export const deleteAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    await userService.deleteAccount(req.user.id);

    res.json({
      message: 'Compte supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression compte:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Rechercher des utilisateurs
 */
export const searchUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    const { q: query, limit = '10' } = req.query;

    if (!query || typeof query !== 'string') {
      res.status(400).json({
        error: 'Paramètre de recherche requis',
        code: 'MISSING_QUERY'
      });
      return;
    }

    const limitNumber = parseInt(limit as string, 10);
    if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 50) {
      res.status(400).json({
        error: 'Limite doit être entre 1 et 50',
        code: 'INVALID_LIMIT'
      });
      return;
    }

    const users = await userService.searchUsers(query, limitNumber);

    res.json({
      message: 'Recherche effectuée avec succès',
      data: { users }
    });

  } catch (error) {
    console.error('Erreur recherche utilisateurs:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Vérifier la disponibilité d'un email
 */
export const checkEmailAvailability = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      res.status(400).json({
        error: 'Email requis',
        code: 'MISSING_EMAIL'
      });
      return;
    }

    const isAvailable = await userService.isEmailAvailable(email, req.user.id);

    res.json({
      message: 'Vérification effectuée',
      data: { 
        email,
        available: isAvailable 
      }
    });

  } catch (error) {
    console.error('Erreur vérification email:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

function uploadErrorHandler(error: unknown, req: AuthenticatedRequest, res: Response<any, Record<string, any>>, arg3: () => void) {
  throw new Error('Function not implemented.');
}
