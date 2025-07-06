import { Router } from 'express';
import {
  createInterview,
  getInterviews,
  getInterviewById,
  updateInterview,
  deleteInterview,
  getInterviewStats,
  getUpcomingInterviews,
  getCalendarEvents,
  checkConflicts,
} from '../controllers/interviewController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Routes des entretiens
router.post('/', createInterview);
router.get('/', getInterviews);
router.get('/stats', getInterviewStats);
router.get('/upcoming', getUpcomingInterviews);
router.get('/calendar', getCalendarEvents);
router.get('/check-conflicts', checkConflicts);
router.get('/:id', getInterviewById);
router.put('/:id', updateInterview);
router.delete('/:id', deleteInterview);

export default router;