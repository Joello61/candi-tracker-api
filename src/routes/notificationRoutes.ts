import { Router } from 'express';
import {
  getNotifications,
  getNotificationStats,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationSettings,
  updateNotificationSettings,
  createNotification,
  cleanupNotifications,
} from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Routes des notifications
router.get('/', getNotifications);
router.get('/stats', getNotificationStats);
router.post('/', createNotification);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllAsRead);
router.delete('/:id', deleteNotification);
router.delete('/cleanup', cleanupNotifications);

// Routes des paramètres
router.get('/settings', getNotificationSettings);
router.put('/settings', updateNotificationSettings);

export default router;