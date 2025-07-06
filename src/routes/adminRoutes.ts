import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  changeUserRole,
  toggleUserStatus,
  getAdminStats,
  getRecentActivity,
  bulkUserAction,
  searchUsersAdvanced
} from '../controllers/adminController';
import { 
  authenticate, 
  requireAdmin 
} from '../middleware/auth';

const router = Router();

// Toutes les routes nécessitent une authentification et des droits admin
router.use(authenticate, requireAdmin);

// Gestion des utilisateurs
router.get('/users', getAllUsers);
router.get('/users/search', searchUsersAdvanced);
router.get('/users/:id', getUserById);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Actions spécifiques sur les utilisateurs
router.put('/users/:id/role', changeUserRole);
router.put('/users/:id/status', toggleUserStatus);

// Actions en lot
router.post('/users/bulk-action', bulkUserAction);

// Statistiques et monitoring
router.get('/stats', getAdminStats);
router.get('/activity', getRecentActivity);

export default router;