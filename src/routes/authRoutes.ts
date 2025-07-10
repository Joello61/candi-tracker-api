import { Router } from 'express';
import {
  register,
  login,
  getProfile,
  refreshToken,
  // Nouvelles méthodes OAuth
  googleAuth,
  googleCallback,
  linkedinAuth,
  linkedinCallback,
  linkSocialAccount,
  unlinkSocialAccount,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { authLimiter, registerLimiter } from '../middleware/rateLimiter';
import { validateRecaptchaV2, validateRecaptchaV3Register } from '../middleware/recaptchaValidation';

const router = Router();

// ===== ROUTES D'AUTHENTIFICATION TRADITIONNELLES =====
router.post(
  '/register',
  registerLimiter,
  validateRecaptchaV3Register,
  register
);

router.post('/login', authLimiter, validateRecaptchaV2, login);

// ===== ROUTES OAUTH GOOGLE =====
// Initier l'authentification Google
router.get('/google', authLimiter, googleAuth);

// Callback Google (appelé par Google après authentification)
router.get('/google/callback', googleCallback);

// ===== ROUTES OAUTH LINKEDIN =====
// Initier l'authentification LinkedIn
router.get('/linkedin', authLimiter, linkedinAuth);

// Callback LinkedIn (appelé par LinkedIn après authentification)
router.get('/linkedin/callback', linkedinCallback);

// ===== ROUTES PROTÉGÉES =====
// Profil utilisateur
router.get('/profile', authenticate, getProfile);

// Rafraîchir le token
router.post('/refresh', authenticate, refreshToken);

// Lier un compte social à un compte existant
router.post('/link-social', authenticate, linkSocialAccount);

// Délier un compte social
router.post('/unlink-social', authenticate, unlinkSocialAccount);

export default router;