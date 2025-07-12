// src/routes/userRoutes.ts
import { Router } from 'express';
import multer from 'multer';
import {
  getProfile,
  updateProfile,
  changePassword,
  getSettings,
  updateSettings,
  uploadAvatar,
  deleteAvatar,
  deleteAccount,
  searchUsers,
  checkEmailAvailability,
  // NOUVELLES MÉTHODES 2FA
  toggle2FA,
  getSecuritySettings
} from '../controllers/userController';
import { 
  authenticate, 
  requireProfileEditPermission 
} from '../middleware/auth';

const router = Router();

// Configuration multer pour l'upload d'avatar
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Vérifier le type de fichier
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté. Utilisez JPEG, PNG, WebP ou GIF.'));
    }
  }
});

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Gestion du profil
router.get('/profile', getProfile);
router.put('/profile', requireProfileEditPermission, updateProfile);

// Gestion du mot de passe
router.post('/change-password', changePassword);

// Gestion des paramètres généraux
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// === NOUVELLES ROUTES SÉCURITÉ 2FA ===

// Récupérer les paramètres de sécurité (inclut l'état 2FA)
router.get('/security', getSecuritySettings);

// Activer/désactiver la 2FA
router.post('/toggle-2fa', toggle2FA);

// Gestion de l'avatar
router.post('/upload-avatar', avatarUpload.single('avatar'), uploadAvatar);
router.delete('/avatar', deleteAvatar);

// Suppression du compte
router.delete('/account', deleteAccount);

// Utilitaires
router.get('/search', searchUsers);
router.get('/check-email', checkEmailAvailability);

export default router;