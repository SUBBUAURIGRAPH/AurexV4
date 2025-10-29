/**
 * JWT Authentication Module
 * Handles JWT token generation, verification, and session management
 * @version 1.0.0
 */

const crypto = require('crypto');

/**
 * JWT Authentication Manager
 * @class JWTAuth
 * @description Manages JWT token lifecycle, verification, and session management
 */
class JWTAuth {
  /**
   * Initialize JWT Authentication
   * @param {Object} config - Configuration object
   * @param {string} config.secret - JWT signing secret (uses random if not provided)
   * @param {number} config.accessTokenExpiry - Access token expiry in seconds (default: 3600)
   * @param {number} config.refreshTokenExpiry - Refresh token expiry in seconds (default: 86400)
   */
  constructor(config = {}) {
    this.secret = config.secret || crypto.randomBytes(32).toString('hex');
    this.accessTokenExpiry = config.accessTokenExpiry || 3600; // 1 hour
    this.refreshTokenExpiry = config.refreshTokenExpiry || 86400; // 24 hours

    // In-memory token store (for development)
    // In production, use a database or Redis
    this.tokenStore = new Map();
    this.sessionStore = new Map();
  }

  /**
   * Generate JWT token
   * @param {Object} payload - Token payload
   * @param {string} payload.userId - User ID
   * @param {string} payload.username - Username
   * @param {Array} payload.roles - User roles
   * @param {number} expirySeconds - Token expiry in seconds
   * @returns {string} JWT token
   */
  generateToken(payload, expirySeconds = this.accessTokenExpiry) {
    const now = Math.floor(Date.now() / 1000);
    const tokenPayload = {
      ...payload,
      iat: now,
      exp: now + expirySeconds,
      jti: crypto.randomBytes(16).toString('hex') // JWT ID for uniqueness
    };

    // Create token: header.payload.signature
    const header = Buffer.from(JSON.stringify({
      alg: 'HS256',
      typ: 'JWT'
    })).toString('base64');

    const body = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(`${header}.${body}`)
      .digest('base64');

    const token = `${header}.${body}.${signature}`;

    // Store token in session store
    this.tokenStore.set(tokenPayload.jti, {
      token,
      payload: tokenPayload,
      createdAt: new Date(),
      expiresAt: new Date(now * 1000 + expirySeconds * 1000)
    });

    return token;
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token to verify
   * @returns {Object} Token payload if valid
   * @throws {Error} If token is invalid or expired
   */
  verifyToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const [header, body, signature] = parts;

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', this.secret)
        .update(`${header}.${body}`)
        .digest('base64');

      if (signature !== expectedSignature) {
        throw new Error('Invalid token signature');
      }

      // Decode payload
      const payload = JSON.parse(Buffer.from(body, 'base64').toString());

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        throw new Error('Token expired');
      }

      // Verify token is in store (not revoked)
      if (!this.tokenStore.has(payload.jti)) {
        throw new Error('Token not found in store');
      }

      return payload;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Create refresh token
   * @param {Object} payload - Original token payload
   * @returns {Object} { accessToken, refreshToken }
   */
  createRefreshToken(payload) {
    const refreshToken = this.generateToken(
      { ...payload, type: 'refresh' },
      this.refreshTokenExpiry
    );

    return {
      accessToken: this.generateToken(
        { ...payload, type: 'access' },
        this.accessTokenExpiry
      ),
      refreshToken,
      expiresIn: this.accessTokenExpiry
    };
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Object} New token pair
   * @throws {Error} If refresh token is invalid
   */
  refreshAccessToken(refreshToken) {
    try {
      const payload = this.verifyToken(refreshToken);

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Revoke old refresh token
      this.revokeToken(refreshToken);

      // Generate new token pair
      return this.createRefreshToken({
        userId: payload.userId,
        username: payload.username,
        roles: payload.roles
      });
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Revoke token
   * @param {string} token - Token to revoke
   */
  revokeToken(token) {
    try {
      const payload = this.verifyToken(token);
      this.tokenStore.delete(payload.jti);
    } catch (error) {
      // Silently fail if token is already invalid
    }
  }

  /**
   * Create session
   * @param {string} userId - User ID
   * @param {Object} metadata - Session metadata
   * @returns {string} Session ID
   */
  createSession(userId, metadata = {}) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    this.sessionStore.set(sessionId, {
      userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.accessTokenExpiry * 1000),
      metadata,
      lastActivity: new Date()
    });
    return sessionId;
  }

  /**
   * Verify session
   * @param {string} sessionId - Session ID
   * @returns {boolean} True if session is valid
   */
  verifySession(sessionId) {
    const session = this.sessionStore.get(sessionId);
    if (!session) return false;

    if (session.expiresAt < new Date()) {
      this.sessionStore.delete(sessionId);
      return false;
    }

    // Update last activity
    session.lastActivity = new Date();
    return true;
  }

  /**
   * Get session
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session object or null
   */
  getSession(sessionId) {
    const session = this.sessionStore.get(sessionId);
    if (!session || session.expiresAt < new Date()) {
      if (session) {
        this.sessionStore.delete(sessionId);
      }
      return null;
    }
    return session;
  }

  /**
   * Revoke session
   * @param {string} sessionId - Session ID
   */
  revokeSession(sessionId) {
    this.sessionStore.delete(sessionId);
  }

  /**
   * Clean up expired tokens and sessions
   */
  cleanup() {
    const now = Date.now();

    // Clean expired tokens
    for (const [jti, tokenData] of this.tokenStore.entries()) {
      if (tokenData.expiresAt < now) {
        this.tokenStore.delete(jti);
      }
    }

    // Clean expired sessions
    for (const [sessionId, sessionData] of this.sessionStore.entries()) {
      if (sessionData.expiresAt < now) {
        this.sessionStore.delete(sessionId);
      }
    }
  }

  /**
   * Get token stats
   * @returns {Object} Token statistics
   */
  getStats() {
    return {
      activeTokens: this.tokenStore.size,
      activeSessions: this.sessionStore.size,
      config: {
        accessTokenExpiry: this.accessTokenExpiry,
        refreshTokenExpiry: this.refreshTokenExpiry
      }
    };
  }
}

module.exports = JWTAuth;
