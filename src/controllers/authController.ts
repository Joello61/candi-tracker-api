import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { registerSchema, loginSchema } from '../utils/validation';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';
import { AuthenticatedRequest, AuthResponse } from '../types/auth';
import { ZodError } from 'zod';
import passport from 'passport';
import { config } from '../config/env';
import { UserRole } from '@prisma/client';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validation des données
    const validatedData = registerSchema.parse(req.body);
    const { name, email, password } = validatedData;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      res.status(409).json({ 
        error: 'Un compte avec cet email existe déjà',
        code: 'EMAIL_ALREADY_EXISTS'
      });
      return;
    }

    // Hasher le mot de passe
    const hashedPassword = await hashPassword(password);

    // Créer l'utilisateur avec les nouveaux champs
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        provider: 'local',
        // Les valeurs par défaut sont définies dans le schéma Prisma
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        emailVerified: true,
      }
    });

    // Créer les paramètres utilisateur par défaut
    await prisma.userSettings.create({
      data: {
        userId: user.id
      }
    });

    // Générer le token avec les nouvelles données
    const token = generateToken(user.id, user.email, user.role);

    const response: AuthResponse = {
      user,
      token,
    };

    res.status(201).json({
      message: 'Compte créé avec succès',
      data: response
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

    console.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({ 
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validation des données
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    // Chercher l'utilisateur avec les nouveaux champs
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        isActive: true,
        emailVerified: true,
        provider: true,
      }
    });

    if (!user) {
      res.status(401).json({ 
        error: 'Email ou mot de passe incorrect',
        code: 'INVALID_CREDENTIALS'
      });
      return;
    }

    // Vérifier si le compte est actif
    if (!user.isActive) {
      res.status(403).json({
        error: 'Compte désactivé. Contactez l\'administrateur.',
        code: 'ACCOUNT_DISABLED'
      });
      return;
    }

    // Vérifier que c'est un compte local (avec mot de passe)
    if (!user.password) {
      res.status(400).json({
        error: 'Ce compte utilise une connexion sociale. Utilisez Google ou LinkedIn pour vous connecter.',
        code: 'SOCIAL_ACCOUNT_ONLY'
      });
      return;
    }

    // Vérifier le mot de passe
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({ 
        error: 'Email ou mot de passe incorrect',
        code: 'INVALID_CREDENTIALS'
      });
      return;
    }

    // Mettre à jour la dernière connexion
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Générer le token avec les nouvelles données
    const token = generateToken(user.id, user.email, user.role);

    const response: AuthResponse = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
      },
      token,
    };

    res.json({
      message: 'Connexion réussie',
      data: response
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

    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({ 
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

// ===== NOUVELLES MÉTHODES OAUTH =====

// Initier la connexion Google
export const googleAuth = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false // Pas de session !
  })(req, res, next);
};

// Callback Google
export const googleCallback = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('google', { 
    session: false, // Pas de session !
    failureRedirect: `${config.frontendUrl}/auth/login?error=google_auth_failed` 
  }, async (err, user) => {
    try {
      if (err) {
        console.error('Erreur Google OAuth:', err);
        return res.redirect(`${config.frontendUrl}/auth/login?error=google_auth_failed&message=${encodeURIComponent(err.message)}`);
      }

      if (!user) {
        return res.redirect(`${config.frontendUrl}/auth/login?error=google_auth_failed&message=${encodeURIComponent('Authentification Google échouée')}`);
      }

      // Générer le JWT
      const token = generateToken(user.id, user.email, user.role);

      // Rediriger vers le frontend avec le token
      res.redirect(`${config.frontendUrl}/auth/callback?token=${token}&provider=google`);
    } catch (error) {
      console.error('Erreur lors du callback Google:', error);
      res.redirect(`${config.frontendUrl}/auth/login?error=callback_error`);
    }
  })(req, res, next);
};

// Initier la connexion LinkedIn
export const linkedinAuth = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('linkedin', {
    scope: ['openid', 'profile', 'email'],
    session: false // Pas de session !
  })(req, res, next);
};

// Callback LinkedIn
export const linkedinCallback = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('linkedin', { 
    session: false, // Pas de session !
    failureRedirect: `${config.frontendUrl}/auth/login?error=linkedin_auth_failed` 
  }, async (err: { message: string | number | boolean; }, user: { id: string; email: string; role: UserRole; }) => {
    try {
      if (err) {
        console.error('Erreur LinkedIn OAuth:', err);
        return res.redirect(`${config.frontendUrl}/auth/login?error=linkedin_auth_failed&message=${encodeURIComponent(err.message)}`);
      }

      if (!user) {
        return res.redirect(`${config.frontendUrl}/auth/login?error=linkedin_auth_failed&message=${encodeURIComponent('Authentification LinkedIn échouée')}`);
      }

      // Générer le JWT
      const token = generateToken(user.id, user.email, user.role);

      // Rediriger vers le frontend avec le token
      res.redirect(`${config.frontendUrl}/auth/callback?token=${token}&provider=linkedin`);
    } catch (error) {
      console.error('Erreur lors du callback LinkedIn:', error);
      res.redirect(`${config.frontendUrl}/auth/login?error=callback_error`);
    }
  })(req, res, next);
};

// Méthode pour lier un compte social à un compte existant
export const linkSocialAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    const { provider, providerId } = req.body;

    if (!provider || !providerId) {
      res.status(400).json({
        error: 'Provider et providerId requis',
        code: 'MISSING_PROVIDER_DATA'
      });
      return;
    }

    // Vérifier que le compte social n'est pas déjà lié à un autre utilisateur
    const existingLink = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId: provider === 'google' ? providerId : undefined },
          { linkedinId: provider === 'linkedin' ? providerId : undefined }
        ],
        NOT: { id: req.user.id }
      }
    });

    if (existingLink) {
      res.status(409).json({
        error: 'Ce compte social est déjà lié à un autre utilisateur',
        code: 'SOCIAL_ACCOUNT_ALREADY_LINKED'
      });
      return;
    }

    // Lier le compte social
    const updateData: any = {};
    if (provider === 'google') {
      updateData.googleId = providerId;
    } else if (provider === 'linkedin') {
      updateData.linkedinId = providerId;
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: updateData
    });

    res.json({
      message: `Compte ${provider} lié avec succès`,
      data: { provider, linked: true }
    });

  } catch (error) {
    console.error('Erreur lors de la liaison du compte social:', error);
    res.status(500).json({ 
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Méthode pour délier un compte social
export const unlinkSocialAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    const { provider } = req.body;

    if (!provider) {
      res.status(400).json({
        error: 'Provider requis',
        code: 'MISSING_PROVIDER'
      });
      return;
    }

    // Vérifier que l'utilisateur a un moyen de se connecter après déliaison
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { password: true, googleId: true, linkedinId: true }
    });

    if (!user) {
      res.status(404).json({
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Vérifier qu'il reste au moins un moyen de connexion
    const hasPassword = !!user.password;
    const hasGoogle = !!user.googleId;
    const hasLinkedIn = !!user.linkedinId;
    const totalMethods = Number(hasPassword) + Number(hasGoogle) + Number(hasLinkedIn);

    if (totalMethods <= 1) {
      res.status(400).json({
        error: 'Impossible de délier le dernier moyen de connexion. Ajoutez un mot de passe ou un autre compte social d\'abord.',
        code: 'LAST_AUTH_METHOD'
      });
      return;
    }

    // Délier le compte social
    const updateData: any = {};
    if (provider === 'google') {
      updateData.googleId = null;
    } else if (provider === 'linkedin') {
      updateData.linkedinId = null;
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: updateData
    });

    res.json({
      message: `Compte ${provider} délié avec succès`,
      data: { provider, unlinked: true }
    });

  } catch (error) {
    console.error('Erreur lors de la déliaison du compte social:', error);
    res.status(500).json({ 
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

// ===== MÉTHODES EXISTANTES =====

export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    // Récupérer les informations complètes du profil avec les infos OAuth
    const userProfile = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        emailVerified: true,
        lastLoginAt: true,
        provider: true,
        googleId: true,
        linkedinId: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!userProfile) {
      res.status(404).json({
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Ajouter les informations sur les comptes liés
    const linkedAccounts = {
      google: !!userProfile.googleId,
      linkedin: !!userProfile.linkedinId,
      local: !!userProfile.provider && userProfile.provider === 'local'
    };

    res.json({
      message: 'Profil récupéré avec succès',
      data: {
        user: {
          ...userProfile,
          linkedAccounts
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({ 
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

export const refreshToken = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ 
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    // Vérifier que l'utilisateur existe et est actif
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, isActive: true }
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

    // Générer un nouveau token avec les données utilisateur
    const userForToken = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, role: true }
    });

    if (!userForToken) {
      res.status(401).json({
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    const newToken = generateToken(userForToken.id, userForToken.email, userForToken.role);

    res.json({
      message: 'Token rafraîchi avec succès',
      data: {
        token: newToken
      }
    });

  } catch (error) {
    console.error('Erreur lors du rafraîchissement du token:', error);
    res.status(500).json({ 
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};