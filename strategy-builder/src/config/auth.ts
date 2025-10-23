/**
 * Authentication Configuration
 * JWT and authentication settings
 */

export const authConfig = {
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    algorithm: 'HS256' as const
  },

  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10)
  },

  oauth: {
    enabled: process.env.OAUTH_ENABLED === 'true',
    providers: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackUrl: process.env.GOOGLE_CALLBACK_URL || ''
      }
    }
  },

  session: {
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000', 10), // 24 hours
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict' as const
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100
  }
};
