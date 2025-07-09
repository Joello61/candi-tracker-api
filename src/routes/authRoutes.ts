import { Router } from 'express';
import {
  register,
  login,
  getProfile,
  refreshToken,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { authLimiter, registerLimiter } from '../middleware/rateLimiter';
import { validateRecaptchaV2, validateRecaptchaV3Register } from '../middleware/recaptchaValidation';

const router = Router();

// Routes publiques
router.post(
  '/register',
  registerLimiter,
  validateRecaptchaV3Register,
  register
);
router.post('/login', authLimiter, validateRecaptchaV2, login);

// Routes protégées
router.get('/profile', authenticate, getProfile);
router.post('/refresh', authenticate, refreshToken);

export default router;
