import { prisma } from '../config/database';
import { ApplicationWithDetails, ApplicationStats, PaginatedApplications, ApplicationFilters } from '../types/application';
import { CreateApplicationInput, UpdateApplicationInput } from '../utils/applicationValidation';
import { ApplicationStatus } from '@prisma/client';

export class ApplicationService {
  static async createApplication(
    userId: string,
    data: CreateApplicationInput
  ): Promise<ApplicationWithDetails> {
    const applicationData = {
      ...data,
      userId,
      appliedAt: data.appliedAt ? new Date(data.appliedAt) : new Date(),
    };

    const application = await prisma.application.create({
      data: applicationData,
      include: {
        interviews: {
          orderBy: { scheduledAt: 'asc' }
        },
        documents: {
          orderBy: { createdAt: 'desc' }
        },
      },
    });

    return application;
  }

  static async getApplications(
    userId: string,
    filters: ApplicationFilters = {},
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedApplications> {
    const skip = (page - 1) * limit;

    // Construction des filtres WHERE
    const where: any = { userId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.company) {
      where.company = {
        contains: filters.company,
        mode: 'insensitive',
      };
    }

    if (filters.search) {
      where.OR = [
        { company: { contains: filters.search, mode: 'insensitive' } },
        { position: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
        { location: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.startDate || filters.endDate) {
      where.appliedAt = {};
      if (filters.startDate) {
        where.appliedAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.appliedAt.lte = new Date(filters.endDate);
      }
    }

    // Construction du tri
    const orderBy: any = {};
    if (filters.sortBy) {
      orderBy[filters.sortBy] = filters.sortOrder || 'desc';
    } else {
      orderBy.appliedAt = 'desc';
    }

    // Exécution des requêtes
    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          interviews: {
            orderBy: { scheduledAt: 'asc' }
          },
          documents: {
            orderBy: { createdAt: 'desc' }
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.application.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      applications,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  static async getApplicationById(
    userId: string,
    applicationId: string
  ): Promise<ApplicationWithDetails | null> {
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        userId,
      },
      include: {
        interviews: {
          orderBy: { scheduledAt: 'asc' }
        },
        documents: {
          orderBy: { createdAt: 'desc' }
        },
      },
    });

    return application;
  }

  static async updateApplication(
    userId: string,
    applicationId: string,
    data: UpdateApplicationInput
  ): Promise<ApplicationWithDetails | null> {
    // Vérifier que l'application appartient à l'utilisateur
    const existingApplication = await prisma.application.findFirst({
      where: {
        id: applicationId,
        userId,
      },
    });

    if (!existingApplication) {
      return null;
    }

    const updateData = {
      ...data,
      appliedAt: data.appliedAt ? new Date(data.appliedAt) : undefined,
    };

    const application = await prisma.application.update({
      where: { id: applicationId },
      data: updateData,
      include: {
        interviews: {
          orderBy: { scheduledAt: 'asc' }
        },
        documents: {
          orderBy: { createdAt: 'desc' }
        },
      },
    });

    return application;
  }

  static async deleteApplication(
    userId: string,
    applicationId: string
  ): Promise<boolean> {
    try {
      await prisma.application.deleteMany({
        where: {
          id: applicationId,
          userId,
        },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  static async getApplicationStats(userId: string): Promise<ApplicationStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    // Compter total et par statut
    const [totalApplications, statusCounts, monthCount, weekCount] = await Promise.all([
      prisma.application.count({
        where: { userId },
      }),
      prisma.application.groupBy({
        by: ['status'],
        where: { userId },
        _count: { status: true },
      }),
      prisma.application.count({
        where: {
          userId,
          appliedAt: { gte: startOfMonth },
        },
      }),
      prisma.application.count({
        where: {
          userId,
          appliedAt: { gte: startOfWeek },
        },
      }),
    ]);

    // Construire l'objet byStatus
    const byStatus: Record<ApplicationStatus, number> = {
      APPLIED: 0,
      UNDER_REVIEW: 0,
      INTERVIEW_SCHEDULED: 0,
      INTERVIEWED: 0,
      OFFER_RECEIVED: 0,
      REJECTED: 0,
      ACCEPTED: 0,
      WITHDRAWN: 0,
    };

    statusCounts.forEach(({ status, _count }) => {
      byStatus[status] = _count.status;
    });

    // Calculer le taux de succès (offres reçues + acceptées / total)
    const successfulApplications = byStatus.OFFER_RECEIVED + byStatus.ACCEPTED;
    const successRate = totalApplications > 0 
      ? Math.round((successfulApplications / totalApplications) * 100) 
      : 0;

    // Pour le temps de réponse moyen, on pourrait l'implémenter plus tard
    // en comparant les dates de candidature avec les premières réponses
    const averageResponseTime = null;

    return {
      total: totalApplications,
      byStatus,
      thisMonth: monthCount,
      thisWeek: weekCount,
      averageResponseTime,
      successRate,
    };
  }

  static async getRecentApplications(
    userId: string,
    limit: number = 5
  ): Promise<ApplicationWithDetails[]> {
    const applications = await prisma.application.findMany({
      where: { userId },
      include: {
        interviews: {
          orderBy: { scheduledAt: 'asc' }
        },
        documents: {
          orderBy: { createdAt: 'desc' }
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return applications;
  }
}