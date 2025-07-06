import { Request } from 'express';
import { UserRole } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: UserRole;        // ← Ajouté
    isActive: boolean;     // ← Ajouté
  };
}

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