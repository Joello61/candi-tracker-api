import { prisma } from '../config/database';
import { createSMSClient, smsTemplates } from '../config/sms';
import emailService from './emailService'; // 🆕 Import du nouveau service email Resend
import { NotificationWithUser, NotificationStats, PaginatedNotifications, CreateNotificationData, SMSData } from '../types/notification';
import { NotificationType, NotificationPriority, NotificationSetting, Notification } from '@prisma/client';

export class NotificationService {
  // Service SMS (conservé)
  private static smsClient = createSMSClient();

  // Créer une notification interne
  static async createInternalNotification(data: CreateNotificationData): Promise<Notification> {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data || null,
        priority: data.priority || NotificationPriority.NORMAL,
        actionUrl: data.actionUrl,
      },
    });

    return notification;
  }

  // 🆕 Envoyer un email via Resend (remplace l'ancienne méthode)
  static async sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    try {
      return await emailService.sendEmail({
        to,
        subject,
        html,
        text
      });
    } catch (error) {
      console.error('Erreur envoi email via Resend:', error);
      return false;
    }
  }

  // Envoyer un SMS (conservé)
  static async sendSMS(smsData: SMSData): Promise<boolean> {
    try {
      if (!this.smsClient) {
        console.warn('Client SMS non configuré');
        return false;
      }

      await this.smsClient.messages.create({
        body: smsData.message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: smsData.to,
      });

      console.log(`SMS envoyé à ${smsData.to}`);
      return true;
    } catch (error) {
      console.error('Erreur envoi SMS:', error);
      return false;
    }
  }

  // 🆕 Envoyer une notification complète (mis à jour pour Resend)
  static async sendNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: any,
    priority: NotificationPriority = NotificationPriority.NORMAL,
    actionUrl?: string
  ): Promise<void> {
    try {
      // Récupérer les paramètres de notification de l'utilisateur
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { notificationSettings: true },
      });

      if (!user) {
        console.error('Utilisateur non trouvé:', userId);
        return;
      }

      const settings = user.notificationSettings;

      // Vérifier si ce type de notification est activé
      const isTypeEnabled = this.isNotificationTypeEnabled(type, settings);
      if (!isTypeEnabled) {
        console.log(`Notification ${type} désactivée pour l'utilisateur ${userId}`);
        return;
      }

      // Créer la notification interne
      if (!settings || settings.pushEnabled) {
        await this.createInternalNotification({
          userId,
          type,
          title,
          message,
          data,
          priority,
          actionUrl,
        });
      }

      // 🆕 Envoyer par email via Resend si activé
      if (settings?.emailEnabled && this.shouldSendEmail(type, settings)) {
        await this.sendEmailForType(type, user, data);
      }

      // Envoyer par SMS si activé (conservé)
      if (settings?.smsEnabled && settings.phoneNumber && this.shouldSendSMS(type, settings)) {
        const smsMessage = this.generateSMSFromTemplate(type, { title, message, ...data });
        if (smsMessage) {
          await this.sendSMS({
            to: settings.phoneNumber,
            message: smsMessage,
          });
        }
      }

    } catch (error) {
      console.error('Erreur lors de l\'envoi de notification:', error);
    }
  }

  // 🆕 Envoyer un email selon le type via le service Resend
  private static async sendEmailForType(type: NotificationType, user: any, data: any): Promise<void> {
    try {
      switch (type) {
        case NotificationType.INTERVIEW_REMINDER:
          if (data?.interview) {
            await emailService.sendInterviewReminder(
              { id: user.id, name: user.name, email: user.email },
              data.interview
            );
          }
          break;

        case NotificationType.APPLICATION_FOLLOW_UP:
          if (data?.application) {
            await emailService.sendApplicationFollowUp(
              { id: user.id, name: user.name, email: user.email },
              data.application
            );
          }
          break;

        case NotificationType.WEEKLY_REPORT:
          if (data?.stats) {
            await emailService.sendWeeklyReport(
              { id: user.id, name: user.name, email: user.email },
              data.stats
            );
          }
          break;

        case NotificationType.STATUS_UPDATE:
        case NotificationType.DEADLINE_ALERT:
        case NotificationType.SYSTEM_NOTIFICATION:
        case NotificationType.ACHIEVEMENT:
          // Pour les autres types, envoyer un email générique
          await emailService.sendEmail({
            to: user.email,
            subject: data.title || 'Notification Candi Tracker',
            html: this.generateGenericEmailHTML(data.title, data.message, user.name),
            text: data.message
          });
          break;

        default:
          console.warn(`Type de notification email non géré: ${type}`);
      }
    } catch (error) {
      console.error('Erreur envoi email pour type:', type, error);
    }
  }

  // 🆕 Générer un email HTML générique pour les notifications simples
  private static generateGenericEmailHTML(title: string, message: string, userName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #667eea; padding: 30px; border-radius: 10px; color: white; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 24px;">📋 ${title}</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #667eea; margin-top: 0;">Bonjour ${userName},</h2>
            <p>${message}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/app/dashboard" 
               style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              📊 Voir mon tableau de bord
            </a>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; text-align: center;">
            <p>L'équipe Candi Tracker</p>
          </div>
        </body>
      </html>
    `;
  }

  // 🆕 Méthodes de notifications spécifiques avec Resend

  // Rappel d'entretien
  static async sendInterviewReminder(userId: string, interviewData: any): Promise<void> {
    await this.sendNotification(
      userId,
      NotificationType.INTERVIEW_REMINDER,
      '📅 Rappel d\'entretien',
      `N'oubliez pas votre entretien chez ${interviewData.application?.company}`,
      { interview: interviewData },
      NotificationPriority.HIGH
    );
  }

  // Suivi de candidature
  static async sendApplicationFollowUp(userId: string, applicationData: any): Promise<void> {
    await this.sendNotification(
      userId,
      NotificationType.APPLICATION_FOLLOW_UP,
      '🔔 Suivi de candidature recommandé',
      `Il est temps de relancer votre candidature chez ${applicationData.company}`,
      { application: applicationData },
      NotificationPriority.NORMAL
    );
  }

  // Rapport hebdomadaire
  static async sendWeeklyReport(userId: string, statsData: any): Promise<void> {
    await this.sendNotification(
      userId,
      NotificationType.WEEKLY_REPORT,
      '📊 Votre rapport hebdomadaire',
      `Résumé de vos ${statsData.totalApplications} candidatures cette semaine`,
      { stats: statsData },
      NotificationPriority.LOW
    );
  }

  // Alerte de deadline
  static async sendDeadlineAlert(userId: string, deadlineData: any): Promise<void> {
    await this.sendNotification(
      userId,
      NotificationType.DEADLINE_ALERT,
      '⚠️ Deadline approche',
      deadlineData.message,
      deadlineData,
      NotificationPriority.HIGH
    );
  }

  // Mise à jour de statut
  static async sendStatusUpdate(userId: string, statusData: any): Promise<void> {
    await this.sendNotification(
      userId,
      NotificationType.STATUS_UPDATE,
      '📋 Mise à jour de candidature',
      statusData.message,
      statusData,
      NotificationPriority.NORMAL
    );
  }

  // Achievement/succès
  static async sendAchievement(userId: string, achievementData: any): Promise<void> {
    await this.sendNotification(
      userId,
      NotificationType.ACHIEVEMENT,
      '🎉 Félicitations !',
      achievementData.message,
      achievementData,
      NotificationPriority.LOW
    );
  }

  // Vérifier si un type de notification est activé (conservé)
  private static isNotificationTypeEnabled(type: NotificationType, settings: any): boolean {
    if (!settings) return true; // Par défaut activé si pas de paramètres

    switch (type) {
      case NotificationType.INTERVIEW_REMINDER:
        return settings.interviewReminders;
      case NotificationType.APPLICATION_FOLLOW_UP:
        return settings.applicationFollowUps;
      case NotificationType.WEEKLY_REPORT:
        return settings.weeklyReports;
      case NotificationType.DEADLINE_ALERT:
        return settings.deadlineAlerts;
      case NotificationType.STATUS_UPDATE:
        return settings.statusUpdates;
      default:
        return true;
    }
  }

  // Vérifier si on doit envoyer un email pour ce type (conservé)
  private static shouldSendEmail(type: NotificationType, settings: any): boolean {
    // Certains types ne sont envoyés que par email
    const emailOnlyTypes = new Set<NotificationType>([
      NotificationType.WEEKLY_REPORT,
      NotificationType.APPLICATION_FOLLOW_UP,
    ]);
    
    const alwaysEmailTypes = new Set<NotificationType>([
      NotificationType.INTERVIEW_REMINDER,
      NotificationType.STATUS_UPDATE,
      NotificationType.SYSTEM_NOTIFICATION,
    ]);
    
    return emailOnlyTypes.has(type) || alwaysEmailTypes.has(type);
  }

  // Vérifier si on doit envoyer un SMS pour ce type (conservé)
  private static shouldSendSMS(type: NotificationType, settings: any): boolean {
    // SMS seulement pour les rappels urgents
    const smsOnlyTypes = new Set<NotificationType>([
      NotificationType.INTERVIEW_REMINDER,
      NotificationType.DEADLINE_ALERT,
    ]);
    return smsOnlyTypes.has(type);
  }

  // Générer le message SMS à partir d'un template (conservé)
  private static generateSMSFromTemplate(type: NotificationType, data: any): string | null {
    if (!smsTemplates) {
      return `${data.title}: ${data.message}`;
    }

    switch (type) {
      case NotificationType.INTERVIEW_REMINDER:
        return smsTemplates.interviewReminder?.(data) || `Rappel: entretien ${data.title}`;
      case NotificationType.DEADLINE_ALERT:
        return smsTemplates.applicationDeadline?.(data) || `Alerte: ${data.message}`;
      default:
        return smsTemplates.quickUpdate?.(data) || `${data.title}: ${data.message}`;
    }
  }

  // === MÉTHODES DE GESTION DES NOTIFICATIONS (conservées) ===

  // Récupérer les notifications d'un utilisateur
  static async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false
  ): Promise<PaginatedNotifications> {
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      notifications,
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

  // Marquer une notification comme lue
  static async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    try {
      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId,
        },
      });

      if (!notification) {
        return false;
      }

      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return true;
    } catch (error) {
      console.error('Erreur marquage lecture:', error);
      return false;
    }
  }

  // Marquer toutes les notifications comme lues
  static async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return result.count;
    } catch (error) {
      console.error('Erreur marquage toutes lectures:', error);
      return 0;
    }
  }

  // Supprimer une notification
  static async deleteNotification(userId: string, notificationId: string): Promise<boolean> {
    try {
      const result = await prisma.notification.deleteMany({
        where: {
          id: notificationId,
          userId,
        },
      });

      return result.count > 0;
    } catch (error) {
      console.error('Erreur suppression notification:', error);
      return false;
    }
  }

  // Supprimer les anciennes notifications
  static async cleanupOldNotifications(userId: string, olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await prisma.notification.deleteMany({
        where: {
          userId,
          createdAt: { lt: cutoffDate },
          isRead: true,
        },
      });

      return result.count;
    } catch (error) {
      console.error('Erreur nettoyage notifications:', error);
      return 0;
    }
  }

  // Obtenir les statistiques des notifications
  static async getNotificationStats(userId: string): Promise<NotificationStats> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const [total, unread, typesCounts, priorityCounts, weekCount] = await Promise.all([
      prisma.notification.count({
        where: { userId },
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
      prisma.notification.groupBy({
        by: ['type'],
        where: { userId },
        _count: { type: true },
      }),
      prisma.notification.groupBy({
        by: ['priority'],
        where: { userId },
        _count: { priority: true },
      }),
      prisma.notification.count({
        where: {
          userId,
          createdAt: { gte: startOfWeek },
        },
      }),
    ]);

    // Construire les objets par type et priorité
    const byType: Record<NotificationType, number> = {
      INTERVIEW_REMINDER: 0,
      APPLICATION_FOLLOW_UP: 0,
      DEADLINE_ALERT: 0,
      STATUS_UPDATE: 0,
      WEEKLY_REPORT: 0,
      SYSTEM_NOTIFICATION: 0,
      ACHIEVEMENT: 0,
    };

    const byPriority: Record<NotificationPriority, number> = {
      LOW: 0,
      NORMAL: 0,
      HIGH: 0,
      URGENT: 0,
    };

    typesCounts.forEach(({ type, _count }) => {
      byType[type] = _count.type;
    });

    priorityCounts.forEach(({ priority, _count }) => {
      byPriority[priority] = _count.priority;
    });

    return {
      total,
      unread,
      byType,
      byPriority,
      thisWeek: weekCount,
    };
  }

  // Créer ou mettre à jour les paramètres de notification
  static async updateNotificationSettings(userId: string, settings: Partial<NotificationSetting>): Promise<NotificationSetting> {
    const result = await prisma.notificationSetting.upsert({
      where: { userId },
      update: settings,
      create: {
        userId,
        ...settings,
      },
    });

    return result;
  }

  // Récupérer les paramètres de notification
  static async getNotificationSettings(userId: string): Promise<NotificationSetting | null> {
    return prisma.notificationSetting.findUnique({
      where: { userId },
    });
  }
}