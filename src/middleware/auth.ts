// src/middleware/auth.ts
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { verifyToken } from '../utils/auth';
import { prisma } from '../config/database';
import { UserRole } from '@prisma/client';

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        error: 'Token d\'authentification requis',
        code: 'MISSING_TOKEN'
      });
      return;
    }

    const token = authHeader.substring(7); // Enlever "Bearer "
    
    try {
      const decoded = verifyToken(token);
      
      // Si c'est un ancien token (sans email/role), on fait une requête DB
      if (!decoded.email || !decoded.role) {
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { 
            id: true, 
            email: true, 
            name: true, 
            role: true, 
            isActive: true 
          }
        });

        if (!user) {
          res.status(401).json({ 
            error: 'Utilisateur non trouvé',
            code: 'USER_NOT_FOUND'
          });
          return;
        }

        if (!user.isActive) {
          res.status(403).json({
            error: 'Compte désactivé',
            code: 'ACCOUNT_DISABLED'
          });
          return;
        }

        req.userId = decoded.userId;
        req.user = user;
      } else {
        // Pour les nouveaux tokens, on utilise les données du JWT
        // Mais on vérifie quand même que l'utilisateur existe et est actif
        const userStatus = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { 
            id: true, 
            name: true, 
            isActive: true 
          }
        });

        if (!userStatus) {
          res.status(401).json({ 
            error: 'Utilisateur non trouvé',
            code: 'USER_NOT_FOUND'
          });
          return;
        }

        if (!userStatus.isActive) {
          res.status(403).json({
            error: 'Compte désactivé',
            code: 'ACCOUNT_DISABLED'
          });
          return;
        }

        req.userId = decoded.userId;
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          name: userStatus.name,
          role: decoded.role,
          isActive: userStatus.isActive
        };
      }

      // Mettre à jour la dernière connexion (de manière asynchrone)
      prisma.user.update({
        where: { id: decoded.userId },
        data: { lastLoginAt: new Date() }
      }).catch(console.error);

      next();
    } catch (tokenError) {
      res.status(401).json({ 
        error: 'Token invalide ou expiré',
        code: 'INVALID_TOKEN'
      });
      return;
    }
  } catch (error) {
    console.error('Erreur middleware auth:', error);
    res.status(500).json({ 
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Version légère pour les performances maximales (utilise uniquement le JWT)
export const authenticateFast = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        error: 'Token d\'authentification requis',
        code: 'MISSING_TOKEN'
      });
      return;
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = verifyToken(token);
      
      // Utilise uniquement les données du JWT (pas de vérification DB)
      // ⚠️ À utiliser seulement pour des routes non critiques
      req.userId = decoded.userId;
      req.user = {
        id: decoded.userId,
        email: decoded.email || '',
        name: '', // Pas disponible dans le JWT
        role: decoded.role || UserRole.USER,
        isActive: true // Assumé vrai (le token est valide)
      };

      next();
    } catch (tokenError) {
      res.status(401).json({ 
        error: 'Token invalide ou expiré',
        code: 'INVALID_TOKEN'
      });
      return;
    }
  } catch (error) {
    console.error('Erreur middleware auth:', error);
    res.status(500).json({ 
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Middleware optionnel (pour les routes où l'auth n'est pas obligatoire)
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      const decoded = verifyToken(token);
      
      // Pour optionalAuth, on fait une vérification simple
      if (decoded.email && decoded.role) {
        // Nouveau token avec données complètes
        req.userId = decoded.userId;
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          name: '',
          role: decoded.role,
          isActive: true
        };
      } else {
        // Ancien token, on récupère les données
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { 
            id: true, 
            email: true, 
            name: true, 
            role: true, 
            isActive: true 
          }
        });

        if (user && user.isActive) {
          req.userId = decoded.userId;
          req.user = user;
        }
      }
    } catch {
      // En cas d'erreur, on continue sans authentification
    }
  }
  
  next();
};

/**
 * Middleware pour vérifier les permissions administrateur
 * Doit être utilisé après authenticate
 */
export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentification requise',
      code: 'AUTHENTICATION_REQUIRED'
    });
    return;
  }

  if (req.user.role !== UserRole.ADMIN) {
    res.status(403).json({
      error: 'Droits administrateur requis',
      code: 'ADMIN_REQUIRED'
    });
    return;
  }

  next();
};

/**
 * Middleware pour vérifier si l'utilisateur est propriétaire de la ressource ou admin
 * Doit être utilisé après authenticate
 */
export const requireOwnerOrAdmin = (userIdParam: string = 'id') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentification requise',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    const targetUserId = req.params[userIdParam];
    
    // Admin peut tout faire
    if (req.user.role === UserRole.ADMIN) {
      next();
      return;
    }

    // Utilisateur ne peut accéder qu'à ses propres ressources
    if (req.user.id !== targetUserId) {
      res.status(403).json({
        error: 'Accès non autorisé à cette ressource',
        code: 'RESOURCE_ACCESS_DENIED'
      });
      return;
    }

    next();
  };
};

/**
 * Middleware pour vérifier les permissions d'une candidature
 * Vérifie que l'utilisateur est propriétaire de la candidature ou admin
 */
export const requireApplicationOwner = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentification requise',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    // Admin peut tout faire
    if (req.user.role === UserRole.ADMIN) {
      next();
      return;
    }

    const applicationId = req.params.id;
    
    if (!applicationId) {
      res.status(400).json({
        error: 'ID de candidature requis',
        code: 'MISSING_APPLICATION_ID'
      });
      return;
    }

    // Vérifier que la candidature appartient à l'utilisateur
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { userId: true }
    });

    if (!application) {
      res.status(404).json({
        error: 'Candidature non trouvée',
        code: 'APPLICATION_NOT_FOUND'
      });
      return;
    }

    if (application.userId !== req.user.id) {
      res.status(403).json({
        error: 'Accès non autorisé à cette candidature',
        code: 'APPLICATION_ACCESS_DENIED'
      });
      return;
    }

    next();

  } catch (error) {
    console.error('Erreur de vérification de propriété:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Middleware pour vérifier que l'utilisateur peut modifier son profil
 * Empêche un utilisateur standard de changer son rôle ou statut
 */
export const requireProfileEditPermission = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentification requise',
      code: 'AUTHENTICATION_REQUIRED'
    });
    return;
  }

  // Si l'utilisateur essaie de changer son rôle et n'est pas admin
  if (req.body.role && req.user.role !== UserRole.ADMIN) {
    res.status(403).json({
      error: 'Seuls les administrateurs peuvent modifier les rôles',
      code: 'ROLE_CHANGE_DENIED'
    });
    return;
  }

  // Si l'utilisateur essaie de changer isActive et n'est pas admin
  if (req.body.hasOwnProperty('isActive') && req.user.role !== UserRole.ADMIN) {
    res.status(403).json({
      error: 'Seuls les administrateurs peuvent activer/désactiver des comptes',
      code: 'ACTIVATION_CHANGE_DENIED'
    });
    return;
  }

  next();
};