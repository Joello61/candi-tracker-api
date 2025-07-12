import { Router } from 'express';
import {
  register,
  login,
  getProfile,
  refreshToken,
  // Nouvelles méthodes de vérification
  verifyEmail,
  verify2FA,
  resendVerificationCode,
  // Méthodes OAuth existantes
  googleAuth,
  googleCallback,
  linkedinAuth,
  linkedinCallback,
  linkSocialAccount,
  unlinkSocialAccount,
  forgotPassword,
  resetPassword,
  verifyResetCode,
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

// ===== NOUVELLES ROUTES DE VÉRIFICATION =====

// Vérifier l'email après inscription
router.post('/verify-email', authLimiter, verifyEmail);

// Vérifier le code 2FA lors de la connexion
router.post('/verify-2fa', authLimiter, verify2FA);

// Renvoyer un code de vérification
router.post('/resend-code', authLimiter, resendVerificationCode);

// ===== ROUTES OAUTH GOOGLE =====
router.get('/google', authLimiter, googleAuth);
router.get('/google/callback', googleCallback);

// ===== ROUTES OAUTH LINKEDIN =====
router.get('/linkedin', authLimiter, linkedinAuth);
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

// Demander un code de réinitialisation
router.post('/forgot-password', authLimiter, forgotPassword);

// Réinitialiser le mot de passe avec le code
router.post('/reset-password', authLimiter, resetPassword);

// Vérifier la validité d'un code de réinitialisation (optionnel)
router.post('/verify-reset-code', authLimiter, verifyResetCode);

export default router;