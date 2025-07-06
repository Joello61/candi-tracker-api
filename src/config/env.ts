import dotenv from 'dotenv';

dotenv.config();

// Validation des variables d'environnement critiques
const requiredEnvVars = {
  JWT_SECRET: process.env.JWT_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
};

// Vérifier que les variables critiques sont définies
for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    throw new Error(`Variable d'environnement requise manquante: ${key}`);
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET as string, // On sait qu'elle est définie grâce à la validation ci-dessus
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || '7d') as string,
  databaseUrl: process.env.DATABASE_URL as string, // On sait qu'elle est définie grâce à la validation ci-dessus
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  // Configuration email
  emailHost: process.env.EMAIL_HOST || 'smtp.gmail.com',
  emailPort: parseInt(process.env.EMAIL_PORT || '587', 10),
  emailSecure: process.env.EMAIL_SECURE === 'true',
  emailUser: process.env.EMAIL_USER || '',
  emailPassword: process.env.EMAIL_PASSWORD || '',
  emailFrom: process.env.EMAIL_FROM || 'Job Tracker <noreply@jobtracker.com>',
  
  // Configuration SMS
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  
  // Nettoyage
  notificationCleanupDays: parseInt(process.env.NOTIFICATION_CLEANUP_DAYS || '30', 10),

  // Scheduler
  startScheduler: process.env.START_SCHEDULER === 'true',
} as const;