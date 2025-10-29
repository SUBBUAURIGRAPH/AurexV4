/**
 * Authentication Endpoints Module
 * Handles authentication API endpoints
 * @version 1.0.0
 */

/**
 * Authentication Endpoints Handler
 * @class AuthEndpoints
 * @description Provides authentication endpoints for login, register, token refresh
 */
class AuthEndpoints {
  /**
   * Initialize Auth Endpoints
   * @param {Object} userManager - UserManager instance
   * @param {Object} jwtAuth - JWTAuth instance
   */
  constructor(userManager, jwtAuth) {
    this.userManager = userManager;
    this.jwtAuth = jwtAuth;
    this.auditLog = [];
  }

  /**
   * Parse JSON body from request
   * @param {Object} req - HTTP request object
   * @returns {Promise<Object>} Parsed JSON body
   * @private
   */
  async parseRequestBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (error) {
          reject(new Error('Invalid JSON body'));
        }
      });
    });
  }

  /**
   * Handle login endpoint
   * POST /auth/login
   * @param {Object} req - HTTP request object
   * @param {Object} res - HTTP response object
   */
  async handleLogin(req, res) {
    try {
      const { username, password } = await this.parseRequestBody(req);

      if (!username || !password) {
        res.writeHead(400);
        res.end(JSON.stringify({
          error: 'Missing username or password'
        }));
        return;
      }

      // Authenticate user
      const user = this.userManager.authenticateUser(username, password);

      // Generate tokens
      const { accessToken, refreshToken, expiresIn } = this.jwtAuth.createRefreshToken({
        userId: user.id,
        username: user.username,
        roles: user.roles,
        type: 'access'
      });

      // Create session
      const sessionId = this.jwtAuth.createSession(user.id, {
        loginTime: new Date(),
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
      });

      this.logAudit('LOGIN', user.id, `User ${username} logged in successfully`);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          roles: user.roles
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn,
          type: 'Bearer'
        },
        sessionId
      }));
    } catch (error) {
      this.logAudit('LOGIN_FAILED', 'unknown', `Login failed: ${error.message}`);
      res.writeHead(401);
      res.end(JSON.stringify({
        error: error.message
      }));
    }
  }

  /**
   * Handle register endpoint
   * POST /auth/register
   * @param {Object} req - HTTP request object
   * @param {Object} res - HTTP response object
   */
  async handleRegister(req, res) {
    try {
      const { username, email, password, roles } = await this.parseRequestBody(req);

      if (!username || !email || !password) {
        res.writeHead(400);
        res.end(JSON.stringify({
          error: 'Missing required fields: username, email, password'
        }));
        return;
      }

      // Create user with default 'user' role
      const user = this.userManager.createUser(
        username,
        email,
        password,
        roles || ['user']
      );

      this.logAudit('REGISTER', user.id, `New user ${username} registered`);

      res.writeHead(201);
      res.end(JSON.stringify({
        success: true,
        message: 'User registered successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          roles: user.roles
        }
      }));
    } catch (error) {
      this.logAudit('REGISTER_FAILED', 'unknown', `Registration failed: ${error.message}`);
      res.writeHead(400);
      res.end(JSON.stringify({
        error: error.message
      }));
    }
  }

  /**
   * Handle token refresh endpoint
   * POST /auth/refresh
   * @param {Object} req - HTTP request object
   * @param {Object} res - HTTP response object
   * @param {Object} user - Authenticated user object
   */
  async handleRefresh(req, res, user) {
    try {
      const { refreshToken } = await this.parseRequestBody(req);

      if (!refreshToken) {
        res.writeHead(400);
        res.end(JSON.stringify({
          error: 'Missing refreshToken'
        }));
        return;
      }

      // Verify and refresh token
      const tokens = this.jwtAuth.refreshAccessToken(refreshToken);

      this.logAudit('TOKEN_REFRESH', user.id, `Token refreshed for user ${user.username}`);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          type: 'Bearer'
        }
      }));
    } catch (error) {
      this.logAudit('TOKEN_REFRESH_FAILED', user?.id || 'unknown', `Token refresh failed: ${error.message}`);
      res.writeHead(401);
      res.end(JSON.stringify({
        error: error.message
      }));
    }
  }

  /**
   * Handle logout endpoint
   * POST /auth/logout
   * @param {Object} req - HTTP request object
   * @param {Object} res - HTTP response object
   * @param {Object} user - Authenticated user object
   */
  async handleLogout(req, res, user) {
    try {
      const { refreshToken } = await this.parseRequestBody(req);

      if (refreshToken) {
        this.jwtAuth.revokeToken(refreshToken);
      }

      this.logAudit('LOGOUT', user.id, `User ${user.username} logged out`);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        message: 'Logged out successfully'
      }));
    } catch (error) {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        message: 'Logged out'
      }));
    }
  }

  /**
   * Handle user profile endpoint
   * GET /api/user/profile
   * @param {Object} req - HTTP request object
   * @param {Object} res - HTTP response object
   * @param {Object} user - Authenticated user object
   */
  async handleGetProfile(req, res, user) {
    try {
      const userDetails = this.userManager.getUser(user.id);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        user: userDetails
      }));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({
        error: error.message
      }));
    }
  }

  /**
   * Handle update profile endpoint
   * PUT /api/user/profile
   * @param {Object} req - HTTP request object
   * @param {Object} res - HTTP response object
   * @param {Object} user - Authenticated user object
   */
  async handleUpdateProfile(req, res, user) {
    try {
      const updates = await this.parseRequestBody(req);

      // Don't allow changing roles via profile update
      delete updates.roles;
      delete updates.id;

      const updatedUser = this.userManager.updateUser(user.id, updates);

      this.logAudit('PROFILE_UPDATE', user.id, `User ${user.username} updated profile`);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        user: updatedUser
      }));
    } catch (error) {
      res.writeHead(400);
      res.end(JSON.stringify({
        error: error.message
      }));
    }
  }

  /**
   * Handle change password endpoint
   * PUT /api/user/password
   * @param {Object} req - HTTP request object
   * @param {Object} res - HTTP response object
   * @param {Object} user - Authenticated user object
   */
  async handleChangePassword(req, res, user) {
    try {
      const { currentPassword, newPassword } = await this.parseRequestBody(req);

      if (!currentPassword || !newPassword) {
        res.writeHead(400);
        res.end(JSON.stringify({
          error: 'Missing currentPassword or newPassword'
        }));
        return;
      }

      // Verify current password
      try {
        this.userManager.authenticateUser(user.username, currentPassword);
      } catch (error) {
        res.writeHead(401);
        res.end(JSON.stringify({
          error: 'Current password is incorrect'
        }));
        return;
      }

      // Update password
      this.userManager.updateUser(user.id, { password: newPassword });

      this.logAudit('PASSWORD_CHANGE', user.id, `User ${user.username} changed password`);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        message: 'Password changed successfully'
      }));
    } catch (error) {
      res.writeHead(400);
      res.end(JSON.stringify({
        error: error.message
      }));
    }
  }

  /**
   * Handle list API keys endpoint
   * GET /api/user/api-keys
   * @param {Object} req - HTTP request object
   * @param {Object} res - HTTP response object
   * @param {Object} user - Authenticated user object
   */
  async handleListAPIKeys(req, res, user) {
    try {
      const apiKeys = this.userManager.listAPIKeys(user.id);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        apiKeys
      }));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({
        error: error.message
      }));
    }
  }

  /**
   * Handle create API key endpoint
   * POST /api/user/api-keys
   * @param {Object} req - HTTP request object
   * @param {Object} res - HTTP response object
   * @param {Object} user - Authenticated user object
   */
  async handleCreateAPIKey(req, res, user) {
    try {
      const { name, permissions } = await this.parseRequestBody(req);

      if (!name) {
        res.writeHead(400);
        res.end(JSON.stringify({
          error: 'Missing API key name'
        }));
        return;
      }

      const apiKey = this.userManager.createAPIKey(user.id, name, permissions || []);

      this.logAudit('API_KEY_CREATED', user.id, `New API key created: ${name}`);

      res.writeHead(201);
      res.end(JSON.stringify({
        success: true,
        apiKey
      }));
    } catch (error) {
      res.writeHead(400);
      res.end(JSON.stringify({
        error: error.message
      }));
    }
  }

  /**
   * Handle revoke API key endpoint
   * DELETE /api/user/api-keys/:id
   * @param {Object} req - HTTP request object
   * @param {Object} res - HTTP response object
   * @param {Object} user - Authenticated user object
   * @param {string} keyId - API key ID to revoke
   */
  async handleRevokeAPIKey(req, res, user, keyId) {
    try {
      this.userManager.revokeAPIKey(keyId);

      this.logAudit('API_KEY_REVOKED', user.id, `API key revoked: ${keyId}`);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        message: 'API key revoked'
      }));
    } catch (error) {
      res.writeHead(400);
      res.end(JSON.stringify({
        error: error.message
      }));
    }
  }

  /**
   * Log audit event
   * @param {string} action - Action performed
   * @param {string} userId - User ID
   * @param {string} details - Action details
   * @private
   */
  logAudit(action, userId, details) {
    this.auditLog.push({
      timestamp: new Date(),
      action,
      userId,
      details
    });

    // Keep only last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog.shift();
    }
  }

  /**
   * Get audit log
   * @returns {Array} Audit log entries
   */
  getAuditLog() {
    return this.auditLog;
  }
}

module.exports = AuthEndpoints;
