import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Rate limiter général pour toute l'application
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Maximum 100 requêtes par IP dans la fenêtre
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de requêtes depuis cette IP, veuillez réessayer dans 15 minutes.',
    retryAfter: 15 * 60 // en secondes
  },
  // Handler personnalisé pour les erreurs
  handler: (req: Request, res: Response) => {
    console.warn(`Rate limit dépassé pour IP: ${req.ip} - URL: ${req.originalUrl}`);
    
    res.status(429).json({
      error: 'Trop de requêtes depuis cette IP, veuillez réessayer dans 15 minutes.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now()) / 1000)
    });
  },
  // Skip les requêtes réussies pour certaines routes
  skipSuccessfulRequests: false,
  // Skip les requêtes qui échouent
  skipFailedRequests: false,
});


// Rate limiter strict pour l'authentification (login/register)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 tentatives par IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
    retryAfter: 15 * 60
  },
  handler: (req: Request, res: Response) => {
    console.warn(`Auth rate limit dépassé pour IP: ${req.ip} - Endpoint: ${req.originalUrl}`);
    
    res.status(429).json({
      error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now()) / 1000),
      hint: 'Utilisez "Mot de passe oublié" si vous avez des difficultés à vous connecter.'
    });
  },
  // Ne pas compter les requêtes réussies pour permettre plusieurs connexions valides
  skipSuccessfulRequests: true,
});

// Rate limiter très strict pour l'inscription
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 3, // Maximum 3 inscriptions par heure par IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Limite d\'inscription atteinte. Vous pouvez créer maximum 3 comptes par heure.',
    retryAfter: 60 * 60
  },
  handler: (req: Request, res: Response) => {
    console.warn(`Register rate limit dépassé pour IP: ${req.ip}`);
    
    res.status(429).json({
      error: 'Limite d\'inscription atteinte. Vous pouvez créer maximum 3 comptes par heure.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now()) / 1000),
      hint: 'Contactez le support si vous rencontrez des difficultés.'
    });
  },
});

// Rate limiter pour la réinitialisation de mot de passe
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 3, // Maximum 3 demandes de reset par heure
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de demandes de réinitialisation. Réessayez dans 1 heure.',
    retryAfter: 60 * 60
  },
  handler: (req: Request, res: Response) => {
    console.warn(`Password reset rate limit dépassé pour IP: ${req.ip}`);
    
    res.status(429).json({
      error: 'Trop de demandes de réinitialisation. Réessayez dans 1 heure.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now()) / 1000)
    });
  },
});

// Rate limiter pour les API sensibles (CRUD)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Plus généreux pour les utilisateurs connectés
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de requêtes API. Réessayez dans quelques minutes.',
    retryAfter: 15 * 60
  },
  handler: (req: Request, res: Response) => {
    console.warn(`API rate limit dépassé pour IP: ${req.ip} - Endpoint: ${req.originalUrl}`);
    
    res.status(429).json({
      error: 'Trop de requêtes API. Réessayez dans quelques minutes.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now()) / 1000)
    });
  },
});

// Rate limiter pour les uploads de fichiers
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 20, // Maximum 20 uploads par heure
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Limite d\'upload atteinte. Maximum 20 fichiers par heure.',
    retryAfter: 60 * 60
  },
  handler: (req: Request, res: Response) => {
    console.warn(`Upload rate limit dépassé pour IP: ${req.ip}`);
    
    res.status(429).json({
      error: 'Limite d\'upload atteinte. Maximum 20 fichiers par heure.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now()) / 1000)
    });
  },
});

// Rate limiter dynamique basé sur l'utilisateur authentifié
export const createUserBasedLimiter = (maxRequests: number, windowMs: number) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Utiliser l'ID utilisateur si connecté, sinon l'IP
      const user = (req as any).user; // Ajustez selon votre système d'auth
      return user?.id || req.ip;
    },
    message: {
      error: 'Limite personnelle atteinte. Réessayez plus tard.',
      retryAfter: Math.ceil(windowMs / 1000)
    }
  });
};

// Rate limiter strict pour les tentatives de connexion par email
export const createEmailBasedLoginLimiter = () => {
  const attempts = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: Function): void => {
    const email = req.body?.email?.toLowerCase();
    
    if (!email) {
      return next();
    }
    
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 5;
    
    // Nettoyer les anciennes entrées
    for (const [key, value] of attempts.entries()) {
      if (now > value.resetTime) {
        attempts.delete(key);
      }
    }
    
    const attempt = attempts.get(email) || { count: 0, resetTime: now + windowMs };
    
    if (attempt.count >= maxAttempts && now < attempt.resetTime) {
      console.warn(`Email-based rate limit dépassé pour: ${email}`);
      
      res.status(429).json({
        error: `Trop de tentatives de connexion pour cette adresse email. Réessayez dans ${Math.ceil((attempt.resetTime - now) / (60 * 1000))} minutes.`,
        retryAfter: Math.ceil((attempt.resetTime - now) / 1000)
      });
      return;
    }
    
    // Incrémenter le compteur seulement en cas d'échec
    // (vous devrez appeler incrementEmailAttempt() dans votre controller en cas d'échec)
    (req as any).incrementEmailAttempt = () => {
      attempt.count++;
      if (attempt.count === 1) {
        attempt.resetTime = now + windowMs;
      }
      attempts.set(email, attempt);
    };
    
    next();
  };
};

// Export des instances spécialisées
export const emailBasedLoginLimiter = createEmailBasedLoginLimiter();
export const userBasedApiLimiter = createUserBasedLimiter(500, 60 * 60 * 1000); // 500 req/heure par utilisateur


// Fonction pour whitelister certaines IPs (développement/admin)
export const createWhitelistLimiter = (whitelist: string[], limiter: any) => {
  return (req: Request, res: Response, next: Function): void => {
    if (whitelist.includes(req.ip!)) {
      return next(); // Skip rate limiting pour les IPs whitelistées
    }
    return limiter(req, res, next);
  };
};

// Export d'un limiter de développement plus permissif
export const devLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Très permissif pour le développement
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit (dev mode)' }
});


export const getEnvironmentLimiter = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';
  
  if (isDevelopment || isTest) {
    console.log('Mode développement: Rate limiting permissif activé');
    return devLimiter;
  }
  
  return generalLimiter;
};

// Middleware pour logger les rate limits
export const rateLimitLogger = (req: Request, res: Response, next: Function): void => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.statusCode === 429) {
      console.log(`Rate limit hit:`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    }
    return originalSend.call(this, data);
  };
  
  next();
};