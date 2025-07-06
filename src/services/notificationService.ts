import { prisma } from '../config/database';
import { createEmailTransporter, emailTemplates } from '../config/email';
import { createSMSClient, smsTemplates } from '../config/sms';
import { NotificationWithUser, NotificationStats, PaginatedNotifications, CreateNotificationData, EmailData, SMSData } from '../types/notification';
import { NotificationType, NotificationPriority, NotificationSetting, Notification } from '@prisma/client';
import handlebars from 'handlebars';

export class NotificationService {
  // Service email
  private static emailTransporter = createEmailTransporter();
  
  // Service SMS
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

  // Envoyer un email
  static async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      if (!this.emailTransporter) {
        console.warn('Transporteur email non configuré');
        return false;
      }

      await this.emailTransporter.sendMail({
        from: process.env.EMAIL_FROM || 'Job Tracker <noreply@jobtracker.com>',
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
      });

      console.log(`Email envoyé à ${emailData.to}`);
      return true;
    } catch (error) {
      console.error('Erreur envoi email:', error);
      return false;
    }
  }

  // Envoyer un SMS
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

  // Envoyer une notification complète (tous canaux)
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

      // Envoyer par email si activé
      if (settings?.emailEnabled && this.shouldSendEmail(type, settings)) {
        const emailHtml = this.generateEmailFromTemplate(type, { title, message, ...data });
        if (emailHtml) {
          await this.sendEmail({
            to: user.email,
            subject: title,
            html: emailHtml,
            text: message,
          });
        }
      }

      // Envoyer par SMS si activé
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

  // Vérifier si un type de notification est activé
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

  // Vérifier si on doit envoyer un email pour ce type
  private static shouldSendEmail(type: NotificationType, settings: any): boolean {
    // Certains types ne sont envoyés que par email
    const emailOnlyTypes = new Set<NotificationType>([
        NotificationType.WEEKLY_REPORT,
        NotificationType.APPLICATION_FOLLOW_UP,
    ]);
    
    return emailOnlyTypes.has(type);
  }

  // Vérifier si on doit envoyer un SMS pour ce type
  private static shouldSendSMS(type: NotificationType, settings: any): boolean {
    // SMS seulement pour les rappels urgents
    const smsOnlyTypes = new Set<NotificationType>([
        NotificationType.INTERVIEW_REMINDER,
        NotificationType.DEADLINE_ALERT,
    ]);
    return smsOnlyTypes.has(type);
  }

  // Générer le HTML d'email à partir d'un template
  private static generateEmailFromTemplate(type: NotificationType, data: any): string | null {
    let template;
    
    switch (type) {
      case NotificationType.INTERVIEW_REMINDER:
        template = emailTemplates.interviewReminder.template;
        break;
      case NotificationType.APPLICATION_FOLLOW_UP:
        template = emailTemplates.applicationFollowUp.template;
        break;
      case NotificationType.WEEKLY_REPORT:
        template = emailTemplates.weeklyReport.template;
        break;
      default:
        return `<p>${data.message}</p>`;
    }

    try {
      const compiledTemplate = handlebars.compile(template);
      return compiledTemplate(data);
    } catch (error) {
      console.error('Erreur compilation template:', error);
      return `<p>${data.message}</p>`;
    }
  }

  // Générer le message SMS à partir d'un template
  private static generateSMSFromTemplate(type: NotificationType, data: any): string | null {
    switch (type) {
      case NotificationType.INTERVIEW_REMINDER:
        return smsTemplates.interviewReminder(data);
      case NotificationType.DEADLINE_ALERT:
        return smsTemplates.applicationDeadline(data);
      default:
        return smsTemplates.quickUpdate(data);
    }
  }

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