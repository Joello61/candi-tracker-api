import { prisma } from '../config/database';
import { UserRole } from '@prisma/client';
import {
  UserWithCounts,
  UserFilters,
  PaginatedUsers,
  AdminStats,
  UserActivity,
  BulkUserAction,
  UpdateProfileRequest
} from '../types/user';

class AdminService {
  /**
   * Récupérer tous les utilisateurs avec pagination et filtres
   */
  async getAllUsers(filters: UserFilters): Promise<PaginatedUsers> {
    const {
      page = 1,
      limit = 10,
      search = '',
      role,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = filters;

    const skip = (page - 1) * limit;

    // Construire les filtres
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Récupérer les utilisateurs et le total
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
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
          _count: {
            select: {
              applications: true,
              notifications: true
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit
      }),
      prisma.user.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Récupérer un utilisateur par ID avec détails complets
   */
  async getUserById(userId: string): Promise<UserWithCounts | null> {
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
        _count: {
          select: {
            applications: true,
            notifications: true
          }
        }
      }
    });
  }

  /**
   * Mettre à jour un utilisateur (admin uniquement)
   */
  async updateUser(
    userId: string, 
    data: UpdateProfileRequest
  ): Promise<UserWithCounts> {
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
        _count: {
          select: {
            applications: true,
            notifications: true
          }
        }
      }
    });
  }

  /**
   * Supprimer un utilisateur (admin uniquement)
   */
  async deleteUser(userId: string): Promise<void> {
    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Empêcher la suppression du dernier admin
    if (user.role === UserRole.ADMIN) {
      const adminCount = await prisma.user.count({
        where: { role: UserRole.ADMIN }
      });

      if (adminCount <= 1) {
        throw new Error('CANNOT_DELETE_LAST_ADMIN');
      }
    }

    // Supprimer l'utilisateur (cascade va supprimer les données liées)
    await prisma.user.delete({
      where: { id: userId }
    });
  }

  /**
   * Changer le rôle d'un utilisateur
   */
  async changeUserRole(userId: string, newRole: UserRole): Promise<UserWithCounts> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Empêcher de retirer le rôle admin au dernier admin
    if (user.role === UserRole.ADMIN && newRole !== UserRole.ADMIN) {
      const adminCount = await prisma.user.count({
        where: { role: UserRole.ADMIN }
      });

      if (adminCount <= 1) {
        throw new Error('CANNOT_REMOVE_LAST_ADMIN');
      }
    }

    return await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
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
        _count: {
          select: {
            applications: true,
            notifications: true
          }
        }
      }
    });
  }

  /**
   * Activer/désactiver un utilisateur
   */
  async toggleUserStatus(userId: string, isActive: boolean): Promise<UserWithCounts> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true }
    });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Empêcher de désactiver le dernier admin
    if (user.role === UserRole.ADMIN && !isActive) {
      const activeAdminCount = await prisma.user.count({
        where: { 
          role: UserRole.ADMIN,
          isActive: true
        }
      });

      if (activeAdminCount <= 1) {
        throw new Error('CANNOT_DEACTIVATE_LAST_ADMIN');
      }
    }

    return await prisma.user.update({
      where: { id: userId },
      data: { isActive },
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
        _count: {
          select: {
            applications: true,
            notifications: true
          }
        }
      }
    });
  }

  /**
   * Récupérer les statistiques d'administration
   */
  async getAdminStats(): Promise<AdminStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      adminUsers,
      newUsersThisMonth,
      newUsersThisWeek,
      loginsToday,
      loginsThisWeek,
      loginsThisMonth,
      usersByRole
    ] = await Promise.all([
      // Total utilisateurs
      prisma.user.count(),
      
      // Utilisateurs actifs
      prisma.user.count({ where: { isActive: true } }),
      
      // Administrateurs
      prisma.user.count({ where: { role: UserRole.ADMIN } }),
      
      // Nouveaux utilisateurs ce mois
      prisma.user.count({
        where: { createdAt: { gte: startOfMonth } }
      }),
      
      // Nouveaux utilisateurs cette semaine
      prisma.user.count({
        where: { createdAt: { gte: startOfWeek } }
      }),
      
      // Connexions aujourd'hui
      prisma.user.count({
        where: { lastLoginAt: { gte: startOfDay } }
      }),
      
      // Connexions cette semaine
      prisma.user.count({
        where: { lastLoginAt: { gte: startOfWeek } }
      }),
      
      // Connexions ce mois
      prisma.user.count({
        where: { lastLoginAt: { gte: startOfMonth } }
      }),
      
      // Utilisateurs par rôle
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true }
      })
    ]);

    // Transformer les données de rôle
    const roleStats = usersByRole.reduce((acc, item) => {
      acc[item.role] = item._count.role;
      return acc;
    }, {} as Record<UserRole, number>);

    // S'assurer que tous les rôles sont présents
    Object.values(UserRole).forEach(role => {
      if (!(role in roleStats)) {
        roleStats[role] = 0;
      }
    });

    return {
      totalUsers,
      activeUsers,
      adminUsers,
      newUsersThisMonth,
      newUsersThisWeek,
      lastLoginStats: {
        today: loginsToday,
        thisWeek: loginsThisWeek,
        thisMonth: loginsThisMonth
      },
      usersByRole: roleStats
    };
  }

  /**
   * Récupérer l'activité récente des utilisateurs
   */
  async getRecentActivity(limit: number = 10): Promise<UserActivity[]> {
    return await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: {
            applications: true,
            notifications: true
          }
        }
      },
      orderBy: { lastLoginAt: 'desc' },
      take: limit
    }).then(users => 
      users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        lastLoginAt: user.lastLoginAt,
        applicationsCount: user._count.applications,
        notificationsCount: user._count.notifications,
        createdAt: user.createdAt
      }))
    );
  }

  /**
   * Actions en lot sur les utilisateurs
   */
  async bulkUserAction(action: BulkUserAction): Promise<number> {
    const { userIds, action: actionType } = action;

    switch (actionType) {
      case 'activate':
        const activatedResult = await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { isActive: true }
        });
        return activatedResult.count;

      case 'deactivate':
        // Vérifier qu'on ne désactive pas tous les admins
        const adminCount = await prisma.user.count({
          where: { 
            role: UserRole.ADMIN,
            isActive: true,
            id: { notIn: userIds }
          }
        });

        if (adminCount === 0) {
          throw new Error('CANNOT_DEACTIVATE_ALL_ADMINS');
        }

        const deactivatedResult = await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { isActive: false }
        });
        return deactivatedResult.count;

      case 'delete':
        // Vérifier qu'on ne supprime pas tous les admins
        const remainingAdminCount = await prisma.user.count({
          where: { 
            role: UserRole.ADMIN,
            id: { notIn: userIds }
          }
        });

        if (remainingAdminCount === 0) {
          throw new Error('CANNOT_DELETE_ALL_ADMINS');
        }

        const deletedResult = await prisma.user.deleteMany({
          where: { id: { in: userIds } }
        });
        return deletedResult.count;

      default:
        throw new Error('INVALID_ACTION');
    }
  }

  /**
   * Rechercher des utilisateurs avec filtres avancés
   */
  async searchUsersAdvanced(filters: {
    query?: string;
    roles?: UserRole[];
    isActive?: boolean;
    createdAfter?: Date;
    createdBefore?: Date;
    lastLoginAfter?: Date;
    lastLoginBefore?: Date;
    limit?: number;
  }): Promise<UserWithCounts[]> {
    const where: any = {};

    if (filters.query) {
      where.OR = [
        { name: { contains: filters.query, mode: 'insensitive' } },
        { email: { contains: filters.query, mode: 'insensitive' } }
      ];
    }

    if (filters.roles && filters.roles.length > 0) {
      where.role = { in: filters.roles };
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) where.createdAt.gte = filters.createdAfter;
      if (filters.createdBefore) where.createdAt.lte = filters.createdBefore;
    }

    if (filters.lastLoginAfter || filters.lastLoginBefore) {
      where.lastLoginAt = {};
      if (filters.lastLoginAfter) where.lastLoginAt.gte = filters.lastLoginAfter;
      if (filters.lastLoginBefore) where.lastLoginAt.lte = filters.lastLoginBefore;
    }

    return await prisma.user.findMany({
      where,
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
        _count: {
          select: {
            applications: true,
            notifications: true
          }
        }
      },
      take: filters.limit || 50,
      orderBy: { createdAt: 'desc' }
    });
  }
}

export const adminService = new AdminService();
export default adminService;