import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config/env';
import { UserRole } from '@prisma/client';

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

// Interface pour le payload JWT étendu
interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

// Fonction mise à jour pour inclure email et rôle dans le token
export const generateToken = (userId: string, email: string, role: UserRole): string => {
  if (!config.jwtSecret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  const payload: JwtPayload = { 
    userId, 
    email, 
    role 
  };
  const secret = config.jwtSecret as jwt.Secret;

  const options: SignOptions = {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  };

  return jwt.sign(payload, secret, options);
};

// Version de compatibilité (garde l'ancienne signature pour éviter les breaking changes)
export const generateTokenSimple = (userId: string): string => {
  if (!config.jwtSecret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  const payload = { userId };
  const secret = config.jwtSecret as jwt.Secret;

  const options: SignOptions = {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  };

  return jwt.sign(payload, secret, options);
};

// Fonction de vérification mise à jour
export const verifyToken = (token: string): JwtPayload => {
  try {
    if (!config.jwtSecret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    
    // Vérification que le payload contient les champs attendus
    if (!decoded.userId) {
      throw new Error('Token invalide: userId manquant');
    }

    // Pour la compatibilité avec les anciens tokens qui n'ont que userId
    if (!decoded.email || !decoded.role) {
      return {
        userId: decoded.userId,
        email: '',
        role: UserRole.USER // Rôle par défaut pour les anciens tokens
      };
    }

    return decoded;
  } catch (error) {
    if (error instanceof Error && error.message.includes('JWT_SECRET')) {
      throw error;
    }
    throw new Error('Token invalide');
  }
};

// Version simple pour compatibilité
export const verifyTokenSimple = (token: string): { userId: string } => {
  try {
    const decoded = verifyToken(token);
    return { userId: decoded.userId };
  } catch (error) {
    throw error;
  }
};