import { Request } from 'express';
import { UserRole } from '@prisma/client';

// Interface pour l'utilisateur authentifié
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

// Étendre l'interface Request d'Express pour ajouter nos propriétés
export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: AuthUser;
}

// Interface pour la réponse d'authentification
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;        
    isActive: boolean;     
    emailVerified: boolean; 
  };
  token: string;
}

// Étendre l'interface Express User pour Passport
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      isActive: boolean;
      emailVerified?: boolean;
      googleId?: string;
      linkedinId?: string;
      provider?: string;
      providerId?: string;
    }
  }
}