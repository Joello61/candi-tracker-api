import { prisma } from '../config/database';
import { InterviewWithApplication, InterviewStats, PaginatedInterviews, InterviewFilters, CalendarEvent } from '../types/interview';
import { CreateInterviewInput, UpdateInterviewInput } from '../utils/interviewValidation';
import { InterviewType } from '@prisma/client';

export class InterviewService {
  // Vérifier que l'application appartient à l'utilisateur
  private static async verifyApplicationOwnership(
    userId: string,
    applicationId: string
  ): Promise<boolean> {
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        userId,
      },
    });
    return !!application;
  }

  // Vérifier que l'entretien appartient à l'utilisateur
  private static async verifyInterviewOwnership(
    userId: string,
    interviewId: string
  ): Promise<boolean> {
    const interview = await prisma.interview.findFirst({
      where: {
        id: interviewId,
        application: {
          userId,
        },
      },
    });
    return !!interview;
  }

  static async createInterview(
    userId: string,
    data: CreateInterviewInput
  ): Promise<InterviewWithApplication | null> {
    // Vérifier que l'application appartient à l'utilisateur
    const ownsApplication = await this.verifyApplicationOwnership(userId, data.applicationId);
    if (!ownsApplication) {
      return null;
    }

    // Vérifier qu'il n'y a pas de conflit de planning
    const conflictingInterview = await prisma.interview.findFirst({
      where: {
        application: { userId },
        scheduledAt: new Date(data.scheduledAt),
      },
    });

    if (conflictingInterview) {
      throw new Error('Un entretien est déjà programmé à cette heure');
    }

    const interview = await prisma.interview.create({
      data: {
        ...data,
        scheduledAt: new Date(data.scheduledAt),
        interviewers: data.interviewers || [],
      },
      include: {
        application: {
          select: {
            id: true,
            company: true,
            position: true,
            status: true,
          },
        },
      },
    });

    return interview;
  }

  static async getInterviews(
    userId: string,
    filters: InterviewFilters = {},
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedInterviews> {
    const skip = (page - 1) * limit;
    const now = new Date();

    // Construction des filtres WHERE
    const where: any = {
      application: { userId },
    };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.applicationId) {
      where.applicationId = filters.applicationId;
    }

    if (filters.upcoming) {
      where.scheduledAt = { gte: now };
    } else if (filters.past) {
      where.scheduledAt = { lt: now };
    }

    if (filters.startDate || filters.endDate) {
      where.scheduledAt = {};
      if (filters.startDate) {
        where.scheduledAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.scheduledAt.lte = new Date(filters.endDate);
      }
    }

    // Construction du tri
    const orderBy: any = {};
    if (filters.sortBy) {
      orderBy[filters.sortBy] = filters.sortOrder || 'asc';
    } else {
      orderBy.scheduledAt = 'asc';
    }

    // Exécution des requêtes
    const [interviews, total] = await Promise.all([
      prisma.interview.findMany({
        where,
        include: {
          application: {
            select: {
              id: true,
              company: true,
              position: true,
              status: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.interview.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      interviews,
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

  static async getInterviewById(
    userId: string,
    interviewId: string
  ): Promise<InterviewWithApplication | null> {
    const interview = await prisma.interview.findFirst({
      where: {
        id: interviewId,
        application: { userId },
      },
      include: {
        application: {
          select: {
            id: true,
            company: true,
            position: true,
            status: true,
          },
        },
      },
    });

    return interview;
  }

  static async updateInterview(
    userId: string,
    interviewId: string,
    data: UpdateInterviewInput
  ): Promise<InterviewWithApplication | null> {
    // Vérifier que l'entretien appartient à l'utilisateur
    const ownsInterview = await this.verifyInterviewOwnership(userId, interviewId);
    if (!ownsInterview) {
      return null;
    }

    // Vérifier les conflits de planning si la date change
    if (data.scheduledAt) {
      const conflictingInterview = await prisma.interview.findFirst({
        where: {
          application: { userId },
          scheduledAt: new Date(data.scheduledAt),
          NOT: { id: interviewId },
        },
      });

      if (conflictingInterview) {
        throw new Error('Un entretien est déjà programmé à cette heure');
      }
    }

    const updateData = {
      ...data,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
    };

    const interview = await prisma.interview.update({
      where: { id: interviewId },
      data: updateData,
      include: {
        application: {
          select: {
            id: true,
            company: true,
            position: true,
            status: true,
          },
        },
      },
    });

    return interview;
  }

  static async deleteInterview(
    userId: string,
    interviewId: string
  ): Promise<boolean> {
    try {
      // Vérifier que l'entretien appartient à l'utilisateur
      const ownsInterview = await this.verifyInterviewOwnership(userId, interviewId);
      if (!ownsInterview) {
        return false;
      }

      await prisma.interview.delete({
        where: { id: interviewId },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  static async getInterviewStats(userId: string): Promise<InterviewStats> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const nextWeekStart = new Date(endOfWeek);
    nextWeekStart.setDate(endOfWeek.getDate() + 1);
    nextWeekStart.setHours(0, 0, 0, 0);

    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
    nextWeekEnd.setHours(23, 59, 59, 999);

    // Requêtes parallèles pour les statistiques
    const [
      totalInterviews,
      upcomingInterviews,
      completedInterviews,
      typesCounts,
      thisWeekCount,
      nextWeekCount,
      averageDurationResult,
    ] = await Promise.all([
      prisma.interview.count({
        where: { application: { userId } },
      }),
      prisma.interview.count({
        where: {
          application: { userId },
          scheduledAt: { gte: now },
        },
      }),
      prisma.interview.count({
        where: {
          application: { userId },
          scheduledAt: { lt: now },
        },
      }),
      prisma.interview.groupBy({
        by: ['type'],
        where: { application: { userId } },
        _count: { type: true },
      }),
      prisma.interview.count({
        where: {
          application: { userId },
          scheduledAt: {
            gte: startOfWeek,
            lte: endOfWeek,
          },
        },
      }),
      prisma.interview.count({
        where: {
          application: { userId },
          scheduledAt: {
            gte: nextWeekStart,
            lte: nextWeekEnd,
          },
        },
      }),
      prisma.interview.aggregate({
        where: {
          application: { userId },
          duration: { not: null },
        },
        _avg: { duration: true },
      }),
    ]);

    // Construire l'objet byType
    const byType: Record<InterviewType, number> = {
      PHONE: 0,
      VIDEO: 0,
      ONSITE: 0,
      TECHNICAL: 0,
      HR: 0,
      FINAL: 0,
    };

    typesCounts.forEach(({ type, _count }) => {
      byType[type] = _count.type;
    });

    return {
      total: totalInterviews,
      upcoming: upcomingInterviews,
      completed: completedInterviews,
      byType,
      thisWeek: thisWeekCount,
      nextWeek: nextWeekCount,
      averageDuration: averageDurationResult._avg.duration || null,
    };
  }

  static async getUpcomingInterviews(
    userId: string,
    limit: number = 5
  ): Promise<InterviewWithApplication[]> {
    const now = new Date();

    const interviews = await prisma.interview.findMany({
      where: {
        application: { userId },
        scheduledAt: { gte: now },
      },
      include: {
        application: {
          select: {
            id: true,
            company: true,
            position: true,
            status: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });

    return interviews;
  }

  static async getCalendarEvents(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<CalendarEvent[]> {
    const interviews = await prisma.interview.findMany({
      where: {
        application: { userId },
        scheduledAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        application: {
          select: {
            company: true,
            position: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return interviews.map(interview => {
      const start = interview.scheduledAt;
      const end = new Date(start);
      if (interview.duration) {
        end.setMinutes(start.getMinutes() + interview.duration);
      } else {
        end.setHours(start.getHours() + 1); // Durée par défaut: 1h
      }

      return {
        id: interview.id,
        title: `${interview.application.company} - ${interview.application.position}`,
        start: start.toISOString(),
        end: end.toISOString(),
        type: interview.type,
        company: interview.application.company,
        position: interview.application.position,
        notes: interview.notes || undefined,
        interviewers: interview.interviewers,
      };
    });
  }

  static async checkConflicts(
    userId: string,
    scheduledAt: string,
    duration?: number,
    excludeInterviewId?: string
  ): Promise<InterviewWithApplication[]> {
    const proposedStart = new Date(scheduledAt);
    const proposedEnd = new Date(proposedStart);
    
    if (duration) {
      proposedEnd.setMinutes(proposedStart.getMinutes() + duration);
    } else {
      proposedEnd.setHours(proposedStart.getHours() + 1);
    }

    const where: any = {
      application: { userId },
      OR: [
        // L'entretien existant commence pendant le nouvel entretien
        {
          scheduledAt: {
            gte: proposedStart,
            lt: proposedEnd,
          },
        },
        // Le nouvel entretien commence pendant un entretien existant
        {
          AND: [
            { scheduledAt: { lte: proposedStart } },
            // On considère une durée par défaut d'1h si pas spécifiée
          ],
        },
      ],
    };

    if (excludeInterviewId) {
      where.NOT = { id: excludeInterviewId };
    }

    const conflicts = await prisma.interview.findMany({
      where,
      include: {
        application: {
          select: {
            id: true,
            company: true,
            position: true,
            status: true,
          },
        },
      },
    });

    return conflicts;
  }
}