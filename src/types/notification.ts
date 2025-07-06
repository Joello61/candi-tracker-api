import { Notification, NotificationSetting, NotificationType, NotificationPriority } from '@prisma/client';

export interface NotificationWithUser extends Notification {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
  thisWeek: number;
}

export interface PaginatedNotifications {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  priority?: NotificationPriority;
  actionUrl?: string;
}

export interface NotificationChannel {
  email?: boolean;
  sms?: boolean;
  push?: boolean;
  internal?: boolean;
}

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SMSData {
  to: string;
  message: string;
}