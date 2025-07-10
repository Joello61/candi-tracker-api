import passport from 'passport';
import { Strategy as GoogleStrategy, Profile as GoogleProfile, VerifyCallback } from 'passport-google-oauth20';
import { Strategy as OAuth2Strategy } from 'passport-oauth2'; // Import OAuth2Strategy générique
import { config } from './env';
import { prisma } from './database';

// Interface pour l'utilisateur OAuth (compatible avec Express.User)
interface OAuthUser {
  id: string;
  email: string;
  name: string;
  role: any; // Utilisation de any pour éviter les conflits de types
  isActive: boolean;
  emailVerified: boolean;
  provider?: string;
  providerId?: string;
  googleId?: string;
  linkedinId?: string;
}

// Configuration Google OAuth (inchangée)
if (config.oauth.google.clientId && config.oauth.google.clientSecret) {
  passport.use('google', new GoogleStrategy({
    clientID: config.oauth.google.clientId,
    clientSecret: config.oauth.google.clientSecret,
    callbackURL: config.oauth.google.callbackUrl,
    scope: ['profile', 'email']
  },
  async (
    accessToken: string, 
    refreshToken: string, 
    profile: GoogleProfile, 
    done: VerifyCallback
  ) => {
    try {
      console.log('Google OAuth profile:', {
        id: profile.id,
        email: profile.emails?.[0]?.value,
        name: profile.displayName
      });

      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(new Error('Email non fourni par Google'), undefined);
      }

      // Vérifier si un utilisateur existe déjà avec cet email
      let user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          emailVerified: true,
          googleId: true,
          provider: true,
          providerId: true,
        }
      });

      if (user) {
        // Utilisateur existant - mettre à jour les informations Google si nécessaire
        if (!user.googleId) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              googleId: profile.id,
              provider: user.provider || 'google',
              providerId: user.providerId || profile.id,
              emailVerified: true,
              lastLoginAt: new Date(),
            },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
              emailVerified: true,
              googleId: true,
              provider: true,
              providerId: true,
            }
          });
        } else {
          // Juste mettre à jour la dernière connexion
          user = await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
              emailVerified: true,
              googleId: true,
              provider: true,
              providerId: true,
            }
          });
        }
      } else {
        // Nouvel utilisateur - créer le compte
        user = await prisma.user.create({
          data: {
            email,
            name: profile.displayName || 'Utilisateur Google',
            googleId: profile.id,
            provider: 'google',
            providerId: profile.id,
            emailVerified: true,
            lastLoginAt: new Date(),
            // password: null (OAuth user)
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            emailVerified: true,
            googleId: true,
            provider: true,
            providerId: true,
          }
        });

        // Créer les paramètres utilisateur par défaut
        await prisma.userSettings.create({
          data: {
            userId: user.id
          }
        });
      }

      if (!user.isActive) {
        return done(new Error('Compte désactivé'), undefined);
      }

      // Créer l'objet utilisateur compatible (conversion null -> undefined)
      const oauthUser: OAuthUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        provider: user.provider || undefined,
        providerId: user.providerId || undefined,
        googleId: user.googleId || undefined,
      };

      return done(null, oauthUser);
    } catch (error) {
      console.error('Erreur Google OAuth:', error);
      return done(error as Error, undefined);
    }
  }
  ));
}

// Configuration LinkedIn OAuth avec OAuth2Strategy générique (SOLUTION FINALE)
if (config.oauth.linkedin.clientId && config.oauth.linkedin.clientSecret) {
  passport.use('linkedin', new OAuth2Strategy({
    authorizationURL: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenURL: 'https://www.linkedin.com/oauth/v2/accessToken',
    clientID: config.oauth.linkedin.clientId,
    clientSecret: config.oauth.linkedin.clientSecret,
    callbackURL: config.oauth.linkedin.callbackUrl,
    scope: ['openid', 'profile', 'email'] // Scopes OpenID Connect
  },
  async (accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      // Récupérer manuellement les données du profil LinkedIn via l'API userinfo
      const response = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'cache-control': 'no-cache',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('LinkedIn API Error Response:', errorText);
        throw new Error(`LinkedIn API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const userInfo = await response.json();

      console.log('LinkedIn OpenID Connect userinfo:', {
        sub: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        given_name: userInfo.given_name,
        family_name: userInfo.family_name,
        picture: userInfo.picture
      });

      const email = userInfo.email;
      if (!email) {
        return done(new Error('Email non fourni par LinkedIn'), undefined);
      }

      // Construire le nom complet
      const name = userInfo.name || 
                  `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim() ||
                  'Utilisateur LinkedIn';

      // Vérifier si un utilisateur existe déjà avec cet email
      let user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          emailVerified: true,
          linkedinId: true,
          provider: true,
          providerId: true,
        }
      });

      if (user) {
        // Utilisateur existant - mettre à jour les informations LinkedIn si nécessaire
        if (!user.linkedinId) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              linkedinId: userInfo.sub, // 'sub' est l'identifiant unique OpenID
              provider: user.provider || 'linkedin',
              providerId: user.providerId || userInfo.sub,
              emailVerified: true,
              lastLoginAt: new Date(),
            },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
              emailVerified: true,
              linkedinId: true,
              provider: true,
              providerId: true,
            }
          });
        } else {
          // Juste mettre à jour la dernière connexion
          user = await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
              emailVerified: true,
              linkedinId: true,
              provider: true,
              providerId: true,
            }
          });
        }
      } else {
        // Nouvel utilisateur - créer le compte
        user = await prisma.user.create({
          data: {
            email,
            name,
            linkedinId: userInfo.sub, // 'sub' est l'identifiant unique OpenID
            provider: 'linkedin',
            providerId: userInfo.sub,
            emailVerified: true, // Email vérifié par LinkedIn
            lastLoginAt: new Date(),
            // password: null (OAuth user)
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            emailVerified: true,
            linkedinId: true,
            provider: true,
            providerId: true,
          }
        });

        // Créer les paramètres utilisateur par défaut
        await prisma.userSettings.create({
          data: {
            userId: user.id
          }
        });
      }

      if (!user.isActive) {
        return done(new Error('Compte désactivé'), undefined);
      }

      // Créer l'objet utilisateur compatible (conversion null -> undefined)
      const oauthUser: OAuthUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        provider: user.provider || undefined,
        providerId: user.providerId || undefined,
        linkedinId: user.linkedinId || undefined,
      };

      return done(null, oauthUser);
    } catch (error) {
      console.error('Erreur LinkedIn OAuth:', error);
      return done(error as Error, undefined);
    }
  }
  ));
}

export default passport;