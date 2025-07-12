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
  jwtSecret: process.env.JWT_SECRET as string,
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || '7d') as string,
  databaseUrl: process.env.DATABASE_URL as string,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  // Configuration OAuth (pas de session nécessaire)
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
    },
    linkedin: {
      clientId: process.env.LINKEDIN_CLIENT_ID || '',
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
      callbackUrl: process.env.LINKEDIN_CALLBACK_URL || 'http://localhost:3001/api/auth/linkedin/callback',
    },
  },

  // Configuration email
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendDomain: process.env.RESEND_DOMAIN || '',
  emailFrom: process.env.EMAIL_FROM || 'Candi Tracker <onboarding@candi-tracker-mail.joeltech.dev>',
  
  // Configuration SMS
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  
  // Nettoyage
  notificationCleanupDays: parseInt(process.env.NOTIFICATION_CLEANUP_DAYS || '30', 10),

  // Scheduler
  startScheduler: process.env.START_SCHEDULER === 'true',
} as const;