import { Router } from 'express';
import {
  createVerificationCode,
  verifyCode,
  getVerificationMethods,
  getVerificationHistory,
  checkRateLimit
} from '../controllers/verificationController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { authLimiter, generalLimiter } from '../middleware/rateLimiter';

const router = Router();

// === ROUTES PUBLIQUES (avec authentification) ===

// Obtenir les méthodes de vérification disponibles
router.get(
  '/methods',
  authenticate,
  getVerificationMethods
);

// Vérifier le statut de rate limiting
router.get(
  '/rate-limit',
  authenticate,
  checkRateLimit
);

// Créer et envoyer un code de vérification
router.post(
  '/send-code',
  authLimiter, // Rate limiting pour éviter le spam
  authenticate,
  createVerificationCode
);

// Vérifier un code
router.post(
  '/verify-code',
  generalLimiter, // Rate limiting strict pour les tentatives de vérification
  authenticate,
  verifyCode
);

// === ROUTES ADMIN ===

// Historique des codes (admin seulement)
router.get(
  '/history/:userId',
  authenticate,
  requireAdmin,
  getVerificationHistory
);

export default router;