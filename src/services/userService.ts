import { prisma } from '../config/database';
import { hashPassword } from '../utils/auth';
import {
  UserProfile,
  UserSettings,
  UpdateProfileRequest,
  ChangePasswordRequest,
  UpdateUserSettingsRequest,
  AvatarUploadResult
} from '../types/user';
import fs from 'fs/promises';
import path from 'path';

class UserService {
  /**
   * Récupérer le profil d'un utilisateur
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      }
    });
  }

  /**
   * Mettre à jour le profil d'un utilisateur
   */
  async updateUserProfile(
    userId: string, 
    data: UpdateProfileRequest
  ): Promise<UserProfile> {
    // Vérifier si l'email existe déjà (si changé)
    if (data.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email,
          id: { not: userId }
        }
      });

      if (existingUser) {
        throw new Error('EMAIL_ALREADY_EXISTS');
      }
    }

    return await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      }
    });
  }

  /**
   * Changer le mot de passe d'un utilisateur
   */
  async changePassword(
    userId: string, 
    data: ChangePasswordRequest
  ): Promise<void> {
    // Récupérer l'utilisateur avec le mot de passe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true }
    });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Vérifier le mot de passe actuel
    const bcrypt = require('bcryptjs');
    const isValidPassword = await bcrypt.compare(data.currentPassword, user.password);
    
    if (!isValidPassword) {
      throw new Error('INVALID_CURRENT_PASSWORD');
    }

    // Hacher le nouveau mot de passe
    const hashedNewPassword = await hashPassword(data.newPassword);

    // Mettre à jour le mot de passe
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    });
  }

  /**
   * Récupérer les paramètres d'un utilisateur
   */
  async getUserSettings(userId: string): Promise<UserSettings> {
    let settings = await prisma.userSettings.findUnique({
      where: { userId }
    });

    // Créer des paramètres par défaut si ils n'existent pas
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId }
      });
    }

    return settings;
  }

  /**
   * Mettre à jour les paramètres d'un utilisateur
   */
  async updateUserSettings(
    userId: string, 
    data: UpdateUserSettingsRequest
  ): Promise<UserSettings> {
    return await prisma.userSettings.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data
      }
    });
  }

  /**
   * Upload d'avatar
   */
  async uploadAvatar(
    userId: string, 
    file: Express.Multer.File
  ): Promise<AvatarUploadResult> {
    // Créer le dossier utilisateur si il n'existe pas
    const userUploadsDir = path.join(process.cwd(), 'uploads', 'avatars', userId);
    await fs.mkdir(userUploadsDir, { recursive: true });

    // Générer un nom de fichier unique
    const fileExtension = path.extname(file.originalname);
    const filename = `avatar-${Date.now()}${fileExtension}`;
    const filePath = path.join(userUploadsDir, filename);

    // Sauvegarder le fichier
    await fs.writeFile(filePath, file.buffer);

    // Construire l'URL
    const avatarUrl = `/uploads/avatars/${userId}/${filename}`;

    // Supprimer l'ancien avatar si il existe
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true }
    });

    if (currentUser?.avatar) {
      try {
        const oldAvatarPath = path.join(process.cwd(), currentUser.avatar);
        await fs.unlink(oldAvatarPath);
      } catch (error) {
        console.error('Erreur lors de la suppression de l\'ancien avatar:', error);
      }
    }

    // Mettre à jour l'utilisateur avec la nouvelle URL
    await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl }
    });

    return {
      url: avatarUrl,
      filename,
      size: file.size,
      mimetype: file.mimetype
    };
  }

  /**
   * Supprimer l'avatar d'un utilisateur
   */
  async deleteAvatar(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true }
    });

    if (user?.avatar) {
      try {
        const avatarPath = path.join(process.cwd(), user.avatar);
        await fs.unlink(avatarPath);
      } catch (error) {
        console.error('Erreur lors de la suppression de l\'avatar:', error);
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { avatar: null }
    });
  }

  /**
   * Supprimer le compte d'un utilisateur
   */
  async deleteAccount(userId: string): Promise<void> {
    // Supprimer l'avatar si il existe
    await this.deleteAvatar(userId);

    // Supprimer le dossier uploads de l'utilisateur
    try {
      const userUploadsDir = path.join(process.cwd(), 'uploads', userId);
      await fs.rmdir(userUploadsDir, { recursive: true });
    } catch (error) {
      console.error('Erreur lors de la suppression du dossier uploads:', error);
    }

    // Supprimer l'utilisateur (cascade va supprimer les données liées)
    await prisma.user.delete({
      where: { id: userId }
    });
  }

  /**
   * Vérifier si un utilisateur existe et est actif
   */
  async checkUserExists(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true }
    });

    return user ? user.isActive : false;
  }

  /**
   * Vérifier si un email est disponible
   */
  async isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean> {
    const where: any = { email };
    
    if (excludeUserId) {
      where.id = { not: excludeUserId };
    }

    const existingUser = await prisma.user.findFirst({ where });
    return !existingUser;
  }

  /**
   * Marquer l'email comme vérifié
   */
  async verifyEmail(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true }
    });
  }

  /**
   * Rechercher des utilisateurs (pour autocomplete, etc.)
   */
  async searchUsers(query: string, limit: number = 10): Promise<UserProfile[]> {
    return await prisma.user.findMany({
      where: {
        AND: [
          { isActive: true },
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } }
            ]
          }
        ]
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      take: limit,
      orderBy: { name: 'asc' }
    });
  }
}

export const userService = new UserService();
export default userService;