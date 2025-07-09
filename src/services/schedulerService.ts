import * as cron from 'node-cron';
import { prisma } from '../config/database';
import { NotificationService } from './notificationService';
import { NotificationType, NotificationPriority } from '@prisma/client';

export class SchedulerService {
  private static tasks: Map<string, cron.ScheduledTask> = new Map();
  private static jobStatus: Map<string, boolean> = new Map(); // Suivi manuel de l'état

  // Démarrer tous les crons
  static startAllJobs(): void {
    this.startInterviewReminders();
    this.startApplicationFollowUps();
    this.startWeeklyReports();
    this.startCleanupJobs();
    
    console.log('Tous les jobs de notification sont démarrés');
  }

  // Arrêter tous les crons
  static stopAllJobs(): void {
    this.tasks.forEach((task, name) => {
      task.stop();
      this.jobStatus.set(name, false); // Marquer comme arrêté
      console.log(`Job arrêté: ${name}`);
    });
    this.tasks.clear();
    this.jobStatus.clear();
  }

  // Rappels d'entretiens - toutes les 15 minutes
  private static startInterviewReminders(): void {
    const task = cron.schedule('*/15 * * * *', async () => {
      await this.checkInterviewReminders();
    });

    this.tasks.set('interviewReminders', task);
    this.jobStatus.set('interviewReminders', true); // Marquer comme démarré
    task.start();
    console.log('Job rappels d\'entretiens démarré (toutes les 15 min)');
  }

  // Suivi des candidatures - tous les jours à 10h
  private static startApplicationFollowUps(): void {
    const task = cron.schedule('0 10 * * *', async () => {
      await this.checkApplicationFollowUps();
    });

    this.tasks.set('applicationFollowUps', task);
    this.jobStatus.set('applicationFollowUps', true); // Marquer comme démarré
    task.start();
    console.log('Job suivi candidatures démarré (10h tous les jours)');
  }

  // Rapports hebdomadaires - dimanche à 18h
  private static startWeeklyReports(): void {
    const task = cron.schedule('0 18 * * 0', async () => {
      await this.sendWeeklyReports();
    });

    this.tasks.set('weeklyReports', task);
    this.jobStatus.set('weeklyReports', true); // Marquer comme démarré
    task.start();
    console.log('Job rapports hebdomadaires démarré (dimanche 18h)');
  }

  // Nettoyage - tous les jours à 2h du matin
  private static startCleanupJobs(): void {
    const task = cron.schedule('0 2 * * *', async () => {
      await this.runCleanupJobs();
    });

    this.tasks.set('cleanup', task);
    this.jobStatus.set('cleanup', true); // Marquer comme démarré
    task.start();
    console.log('🧹 Job nettoyage démarré (2h tous les jours)');
  }

  // Vérifier les rappels d'entretiens
  private static async checkInterviewReminders(): Promise<void> {
    try {
      const now = new Date();
      console.log(`Vérification des rappels d'entretiens - ${now.toISOString()}`);
      
      // Récupérer tous les utilisateurs avec leurs paramètres
      const users = await prisma.user.findMany({
        include: { notificationSettings: true }
      });

      for (const user of users) {
        const settings = user.notificationSettings;
        if (!settings?.interviewReminders) continue;

        // Vérifier les entretiens à venir
        const upcomingInterviews = await prisma.interview.findMany({
          where: {
            application: { userId: user.id },
            scheduledAt: { gt: now },
          },
          include: {
            application: true,
          },
          orderBy: { scheduledAt: 'asc' },
        });

        for (const interview of upcomingInterviews) {
          const timeDiff = interview.scheduledAt.getTime() - now.getTime();
          const minutesUntil = Math.floor(timeDiff / (1000 * 60));

          // Vérifier les différents timing de rappels
          const reminderTimings = [
            settings.reminderTiming1, // 24h avant
            settings.reminderTiming2, // 1h avant  
            settings.reminderTiming3, // 15min avant
          ];

          for (const timing of reminderTimings) {
            if (Math.abs(minutesUntil - timing) <= 7) { // Tolérance de 7 minutes
              await this.sendInterviewReminder(user.id, interview, minutesUntil);
              break; // Un seul rappel par vérification
            }
          }
        }
      }
    } catch (error) {
      console.error('Erreur vérification rappels entretiens:', error);
    }
  }

  // Envoyer un rappel d'entretien
  private static async sendInterviewReminder(userId: string, interview: any, minutesUntil: number): Promise<void> {
    try {
      const timeUntil = this.formatTimeUntil(minutesUntil);
      const interviewDate = interview.scheduledAt.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const priority = minutesUntil <= 60 ? NotificationPriority.HIGH : NotificationPriority.NORMAL;

      console.log(`Envoi rappel entretien: ${interview.application.company} dans ${timeUntil} pour utilisateur ${userId}`);

      await NotificationService.sendNotification(
        userId,
        NotificationType.INTERVIEW_REMINDER,
        `Entretien ${interview.application.company} dans ${timeUntil}`,
        `Votre entretien ${interview.type} chez ${interview.application.company} approche !`,
        {
          company: interview.application.company,
          position: interview.application.position,
          type: interview.type,
          date: interviewDate,
          timeUntil,
          duration: interview.duration || 60,
          notes: interview.notes,
          interviewers: interview.interviewers.join(', '),
        },
        priority,
        `/applications/${interview.applicationId}`
      );
    } catch (error) {
      console.error('Erreur envoi rappel entretien:', error);
    }
  }

  // Vérifier les candidatures nécessitant un suivi
  private static async checkApplicationFollowUps(): Promise<void> {
    try {
      const now = new Date();
      const followUpThreshold = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 jours
      
      console.log(`Vérification des suivis de candidatures - ${now.toISOString()}`);

      const users = await prisma.user.findMany({
        include: { notificationSettings: true }
      });

      for (const user of users) {
        const settings = user.notificationSettings;
        if (!settings?.applicationFollowUps) continue;

        // Candidatures sans réponse depuis 7 jours
        const applicationsToFollowUp = await prisma.application.findMany({
          where: {
            userId: user.id,
            status: { in: ['APPLIED', 'UNDER_REVIEW'] },
            appliedAt: { lt: followUpThreshold },
          },
          orderBy: { appliedAt: 'asc' },
        });

        for (const application of applicationsToFollowUp) {
          const daysSince = Math.floor((now.getTime() - application.appliedAt.getTime()) / (1000 * 60 * 60 * 24));
          
          // Envoyer un rappel tous les 7 jours
          if (daysSince % 7 === 0) {
            console.log(`Envoi rappel suivi: ${application.company} (${daysSince} jours) pour utilisateur ${user.id}`);
            
            await NotificationService.sendNotification(
              user.id,
              NotificationType.APPLICATION_FOLLOW_UP,
              `Suivi candidature ${application.company}`,
              `Il serait peut-être temps de faire un suivi pour votre candidature !`,
              {
                company: application.company,
                position: application.position,
                daysSince,
                appliedDate: application.appliedAt.toLocaleDateString('fr-FR'),
              },
              NotificationPriority.NORMAL,
              `/applications/${application.id}`
            );
          }
        }
      }
    } catch (error) {
      console.error('Erreur vérification suivi candidatures:', error);
    }
  }

  // Envoyer les rapports hebdomadaires
  private static async sendWeeklyReports(): Promise<void> {
    try {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      
      console.log(`Génération des rapports hebdomadaires - ${now.toISOString()}`);

      const users = await prisma.user.findMany({
        include: { notificationSettings: true }
      });

      for (const user of users) {
        const settings = user.notificationSettings;
        if (!settings?.weeklyReports) continue;

        // Statistiques de la semaine
        const [newApplications, interviews, upcomingInterviews] = await Promise.all([
          prisma.application.count({
            where: {
              userId: user.id,
              createdAt: { gte: weekStart },
            },
          }),
          prisma.interview.count({
            where: {
              application: { userId: user.id },
              createdAt: { gte: weekStart },
            },
          }),
          prisma.interview.findMany({
            where: {
              application: { userId: user.id },
              scheduledAt: { 
                gte: now,
                lt: new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000))
              },
            },
            include: { application: true },
            orderBy: { scheduledAt: 'asc' },
            take: 5,
          }),
        ]);

        const upcomingInterviewsData = upcomingInterviews.map(interview => ({
          company: interview.application.company,
          position: interview.application.position,
          date: interview.scheduledAt.toLocaleDateString('fr-FR'),
          time: interview.scheduledAt.toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
        }));

        console.log(`Envoi rapport hebdomadaire pour utilisateur ${user.id}: ${newApplications} candidatures, ${interviews} entretiens`);

        await NotificationService.sendNotification(
          user.id,
          NotificationType.WEEKLY_REPORT,
          'Votre rapport hebdomadaire',
          `Cette semaine: ${newApplications} candidatures, ${interviews} entretiens programmés`,
          {
            newApplications,
            interviews,
            responses: 0, // À implémenter selon vos besoins
            upcomingInterviews: upcomingInterviewsData,
          },
          NotificationPriority.LOW
        );
      }
    } catch (error) {
      console.error('Erreur envoi rapports hebdomadaires:', error);
    }
  }

  // Tâches de nettoyage
  private static async runCleanupJobs(): Promise<void> {
    try {
      console.log(`Démarrage du nettoyage - ${new Date().toISOString()}`);
      
      const users = await prisma.user.findMany();
      let totalCleaned = 0;
      
      for (const user of users) {
        // Nettoyer les anciennes notifications
        const cleaned = await NotificationService.cleanupOldNotifications(user.id, 30);
        totalCleaned += cleaned;
      }
      
      console.log(`Nettoyage terminé: ${totalCleaned} notifications supprimées`);
    } catch (error) {
      console.error('Erreur nettoyage:', error);
    }
  }

  // Formater le temps restant
  private static formatTimeUntil(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      return `${hours} heure${hours > 1 ? 's' : ''}`;
    } else {
      const days = Math.floor(minutes / 1440);
      return `${days} jour${days > 1 ? 's' : ''}`;
    }
  }

  // Programmer une notification ponctuelle
  static async scheduleOneTimeNotification(
    executeAt: Date,
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: any,
    priority: NotificationPriority = NotificationPriority.NORMAL
  ): Promise<void> {
    const delay = executeAt.getTime() - Date.now();
    
    if (delay <= 0) {
      // Exécuter immédiatement si la date est dans le passé
      await NotificationService.sendNotification(userId, type, title, message, data, priority);
      return;
    }

    console.log(`Notification programmée pour ${executeAt.toISOString()} (dans ${Math.round(delay / 1000 / 60)} minutes)`);

    // Programmer avec setTimeout
    setTimeout(async () => {
      console.log(`Exécution notification programmée: ${title}`);
      await NotificationService.sendNotification(userId, type, title, message, data, priority);
    }, delay);
  }

  // Arrêter un job spécifique
  static stopJob(jobName: string): boolean {
    const task = this.tasks.get(jobName);
    if (task) {
      task.stop();
      this.jobStatus.set(jobName, false); // Marquer comme arrêté
      console.log(`Job arrêté: ${jobName}`);
      return true;
    }
    console.warn(`Job non trouvé: ${jobName}`);
    return false;
  }

  // Redémarrer un job spécifique
  static restartJob(jobName: string): boolean {
    const task = this.tasks.get(jobName);
    if (task) {
      task.start();
      this.jobStatus.set(jobName, true); // Marquer comme démarré
      console.log(`Job redémarré: ${jobName}`);
      return true;
    }
    console.warn(`Job non trouvé: ${jobName}`);
    return false;
  }

  // Obtenir le statut de tous les jobs
  static getJobsStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    
    // Convertir la Map en objet
    this.jobStatus.forEach((isRunning, jobName) => {
      status[jobName] = isRunning;
    });

    return status;
  }

  // Méthode pour obtenir des informations détaillées sur les jobs
  static getJobsInfo(): Record<string, { 
    running: boolean; 
    description: string;
    schedule: string;
  }> {
    const jobDescriptions = {
      interviewReminders: {
        description: 'Rappels automatiques d\'entretiens',
        schedule: 'Toutes les 15 minutes'
      },
      applicationFollowUps: {
        description: 'Suivi des candidatures sans réponse',
        schedule: 'Tous les jours à 10h'
      },
      weeklyReports: {
        description: 'Rapports hebdomadaires d\'activité',
        schedule: 'Dimanche à 18h'
      },
      cleanup: {
        description: 'Nettoyage des anciennes données',
        schedule: 'Tous les jours à 2h du matin'
      }
    };

    const info: Record<string, { running: boolean; description: string; schedule: string }> = {};
    
    this.jobStatus.forEach((isRunning, jobName) => {
      info[jobName] = {
        running: isRunning,
        description: jobDescriptions[jobName as keyof typeof jobDescriptions]?.description || 'Description non disponible',
        schedule: jobDescriptions[jobName as keyof typeof jobDescriptions]?.schedule || 'Planification non définie'
      };
    });

    return info;
  }

  // Vérifier si un job spécifique est en cours d'exécution
  static isJobRunning(jobName: string): boolean {
    return this.jobStatus.get(jobName) || false;
  }

  // Lister tous les jobs disponibles
  static getAvailableJobs(): string[] {
    return Array.from(this.tasks.keys());
  }

  // Forcer l'exécution d'un job immédiatement (pour les tests)
  static async forceRunJob(jobName: string): Promise<boolean> {
    try {
      console.log(`Exécution forcée du job: ${jobName}`);
      
      switch (jobName) {
        case 'interviewReminders':
          await this.checkInterviewReminders();
          break;
        case 'applicationFollowUps':
          await this.checkApplicationFollowUps();
          break;
        case 'weeklyReports':
          await this.sendWeeklyReports();
          break;
        case 'cleanup':
          await this.runCleanupJobs();
          break;
        default:
          console.warn(`Job inconnu: ${jobName}`);
          return false;
      }
      
      console.log(`Job ${jobName} exécuté avec succès`);
      return true;
    } catch (error) {
      console.error(`Erreur lors de l'exécution forcée du job ${jobName}:`, error);
      return false;
    }
  }

  // Obtenir les statistiques d'exécution
  static getExecutionStats(): Record<string, any> {
    return {
      totalJobs: this.tasks.size,
      runningJobs: Array.from(this.jobStatus.values()).filter(status => status).length,
      lastCheck: new Date().toISOString(),
      jobsList: this.getAvailableJobs()
    };
  }
}