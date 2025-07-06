import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { adminService } from '../services/adminService';
import { userFiltersSchema, adminUpdateUserSchema } from '../utils/userValidation';
import { UserRole } from '@prisma/client';
import { ZodError } from 'zod';

/**
 * Récupérer tous les utilisateurs (avec pagination et filtres)
 */
export const getAllUsers = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    // Validation des paramètres de requête
    const validatedFilters = userFiltersSchema.parse(req.query);

    const result = await adminService.getAllUsers(validatedFilters);

    res.json({
      message: 'Utilisateurs récupérés avec succès',
      data: result
    });

  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Paramètres invalides',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        })),
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Récupérer un utilisateur par ID
 */
export const getUserById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await adminService.getUserById(id);

    if (!user) {
      res.status(404).json({
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    res.json({
      message: 'Utilisateur récupéré avec succès',
      data: { user }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Mettre à jour un utilisateur
 */
export const updateUser = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Validation des données
    const validatedData = adminUpdateUserSchema.parse(req.body);

    const updatedUser = await adminService.updateUser(id, validatedData);

    res.json({
      message: 'Utilisateur mis à jour avec succès',
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

    console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Supprimer un utilisateur
 */
export const deleteUser = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    await adminService.deleteUser(id);

    res.json({
      message: 'Utilisateur supprimé avec succès'
    });

  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'USER_NOT_FOUND':
          res.status(404).json({
            error: 'Utilisateur non trouvé',
            code: 'USER_NOT_FOUND'
          });
          return;
        case 'CANNOT_DELETE_LAST_ADMIN':
          res.status(400).json({
            error: 'Impossible de supprimer le dernier administrateur',
            code: 'CANNOT_DELETE_LAST_ADMIN'
          });
          return;
      }
    }

    console.error('Erreur lors de la suppression de l\'utilisateur:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Changer le rôle d'un utilisateur
 */
export const changeUserRole = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !Object.values(UserRole).includes(role)) {
      res.status(400).json({
        error: 'Rôle invalide',
        code: 'INVALID_ROLE'
      });
      return;
    }

    const updatedUser = await adminService.changeUserRole(id, role);

    res.json({
      message: 'Rôle utilisateur modifié avec succès',
      data: { user: updatedUser }
    });

  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'USER_NOT_FOUND':
          res.status(404).json({
            error: 'Utilisateur non trouvé',
            code: 'USER_NOT_FOUND'
          });
          return;
        case 'CANNOT_REMOVE_LAST_ADMIN':
          res.status(400).json({
            error: 'Impossible de retirer le rôle administrateur au dernier admin',
            code: 'CANNOT_REMOVE_LAST_ADMIN'
          });
          return;
      }
    }

    console.error('Erreur lors du changement de rôle:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Activer/désactiver un utilisateur
 */
export const toggleUserStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      res.status(400).json({
        error: 'Statut invalide',
        code: 'INVALID_STATUS'
      });
      return;
    }

    const updatedUser = await adminService.toggleUserStatus(id, isActive);

    res.json({
      message: `Utilisateur ${isActive ? 'activé' : 'désactivé'} avec succès`,
      data: { user: updatedUser }
    });

  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'USER_NOT_FOUND':
          res.status(404).json({
            error: 'Utilisateur non trouvé',
            code: 'USER_NOT_FOUND'
          });
          return;
        case 'CANNOT_DEACTIVATE_LAST_ADMIN':
          res.status(400).json({
            error: 'Impossible de désactiver le dernier administrateur',
            code: 'CANNOT_DEACTIVATE_LAST_ADMIN'
          });
          return;
      }
    }

    console.error('Erreur lors du changement de statut:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Récupérer les statistiques d'administration
 */
export const getAdminStats = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const stats = await adminService.getAdminStats();

    res.json({
      message: 'Statistiques récupérées avec succès',
      data: { stats }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Récupérer l'activité récente des utilisateurs
 */
export const getRecentActivity = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { limit = 10 } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 10, 50);

    const activity = await adminService.getRecentActivity(limitNum);

    res.json({
      message: 'Activité récente récupérée avec succès',
      data: { activity }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'activité:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Actions en lot sur les utilisateurs
 */
export const bulkUserAction = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { userIds, action } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({
        error: 'Liste d\'utilisateurs requise',
        code: 'MISSING_USER_IDS'
      });
      return;
    }

    if (!['activate', 'deactivate', 'delete'].includes(action)) {
      res.status(400).json({
        error: 'Action invalide',
        code: 'INVALID_ACTION'
      });
      return;
    }

    const count = await adminService.bulkUserAction({ userIds, action });

    res.json({
      message: `Action "${action}" effectuée sur ${count} utilisateur(s)`,
      data: { count, action }
    });

  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'CANNOT_DEACTIVATE_ALL_ADMINS':
          res.status(400).json({
            error: 'Impossible de désactiver tous les administrateurs',
            code: 'CANNOT_DEACTIVATE_ALL_ADMINS'
          });
          return;
        case 'CANNOT_DELETE_ALL_ADMINS':
          res.status(400).json({
            error: 'Impossible de supprimer tous les administrateurs',
            code: 'CANNOT_DELETE_ALL_ADMINS'
          });
          return;
        case 'INVALID_ACTION':
          res.status(400).json({
            error: 'Action invalide',
            code: 'INVALID_ACTION'
          });
          return;
      }
    }

    console.error('Erreur lors de l\'action en lot:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Recherche avancée d'utilisateurs
 */
export const searchUsersAdvanced = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      query,
      roles,
      isActive,
      createdAfter,
      createdBefore,
      lastLoginAfter,
      lastLoginBefore,
      limit = 50
    } = req.query;

    const filters: any = {};

    if (query) filters.query = query as string;
    if (roles) {
      const roleArray = (roles as string).split(',').filter(role => 
        Object.values(UserRole).includes(role as UserRole)
      ) as UserRole[];
      if (roleArray.length > 0) filters.roles = roleArray;
    }
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (createdAfter) filters.createdAfter = new Date(createdAfter as string);
    if (createdBefore) filters.createdBefore = new Date(createdBefore as string);
    if (lastLoginAfter) filters.lastLoginAfter = new Date(lastLoginAfter as string);
    if (lastLoginBefore) filters.lastLoginBefore = new Date(lastLoginBefore as string);
    filters.limit = Math.min(parseInt(limit as string) || 50, 100);

    const users = await adminService.searchUsersAdvanced(filters);

    res.json({
      message: 'Recherche avancée effectuée avec succès',
      data: { users }
    });

  } catch (error) {
    console.error('Erreur lors de la recherche avancée:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};