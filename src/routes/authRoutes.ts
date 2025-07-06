    import { Router } from 'express';
    import { register, login, getProfile, refreshToken } from '../controllers/authController';
    import { authenticate } from '../middleware/auth';

    const router = Router();

    // Routes publiques
    router.post('/register', register);
    router.post('/login', login);

    // Routes protégées
    router.get('/profile', authenticate, getProfile);
    router.post('/refresh', authenticate, refreshToken);

    export default router;