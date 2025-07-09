import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { prisma } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import path from 'path';
import { handleUploadErrors } from './middleware/uploadErrorHandler';
import { SchedulerService } from './services/schedulerService';

import { 
  getEnvironmentLimiter, 
  rateLimitLogger,
  generalLimiter 
} from './middleware/rateLimiter';
import { 
  recaptchaMonitoring,
  checkRecaptchaConfig 
} from './middleware/recaptchaValidation';

// Import des routes
import authRoutes from './routes/authRoutes';
import applicationRoutes from './routes/applicationRoutes';
import interviewRoutes from './routes/interviewRoutes';
import documentRoutes from './routes/documentRoutes';
import notificationRoutes from './routes/notificationRoutes';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';

const app = express();

// Helmet avec configuration renforcée
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Trust proxy pour obtenir la vraie IP
app.set('trust proxy', 1);

// MONITORING DE SÉCURITÉ 
app.use(rateLimitLogger);
app.use(recaptchaMonitoring);

// RATE LIMITING INTELLIGENT
// Rate limiting global adapté à l'environnement
app.use(getEnvironmentLimiter());

// CORS SÉCURISÉ
app.use(cors({
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // Vérifier si l'origine est autorisée
    const allowedOrigins = [
      config.frontendUrl,
      'http://localhost:3000', // Dev frontend
      'http://127.0.0.1:3000'  // Dev frontend alternatif
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Origine CORS non autorisée: ${origin}`);
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin'
  ]
}));

// BODY PARSING AVEC SÉCURITÉ
app.use(express.json({ 
  limit: '10mb',
  type: ['application/json', 'text/plain'] // Limiter les types acceptés
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// HEADERS DE SÉCURITÉ PERSONNALISÉS
app.use((req, res, next) => {
  // Politique CORP pour les ressources
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  
  // Empêcher le sniffing MIME
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Protection XSS supplémentaire
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Pas de cache pour les réponses sensibles
  if (req.path.includes('/api/auth') || req.path.includes('/api/admin')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
});

// ROUTES DE SANTÉ
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.nodeEnv,
    security: {
      rateLimiting: 'active',
      recaptcha: checkRecaptchaConfig() ? 'configured' : 'missing',
      cors: 'enforced',
      helmet: 'active'
    }
  });
});

app.get('/api/test-db', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1 as test`;
    res.json({ 
      database: 'OK', 
      message: 'Connexion à la base de données réussie',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erreur de connexion à la base de données:', error);
    res.status(500).json({ 
      database: 'ERROR', 
      message: 'Erreur de connexion à la base de données',
      timestamp: new Date().toISOString()
    });
  }
});

// SÉCURITÉ DES FICHIERS STATIQUES
app.use('/uploads', (req, res, next) => {
  // Empêcher l'exécution de scripts dans le dossier uploads
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  next();
}, express.static(path.join(process.cwd(), 'uploads')));

// ROUTES API AVEC PROTECTION

// Routes d'authentification (déjà protégées par rate limiting dans authRoutes)
app.use('/api/auth', authRoutes);

// Routes applicatives (protection générale)
app.use('/api/applications', applicationRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);

// Routes admin (protection renforcée)
app.use('/api/admin', adminRoutes);

// ===== GESTION DES ERREURS 404 =====
app.use((req, res) => {
  // Logger les tentatives d'accès à des routes inexistantes
  console.warn(`Route 404 tentée:`, {
    ip: req.ip,
    path: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  
  res.status(404).json({ 
    error: 'Route non trouvée',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// MIDDLEWARES DE GESTION DES ERREURS
app.use(handleUploadErrors);
app.use(errorHandler);

// ===== VÉRIFICATIONS DE SÉCURITÉ AU DÉMARRAGE =====
const performSecurityChecks = (): boolean => {
  let allGood = true;
  
  console.log('\nVérifications de sécurité...');
  
  // Vérifier reCAPTCHA
  if (checkRecaptchaConfig()) {
    console.log('Configuration reCAPTCHA valide');
  } else {
    console.warn('Configuration reCAPTCHA manquante ou invalide');
    if (config.nodeEnv === 'production') {
      allGood = false;
    }
  }
  
  // Vérifier variables critiques
  const criticalVars = [
    'JWT_SECRET',
    'DATABASE_URL',
    'FRONTEND_URL'
  ];
  
  for (const varName of criticalVars) {
    if (!process.env[varName]) {
      console.error(`Variable d'environnement manquante: ${varName}`);
      allGood = false;
    } else {
      console.log(`${varName} configuré`);
    }
  }
  
  // Vérifier la sécurité JWT
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    console.warn('JWT_SECRET trop court (< 32 caractères)');
    if (config.nodeEnv === 'production') {
      allGood = false;
    }
  }
  
  // Vérifier l'environnement de production
  if (config.nodeEnv === 'production') {
    const productionChecks = [
      { name: 'HTTPS', check: config.frontendUrl.startsWith('https://') },
      { name: 'NODE_ENV', check: process.env.NODE_ENV === 'production' }
    ];
    
    for (const { name, check } of productionChecks) {
      if (check) {
        console.log(`${name} configuré pour la production`);
      } else {
        console.error(`${name} non configuré pour la production`);
        allGood = false;
      }
    }
  }
  
  console.log(allGood ? 'Toutes les vérifications passées\n' : 'Certaines vérifications ont échoué\n');
  return allGood;
};

// DÉMARRAGE DU SERVEUR
const startServer = async () => {
  try {
    // Vérifications de sécurité
    const securityOk = performSecurityChecks();
    
    if (!securityOk && config.nodeEnv === 'production') {
      console.error('Arrêt: Vérifications de sécurité échouées en production');
      process.exit(1);
    }
    
    // Connexion base de données
    await prisma.$connect();
    console.log('Connexion à la base de données établie');
    
    app.listen(config.port, () => {
      console.log(`Serveur démarré sur le port ${config.port}`);
      console.log(`Environnement: ${config.nodeEnv}`);
      console.log(`Frontend URL: ${config.frontendUrl}`);
      console.log(`Sécurité: Rate limiting + Helmet + reCAPTCHA`);
      console.log(`Health check: http://localhost:${config.port}/api/health`);
      
      // Routes principales
      console.log(`\nRoutes d'authentification (protégées par rate limiting + reCAPTCHA):`);
      console.log(`   POST http://localhost:${config.port}/api/auth/register`);
      console.log(`   POST http://localhost:${config.port}/api/auth/login`);
      console.log(`   GET  http://localhost:${config.port}/api/auth/profile`);
      
      console.log(`\nRoutes applicatives (protégées par rate limiting):`);
      console.log(`   GET/POST http://localhost:${config.port}/api/applications`);
      console.log(`   GET      http://localhost:${config.port}/api/applications/stats`);
      console.log(`   GET/POST http://localhost:${config.port}/api/interviews`);
      console.log(`   GET      http://localhost:${config.port}/api/interviews/calendar`);
      console.log(`   POST     http://localhost:${config.port}/api/documents/upload`);
      console.log(`   GET      http://localhost:${config.port}/api/notifications`);
      
      console.log(`\nRoutes utilisateur:`);
      console.log(`   GET/PUT  http://localhost:${config.port}/api/users/profile`);
      console.log(`   POST     http://localhost:${config.port}/api/users/change-password`);
      console.log(`   POST     http://localhost:${config.port}/api/users/upload-avatar`);
      
      console.log(`\nRoutes admin (protection renforcée):`);
      console.log(`   GET      http://localhost:${config.port}/api/admin/users`);
      console.log(`   GET      http://localhost:${config.port}/api/admin/stats`);
      console.log(`   PUT      http://localhost:${config.port}/api/admin/users/:id/role`);

      // Démarrage des tâches planifiées
      const startJobs = process.env.START_SCHEDULER === 'true' || config.nodeEnv === 'production';
      if (startJobs) {
        SchedulerService.startAllJobs();
        console.log('\nTâches planifiées démarrées');
      } else {
        console.log('\nTâches planifiées non démarrées (pour démarrer: START_SCHEDULER=true)');
      }
      
      console.log('\nServeur prêt et sécurisé !');
    });
    
  } catch (error) {
    console.error('Erreur lors du démarrage:', error);
    process.exit(1);
  }
};

// ===== GESTION DE L'ARRÊT GRACIEUX =====
const gracefulShutdown = async (signal: string) => {
  console.log(`\nArrêt du serveur (${signal})...`);
  
  try {
    // Arrêter les tâches planifiées
    if (SchedulerService) {
      SchedulerService.stopAllJobs();
      console.log('Tâches planifiées arrêtées');
    }
    
    // Fermer la connexion base de données
    await prisma.$disconnect();
    console.log('Connexion base de données fermée');
    
    console.log('Arrêt gracieux terminé');
    process.exit(0);
    
  } catch (error) {
    console.error('Erreur lors de l\'arrêt gracieux:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT (Ctrl+C)'));

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('Exception non capturée:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesse rejetée non gérée:', reason);
  gracefulShutdown('unhandledRejection');
});

// Démarrer le serveur
startServer();