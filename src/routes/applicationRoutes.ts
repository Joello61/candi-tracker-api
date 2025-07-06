import { Router } from 'express';
import {
  createApplication,
  getApplications,
  getApplicationById,
  updateApplication,
  deleteApplication,
  getApplicationStats,
  getRecentApplications,
} from '../controllers/applicationController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Routes des candidatures
router.post('/', createApplication);
router.get('/', getApplications);
router.get('/stats', getApplicationStats);
router.get('/recent', getRecentApplications);
router.get('/:id', getApplicationById);
router.put('/:id', updateApplication);
router.delete('/:id', deleteApplication);

export default router;