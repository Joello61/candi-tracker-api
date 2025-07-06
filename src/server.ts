import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { prisma } from './config/database';
import { errorHandler } from './middleware/errorHandler';

// Import des routes
import authRoutes from './routes/authRoutes';
import applicationRoutes from './routes/applicationRoutes';
import interviewRoutes from './routes/interviewRoutes';
import documentRoutes from './routes/documentRoutes';
import notificationRoutes from './routes/notificationRoutes';
import userRoutes from './routes/userRoutes';           // ← Nouveau
import adminRoutes from './routes/adminRoutes';         // ← Nouveau
import path from 'path';
import { handleUploadErrors } from './middleware/uploadErrorHandler';
import { SchedulerService } from './services/schedulerService';

const app = express();

// Middleware de sécurité
app.use(helmet());

// CORS
app.use(cors({
  origin: config.frontendUrl,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: 'Trop de requêtes depuis cette IP, réessayez plus tard.'
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/api/test-db', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1 as test`;
    res.json({ 
      database: 'OK', 
      message: 'Connexion à la base de données réussie' 
    });
  } catch (error) {
    console.error('Erreur de connexion à la base de données:', error);
    res.status(500).json({ 
      database: 'ERROR', 
      message: 'Erreur de connexion à la base de données' 
    });
  }
});

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes API
app.use('/api/auth', authRoutes);

app.use('/api/applications', applicationRoutes);

app.use('/api/interviews', interviewRoutes);

app.use('/api/documents', documentRoutes);

app.use('/api/notifications', notificationRoutes);

app.use('/api/users', userRoutes);                     // ← Nouveau

app.use('/api/admin', adminRoutes);                    // ← Nouveau

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route non trouvée',
    path: req.path,
    method: req.method
  });
});

// Middleware de gestion des erreurs
app.use(errorHandler);

app.use(handleUploadErrors);

// Démarrage du serveur
const startServer = async () => {
  try {
    await prisma.$connect();

    console.log('✅ Connexion à la base de données établie');
    
    app.listen(config.port, () => {
      console.log(`🚀 Serveur démarré sur le port ${config.port}`);
      console.log(`📊 Environnement: ${config.nodeEnv}`);
      console.log(`🌐 Frontend URL: ${config.frontendUrl}`);
      console.log(`🔗 Health check: http://localhost:${config.port}/api/health`);
      console.log(`🔐 Auth routes:`);
      console.log(`   POST http://localhost:${config.port}/api/auth/register`);
      console.log(`   POST http://localhost:${config.port}/api/auth/login`);
      console.log(`   GET http://localhost:${config.port}/api/auth/profile`);
      console.log(`🔗 Applications routes:`);
      console.log(`   GET/POST http://localhost:${config.port}/api/applications`);
      console.log(`   GET http://localhost:${config.port}/api/applications/stats`);
      console.log(`   GET http://localhost:${config.port}/api/applications/:id`);
      console.log(`🎯 Interviews routes:`);
      console.log(`   GET/POST http://localhost:${config.port}/api/interviews`);
      console.log(`   GET http://localhost:${config.port}/api/interviews/stats`);
      console.log(`   GET http://localhost:${config.port}/api/interviews/upcoming`);
      console.log(`   GET http://localhost:${config.port}/api/interviews/calendar`);
      console.log(`📄 Documents routes:`);
      console.log(`   POST http://localhost:${config.port}/api/documents/upload`);
      console.log(`   GET http://localhost:${config.port}/api/documents`);
      console.log(`   GET http://localhost:${config.port}/api/documents/stats`);
      console.log(`   GET http://localhost:${config.port}/api/documents/:id/download`);
      console.log(`📬 Notifications routes:`);
      console.log(`   GET http://localhost:${config.port}/api/notifications`);
      console.log(`   GET http://localhost:${config.port}/api/notifications/stats`);
      console.log(`   GET http://localhost:${config.port}/api/notifications/settings`);
      console.log(`👤 User routes:`);                 // ← Nouveau
      console.log(`   GET/PUT http://localhost:${config.port}/api/users/profile`);
      console.log(`   POST http://localhost:${config.port}/api/users/change-password`);
      console.log(`   GET/PUT http://localhost:${config.port}/api/users/settings`);
      console.log(`   POST http://localhost:${config.port}/api/users/upload-avatar`);
      console.log(`   DELETE http://localhost:${config.port}/api/users/avatar`);
      console.log(`🔧 Admin routes:`);                // ← Nouveau
      console.log(`   GET http://localhost:${config.port}/api/admin/users`);
      console.log(`   GET http://localhost:${config.port}/api/admin/stats`);
      console.log(`   PUT http://localhost:${config.port}/api/admin/users/:id/role`);
      console.log(`   PUT http://localhost:${config.port}/api/admin/users/:id/status`);

      const startJobs = process.env.START_SCHEDULER === 'true' || config.nodeEnv === 'production';
      if (startJobs) {
        SchedulerService.startAllJobs();
        console.log('📅 Tâches planifiées démarrées');
        } else {
        console.log('📅 Tâches planifiées non démarrées (pour démarrer: START_SCHEDULER=true)');
        }
    });
  } catch (error) {
    console.error('❌ Erreur lors du démarrage:', error);
    process.exit(1);
  }
};

startServer();

// Gestion de l'arrêt gracieux
process.on('SIGTERM', async () => {
  console.log('🔄 Arrêt du serveur...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 Arrêt du serveur (Ctrl+C)...');
  await prisma.$disconnect();
  process.exit(0);
});