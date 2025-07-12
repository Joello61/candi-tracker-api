import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { registerSchema, loginSchema, resetPasswordSchema, forgotPasswordSchema } from '../utils/validation';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';
import { AuthenticatedRequest, AuthResponse } from '../types/auth';
import { ZodError } from 'zod';
import passport from 'passport';
import { config } from '../config/env';
import { UserRole } from '@prisma/client';
import VerificationService from '../services/verificationService';

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
        emailVerified: false, // Par défaut false pour forcer la vérification
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

    // Créer les paramètres utilisateur par défaut (avec enabled2FA = false)
    await prisma.userSettings.create({
      data: {
        userId: user.id,
        enabled2FA: false // Par défaut désactivé
      }
    });

    try {
      // Créer et envoyer le code de vérification email
      await VerificationService.createAndSendCode({
        userId: user.id,
        type: 'EMAIL_VERIFICATION',
        method: 'EMAIL',
        target: user.email
      });

      console.log(`Code de vérification email envoyé à ${user.email}`);
    } catch (emailError) {
      console.error('Erreur envoi code de vérification:', emailError);
      // Ne pas faire échouer l'inscription si l'email ne s'envoie pas
    }

    // NOUVEAU : Rediriger vers la vérification email au lieu de connecter directement
    res.status(201).json({
      message: 'Compte créé avec succès. Veuillez vérifier votre email.',
      data: {
        requiresEmailVerification: true,
        email: user.email,
        userId: user.id
      }
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

    // Chercher l'utilisateur avec les paramètres 2FA
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
        settings: {
          select: {
            enabled2FA: true
          }
        }
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

    // NOUVEAU : Vérifier si l'email est vérifié
    if (!user.emailVerified) {
      // Renvoyer un code de vérification
      try {
        await VerificationService.createAndSendCode({
          userId: user.id,
          type: 'EMAIL_VERIFICATION',
          method: 'EMAIL',
          target: user.email
        });
      } catch (error) {
        console.error('Erreur envoi code de vérification:', error);
      }

      res.status(403).json({
        error: 'Email non vérifié. Un code de vérification a été envoyé.',
        code: 'EMAIL_NOT_VERIFIED',
        data: {
          requiresEmailVerification: true,
          email: user.email,
          userId: user.id
        }
      });
      return;
    }

    // NOUVEAU : Vérifier si 2FA est activé
    const enabled2FA = user.settings?.enabled2FA || false;

    if (enabled2FA) {
      // 2FA activé : envoyer le code et ne pas donner le token final
      try {
        await VerificationService.createAndSendCode({
          userId: user.id,
          type: 'TWO_FACTOR_AUTH',
          method: 'EMAIL', // Ou SMS selon les préférences utilisateur
          target: user.email
        });

        res.status(200).json({
          message: 'Code d\'authentification 2FA envoyé',
          data: {
            requires2FA: true,
            userId: user.id,
            email: user.email, // Masqué côté client si besoin
            step: '2FA_VERIFICATION'
          }
        });
        return;
      } catch (error) {
        console.error('Erreur envoi code 2FA:', error);
        res.status(500).json({
          error: 'Erreur lors de l\'envoi du code 2FA',
          code: 'TWO_FACTOR_SEND_ERROR'
        });
        return;
      }
    }

    // Pas de 2FA ou 2FA désactivé : connexion directe
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

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

// NOUVELLE MÉTHODE : Vérifier le code de vérification email après inscription
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      res.status(400).json({
        error: 'UserId et code requis',
        code: 'MISSING_PARAMETERS'
      });
      return;
    }

    // Vérifier le code
    const verificationResult = await VerificationService.verifyCode(
      userId,
      code,
      'EMAIL_VERIFICATION'
    );

    if (!verificationResult.success) {
      res.status(400).json({
        error: verificationResult.message,
        code: 'INVALID_VERIFICATION_CODE'
      });
      return;
    }

    // Marquer l'email comme vérifié
    const user = await prisma.user.update({
      where: { id: userId },
      data: { 
        emailVerified: true,
        lastLoginAt: new Date()
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

    // Générer le token pour connecter l'utilisateur
    const token = generateToken(user.id, user.email, user.role);

    const response: AuthResponse = {
      user,
      token,
    };

    res.json({
      message: 'Email vérifié avec succès. Vous êtes maintenant connecté.',
      data: response
    });

  } catch (error) {
    console.error('Erreur vérification email:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

// NOUVELLE MÉTHODE : Vérifier le code 2FA lors de la connexion
export const verify2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      res.status(400).json({
        error: 'UserId et code requis',
        code: 'MISSING_PARAMETERS'
      });
      return;
    }

    // Vérifier le code 2FA
    const verificationResult = await VerificationService.verifyCode(
      userId,
      code,
      'TWO_FACTOR_AUTH'
    );

    if (!verificationResult.success) {
      res.status(400).json({
        error: verificationResult.message,
        code: 'INVALID_2FA_CODE'
      });
      return;
    }

    // Récupérer l'utilisateur et finaliser la connexion
    const user = await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        emailVerified: true,
      }
    });

    // Générer le token final
    const token = generateToken(user.id, user.email, user.role);

    const response: AuthResponse = {
      user,
      token,
    };

    res.json({
      message: 'Authentification 2FA réussie',
      data: response
    });

  } catch (error) {
    console.error('Erreur vérification 2FA:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

// NOUVELLE MÉTHODE : Renvoyer un code de vérification
export const resendVerificationCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, type } = req.body;

    if (!userId || !type) {
      res.status(400).json({
        error: 'UserId et type requis',
        code: 'MISSING_PARAMETERS'
      });
      return;
    }

    // Valider le type
    const validTypes = ['EMAIL_VERIFICATION', 'TWO_FACTOR_AUTH'];
    if (!validTypes.includes(type)) {
      res.status(400).json({
        error: 'Type de vérification invalide',
        code: 'INVALID_TYPE'
      });
      return;
    }

    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      res.status(404).json({
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Renvoyer le code
    const result = await VerificationService.createAndSendCode({
      userId: user.id,
      type: type as any,
      method: 'EMAIL',
      target: user.email
    });

    if (result.success) {
      res.json({
        message: 'Code renvoyé avec succès',
        data: {
          nextAllowedAt: result.nextAllowedAt?.toISOString()
        }
      });
    } else {
      res.status(429).json({
        error: result.message,
        code: 'RATE_LIMITED',
        data: {
          nextAllowedAt: result.nextAllowedAt?.toISOString()
        }
      });
    }

  } catch (error) {
    console.error('Erreur renvoi code:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

// ===== MÉTHODES OAUTH (inchangées) =====

export const googleAuth = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
  })(req, res, next);
};

export const googleCallback = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('google', { 
    session: false,
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

      const token = generateToken(user.id, user.email, user.role);
      res.redirect(`${config.frontendUrl}/auth/callback?token=${token}&provider=google`);
    } catch (error) {
      console.error('Erreur lors du callback Google:', error);
      res.redirect(`${config.frontendUrl}/auth/login?error=callback_error`);
    }
  })(req, res, next);
};

export const linkedinAuth = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('linkedin', {
    scope: ['openid', 'profile', 'email'],
    session: false
  })(req, res, next);
};

export const linkedinCallback = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('linkedin', { 
    session: false,
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

      const token = generateToken(user.id, user.email, user.role);
      res.redirect(`${config.frontendUrl}/auth/callback?token=${token}&provider=linkedin`);
    } catch (error) {
      console.error('Erreur lors du callback LinkedIn:', error);
      res.redirect(`${config.frontendUrl}/auth/login?error=callback_error`);
    }
  })(req, res, next);
};

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

// ===== MÉTHODES EXISTANTES (inchangées) =====

export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

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

/**
 * Initier la réinitialisation de mot de passe (forgot password)
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validation des données
    const validatedData = forgotPasswordSchema.parse(req.body);
    const { email } = validatedData;

    // Chercher l'utilisateur par email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        provider: true,
      }
    });

    // IMPORTANT : Toujours renvoyer une réponse positive pour éviter l'énumération d'emails
    const successResponse = {
      message: 'Si cette adresse email existe dans notre système, un code de réinitialisation a été envoyé.',
      data: {
        email: email,
        codeRequested: true
      }
    };

    // Si l'utilisateur n'existe pas, on répond quand même positivement
    if (!user) {
      res.json(successResponse);
      return;
    }

    // Vérifier si le compte est actif
    if (!user.isActive) {
      res.json(successResponse);
      return;
    }

    // Vérifier que c'est un compte avec mot de passe (pas uniquement social)
    if (user.provider && user.provider !== 'local') {
      // Pour les comptes sociaux purs, on peut soit :
      // 1. Envoyer quand même le code pour permettre d'ajouter un mot de passe
      // 2. Ou renvoyer la réponse standard
      // Ici on choisit l'option 1 pour plus de flexibilité
    }

    try {
      // Créer et envoyer le code de réinitialisation
      const result = await VerificationService.createAndSendCode({
        userId: user.id,
        type: 'PASSWORD_RESET',
        method: 'EMAIL',
        target: user.email
      });

      if (result.success) {
        console.log(`Code de réinitialisation envoyé à ${user.email}`);
      } else {
        console.error('Erreur envoi code réinitialisation:', result.message);
        // Même en cas d'erreur d'envoi, on renvoie la réponse positive
      }
    } catch (error) {
      console.error('Erreur lors de la création du code de réinitialisation:', error);
      // On continue et renvoie la réponse positive
    }

    res.json(successResponse);

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

    console.error('Erreur lors de la demande de réinitialisation:', error);
    res.status(500).json({ 
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Vérifier le code de réinitialisation ET réinitialiser le mot de passe
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validation des données
    const validatedData = resetPasswordSchema.parse(req.body);
    const { email, code, newPassword } = validatedData;

    // Chercher l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        role: true,
      }
    });

    if (!user) {
      res.status(400).json({
        error: 'Code invalide ou expiré',
        code: 'INVALID_RESET_CODE'
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        error: 'Compte désactivé. Contactez l\'administrateur.',
        code: 'ACCOUNT_DISABLED'
      });
      return;
    }

    // Vérifier le code de réinitialisation
    const verificationResult = await VerificationService.verifyCode(
      user.id,
      code,
      'PASSWORD_RESET'
    );

    if (!verificationResult.success) {
      res.status(400).json({
        error: verificationResult.message,
        code: 'INVALID_RESET_CODE'
      });
      return;
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await hashPassword(newPassword);

    // Mettre à jour le mot de passe et marquer comme compte local
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword,
        provider: 'local', // S'assurer que le compte devient local
        lastLoginAt: new Date()
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

    // Invalider tous les autres codes de réinitialisation pour cet utilisateur
    await prisma.verificationCode.updateMany({
      where: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        isUsed: false
      },
      data: { isUsed: true }
    });

    // Générer un token de connexion automatique
    const token = generateToken(updatedUser.id, updatedUser.email, updatedUser.role);

    const response: AuthResponse = {
      user: updatedUser,
      token,
    };

    res.json({
      message: 'Mot de passe réinitialisé avec succès. Vous êtes maintenant connecté.',
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

    console.error('Erreur lors de la réinitialisation:', error);
    res.status(500).json({ 
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Vérifier la validité d'un code de réinitialisation (optionnel - pour validation côté frontend)
 */
export const verifyResetCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      res.status(400).json({
        error: 'Email et code requis',
        code: 'MISSING_PARAMETERS'
      });
      return;
    }

    // Chercher l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, isActive: true }
    });

    if (!user || !user.isActive) {
      res.status(400).json({
        error: 'Code invalide ou expiré',
        code: 'INVALID_RESET_CODE'
      });
      return;
    }

    // Vérifier si le code existe et est valide (sans le marquer comme utilisé)
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        code,
        type: 'PASSWORD_RESET',
        isUsed: false,
        expiresAt: { gt: new Date() }
      },
      select: {
        id: true,
        attempts: true,
        maxAttempts: true,
        expiresAt: true
      }
    });

    if (!verificationCode) {
      res.status(400).json({
        error: 'Code invalide ou expiré',
        code: 'INVALID_RESET_CODE'
      });
      return;
    }

    if (verificationCode.attempts >= verificationCode.maxAttempts) {
      res.status(400).json({
        error: 'Trop de tentatives. Demandez un nouveau code.',
        code: 'TOO_MANY_ATTEMPTS'
      });
      return;
    }

    res.json({
      message: 'Code valide',
      data: {
        valid: true,
        expiresAt: verificationCode.expiresAt.toISOString(),
        remainingAttempts: verificationCode.maxAttempts - verificationCode.attempts
      }
    });

  } catch (error) {
    console.error('Erreur vérification code reset:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};