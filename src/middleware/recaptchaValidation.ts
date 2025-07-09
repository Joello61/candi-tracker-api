// middleware/recaptchaValidation.ts
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

interface RecaptchaResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  score?: number; // Pour reCAPTCHA v3
  action?: string; // Pour reCAPTCHA v3
  'error-codes'?: string[];
}

interface RecaptchaValidationOptions {
  minScore?: number; // Pour reCAPTCHA v3 (0.0 à 1.0)
  expectedAction?: string; // Pour reCAPTCHA v3
  skipOnMissingToken?: boolean; // Passer si pas de token (pour dev)
  logValidations?: boolean; // Logger les validations
}

export class RecaptchaService {
  private static readonly VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
  
  /**
   * Vérifie un token reCAPTCHA auprès de Google
   */
  static async verifyToken(
    token: string, 
    userIP?: string,
    options: RecaptchaValidationOptions = {}
  ): Promise<{ valid: boolean; score?: number; error?: string }> {
    
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    
    if (!secretKey) {
      console.error('RECAPTCHA_SECRET_KEY manquante dans les variables d\'environnement');
      return { valid: false, error: 'Configuration reCAPTCHA manquante' };
    }

    if (!token || token.trim() === '') {
      return { valid: false, error: 'Token reCAPTCHA vide' };
    }

    try {
      // Préparer les données pour Google
      const requestData = new URLSearchParams({
        secret: secretKey,
        response: token,
        ...(userIP && { remoteip: userIP })
      });

      const startTime = Date.now();

      // Appel API Google reCAPTCHA
      const response = await axios.post<RecaptchaResponse>(
        this.VERIFY_URL,
        requestData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000, // Timeout de 10 secondes
        }
      );

      const verificationTime = Date.now() - startTime;
      const { success, score, action, 'error-codes': errorCodes } = response.data;

      // Logging optionnel
      if (options.logValidations) {
        console.log(`🔍 reCAPTCHA verification:`, {
          success,
          score,
          action,
          verificationTime: `${verificationTime}ms`,
          userIP,
          errorCodes
        });
      }

      // Vérification de base
      if (!success) {
        const errorMsg = this.getErrorMessage(errorCodes);
        console.warn(`reCAPTCHA échec:`, { errorCodes, userIP });
        return { valid: false, error: errorMsg };
      }

      // Vérification pour reCAPTCHA v3 (score)
      if (score !== undefined) {
        const minScore = options.minScore || 0.5; // Seuil par défaut
        
        if (score < minScore) {
          console.warn(`reCAPTCHA score trop bas:`, { score, minScore, userIP });
          return { 
            valid: false, 
            score, 
            error: `Score de confiance insuffisant (${score})` 
          };
        }

        // Vérification de l'action (optionnel)
        if (options.expectedAction && action !== options.expectedAction) {
          console.warn(`reCAPTCHA action incorrecte:`, { 
            expected: options.expectedAction, 
            received: action, 
            userIP 
          });
          return { 
            valid: false, 
            error: `Action reCAPTCHA incorrecte` 
          };
        }
      }

      // Succès !
      return { valid: true, score };

    } catch (error) {
      console.error('Erreur lors de la vérification reCAPTCHA:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          return { valid: false, error: 'Timeout de vérification reCAPTCHA' };
        }
        if (error.response?.status! >= 500) {
          return { valid: false, error: 'Service reCAPTCHA temporairement indisponible' };
        }
      }
      
      return { valid: false, error: 'Erreur de vérification reCAPTCHA' };
    }
  }

  /**
   * Convertit les codes d'erreur Google en messages lisibles
   */
  private static getErrorMessage(errorCodes?: string[]): string {
    if (!errorCodes || errorCodes.length === 0) {
      return 'Vérification reCAPTCHA échouée';
    }

    const errorMessages: Record<string, string> = {
      'missing-input-secret': 'Configuration reCAPTCHA incorrecte',
      'invalid-input-secret': 'Clé secrète reCAPTCHA invalide',
      'missing-input-response': 'Token reCAPTCHA manquant',
      'invalid-input-response': 'Token reCAPTCHA invalide ou expiré',
      'bad-request': 'Requête reCAPTCHA malformée',
      'timeout-or-duplicate': 'Token reCAPTCHA expiré ou déjà utilisé'
    };

    const firstError = errorCodes[0];
    return errorMessages[firstError] || `Erreur reCAPTCHA: ${firstError}`;
  }
}

// ===== MIDDLEWARES =====

/**
 * Middleware principal de validation reCAPTCHA
 */
export const validateRecaptcha = (options: RecaptchaValidationOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { recaptchaToken } = req.body;
    const userIP = req.ip;

    // Cas spéciaux
    if (!recaptchaToken) {
      if (options.skipOnMissingToken && process.env.NODE_ENV === 'development') {
        console.log('reCAPTCHA ignoré en mode développement');
        return next();
      }
      
      res.status(400).json({
        error: 'Token reCAPTCHA manquant',
        code: 'RECAPTCHA_MISSING'
      });
      return;
    }

    try {
      const result = await RecaptchaService.verifyToken(recaptchaToken, userIP, options);

      if (!result.valid) {
        // Logging de sécurité
        console.warn(`Tentative avec reCAPTCHA invalide:`, {
          ip: userIP,
          userAgent: req.get('User-Agent'),
          endpoint: req.originalUrl,
          error: result.error,
          timestamp: new Date().toISOString()
        });

        res.status(400).json({
          error: result.error || 'Vérification reCAPTCHA échouée',
          code: 'RECAPTCHA_INVALID'
        });
        return;
      }

      // Succès - ajouter les infos reCAPTCHA à la requête
      (req as any).recaptcha = {
        score: result.score,
        verifiedAt: new Date()
      };

      // Supprimer le token des données pour la suite
      delete req.body.recaptchaToken;

      next();

    } catch (error) {
      console.error('Erreur validation reCAPTCHA middleware:', error);
      
      res.status(500).json({
        error: 'Erreur interne de validation reCAPTCHA',
        code: 'RECAPTCHA_ERROR'
      });
      return;
    }
  };
};

/**
 * Middleware reCAPTCHA v2 (cocher la case)
 */
export const validateRecaptchaV2 = validateRecaptcha({
  logValidations: true
});

/**
 * Middleware reCAPTCHA v3 pour inscription (score élevé requis)
 */
export const validateRecaptchaV3Register = validateRecaptcha({
  minScore: 0.7, // Score élevé pour inscription
  expectedAction: 'register',
  logValidations: true
});

/**
 * Middleware reCAPTCHA v3 pour connexion (score modéré)
 */
export const validateRecaptchaV3Login = validateRecaptcha({
  minScore: 0.5, // Score modéré pour connexion
  expectedAction: 'login',
  logValidations: true
});

/**
 * Middleware reCAPTCHA v3 pour actions sensibles (score très élevé)
 */
export const validateRecaptchaV3Sensitive = validateRecaptcha({
  minScore: 0.8, // Score très élevé
  logValidations: true
});

/**
 * Middleware reCAPTCHA permissif pour développement
 */
export const validateRecaptchaDev = validateRecaptcha({
  minScore: 0.1, // Très permissif
  skipOnMissingToken: true,
  logValidations: false
});

// ===== UTILITAIRES =====

/**
 * Middleware conditionnel selon l'environnement
 */
export const getEnvironmentRecaptcha = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';
  
  if (isDevelopment || isTest) {
    console.log('Mode développement: reCAPTCHA permissif activé');
    return validateRecaptchaDev;
  }
  
  return validateRecaptchaV2; // Production par défaut
};

/**
 * Middleware pour ignorer reCAPTCHA pour certaines IPs
 */
export const createWhitelistRecaptcha = (whitelist: string[], fallbackMiddleware: any) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (whitelist.includes(req.ip!)) {
      console.log(`reCAPTCHA ignoré pour IP whitelistée: ${req.ip}`);
      // Supprimer quand même le token pour éviter les erreurs
      delete req.body.recaptchaToken;
      return next();
    }
    return fallbackMiddleware(req, res, next);
  };
};

/**
 * Vérifie si reCAPTCHA est configuré
 */
export const checkRecaptchaConfig = (): boolean => {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  
  if (!secretKey) {
    console.error('RECAPTCHA_SECRET_KEY manquante dans .env');
    return false;
  }
  
  if (secretKey.length < 10) {
    console.error('RECAPTCHA_SECRET_KEY semble invalide (trop courte)');
    return false;
  }
  
  console.log('Configuration reCAPTCHA valide');
  return true;
};

/**
 * Middleware de vérification de configuration au démarrage
 */
export const ensureRecaptchaConfig = (req: Request, res: Response, next: NextFunction): void => {
  if (!checkRecaptchaConfig()) {
    res.status(500).json({
      error: 'Configuration reCAPTCHA manquante',
      code: 'RECAPTCHA_CONFIG_ERROR'
    });
    return;
  }
  next();
};

/**
 * Middleware de monitoring des validations reCAPTCHA
 */
export const recaptchaMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    // Logger les échecs reCAPTCHA
    if (res.statusCode === 400 && data.includes('RECAPTCHA')) {
      console.log(`reCAPTCHA failed:`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

// Export des middlewares les plus utilisés
export {
  validateRecaptcha as default,
};