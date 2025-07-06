import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { registerSchema, loginSchema } from '../utils/validation';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';
import { AuthenticatedRequest, AuthResponse } from '../types/auth';
import { ZodError } from 'zod';

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
        // Les valeurs par défaut sont définies dans le schéma Prisma
        // role: UserRole.USER (défaut)
        // isActive: true (défaut)
        // emailVerified: false (défaut)
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,           // ← Ajouté
        isActive: true,       // ← Ajouté
        emailVerified: true,  // ← Ajouté
      }
    });

    // Créer les paramètres utilisateur par défaut
    await prisma.userSettings.create({
      data: {
        userId: user.id
        // Les valeurs par défaut sont définies dans le schéma
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
        password: true,      // Nécessaire pour vérifier le mot de passe
        role: true,          // ← Ajouté
        isActive: true,      // ← Ajouté
        emailVerified: true, // ← Ajouté
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
        role: user.role,           // ← Ajouté
        isActive: user.isActive,   // ← Ajouté
        emailVerified: user.emailVerified, // ← Ajouté
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

export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    // Récupérer les informations complètes du profil
    const userProfile = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,           // ← Ajouté
        avatar: true,         // ← Ajouté
        isActive: true,       // ← Ajouté
        emailVerified: true,  // ← Ajouté
        lastLoginAt: true,    // ← Ajouté
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

    res.json({
      message: 'Profil récupéré avec succès',
      data: {
        user: userProfile
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