/**
 * Role-Based Access Control (RBAC) Middleware
 * Enforces access control based on user roles and permissions
 * @version 1.0.0
 */

/**
 * RBAC Middleware
 * @class RBACMiddleware
 * @description Provides role-based access control for API endpoints
 */
class RBACMiddleware {
  /**
   * Initialize RBAC Middleware
   * @param {Object} userManager - UserManager instance
   * @param {Object} jwtAuth - JWTAuth instance
   */
  constructor(userManager, jwtAuth) {
    this.userManager = userManager;
    this.jwtAuth = jwtAuth;

    // Define endpoint access control
    this.aclRules = new Map([
      // Public endpoints (no auth required)
      { path: '/health', method: 'GET', public: true },
      { path: '/api', method: 'GET', public: true },
      { path: '/auth/login', method: 'POST', public: true },
      { path: '/auth/register', method: 'POST', public: true },

      // Authenticated endpoints (any authenticated user)
      { path: '/api/agents', method: 'GET', minRole: 'guest' },
      { path: '/api/skills', method: 'GET', minRole: 'guest' },
      { path: '/api/agents/:id', method: 'GET', minRole: 'guest' },
      { path: '/api/skills/:id', method: 'GET', minRole: 'guest' },

      // User endpoints
      { path: '/api/user/profile', method: 'GET', minRole: 'user' },
      { path: '/api/user/profile', method: 'PUT', minRole: 'user' },
      { path: '/api/user/password', method: 'PUT', minRole: 'user' },
      { path: '/api/user/api-keys', method: 'GET', minRole: 'user' },
      { path: '/api/user/api-keys', method: 'POST', minRole: 'user' },
      { path: '/api/user/api-keys/:id', method: 'DELETE', minRole: 'user' },

      // Execute endpoints (requires user role)
      { path: '/api/execute', method: 'POST', minRole: 'user' },
      { path: '/api/skills/:id/execute', method: 'POST', minRole: 'user' },

      // Admin endpoints
      { path: '/api/admin/users', method: 'GET', minRole: 'admin' },
      { path: '/api/admin/users', method: 'POST', minRole: 'admin' },
      { path: '/api/admin/users/:id', method: 'GET', minRole: 'admin' },
      { path: '/api/admin/users/:id', method: 'PUT', minRole: 'admin' },
      { path: '/api/admin/users/:id', method: 'DELETE', minRole: 'admin' },
      { path: '/api/admin/stats', method: 'GET', minRole: 'admin' },
      { path: '/api/admin/audit-log', method: 'GET', minRole: 'admin' },

      // Auth endpoints
      { path: '/auth/refresh', method: 'POST', minRole: 'user' },
      { path: '/auth/logout', method: 'POST', minRole: 'user' }
    ]);
  }

  /**
   * Extract token from request
   * @param {Object} req - HTTP request object
   * @returns {string|null} Token or null
   * @private
   */
  extractToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  /**
   * Extract API key from request
   * @param {Object} req - HTTP request object
   * @returns {string|null} API key or null
   * @private
   */
  extractAPIKey(req) {
    return req.headers['x-api-key'] || null;
  }

  /**
   * Check if endpoint is public
   * @param {string} pathname - Request pathname
   * @param {string} method - HTTP method
   * @returns {boolean} True if public
   * @private
   */
  isPublicEndpoint(pathname, method) {
    for (const rule of this.aclRules) {
      if (rule.public && this.pathMatches(pathname, rule.path) && rule.method === method) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if path matches rule pattern
   * @param {string} pathname - Request pathname
   * @param {string} pattern - ACL pattern
   * @returns {boolean} True if matches
   * @private
   */
  pathMatches(pathname, pattern) {
    // Exact match
    if (pathname === pattern) return true;

    // Dynamic parameter match (e.g., /api/users/:id)
    const patternParts = pattern.split('/');
    const pathParts = pathname.split('/');

    if (patternParts.length !== pathParts.length) return false;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        // Dynamic parameter - always matches
        continue;
      }
      if (patternParts[i] !== pathParts[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Authenticate request using JWT or API key
   * @param {Object} req - HTTP request object
   * @returns {Object|null} User object if authenticated
   * @private
   */
  authenticateRequest(req) {
    // Try JWT first
    const token = this.extractToken(req);
    if (token) {
      try {
        const payload = this.jwtAuth.verifyToken(token);
        const user = this.userManager.getUser(payload.userId);
        if (user) {
          user._source = 'jwt';
          user._payload = payload;
          return user;
        }
      } catch (error) {
        // JWT verification failed, try API key
      }
    }

    // Try API key
    const apiKey = this.extractAPIKey(req);
    if (apiKey) {
      const keyData = this.userManager.verifyAPIKey(apiKey);
      if (keyData) {
        const user = this.userManager.getUser(keyData.userId);
        if (user) {
          user._source = 'api-key';
          user._apiKeyId = keyData.id;
          return user;
        }
      }
    }

    return null;
  }

  /**
   * Check if user has permission for endpoint
   * @param {Object} user - User object
   * @param {string} pathname - Request pathname
   * @param {string} method - HTTP method
   * @returns {Object} { allowed: boolean, reason: string }
   * @private
   */
  checkPermission(user, pathname, method) {
    // Find matching ACL rule
    for (const rule of this.aclRules) {
      if (rule.method === method && this.pathMatches(pathname, rule.path)) {
        // Check minimum role requirement
        if (rule.minRole) {
          const roleHierarchy = ['guest', 'user', 'analyst', 'trader', 'admin'];
          const requiredRoleIndex = roleHierarchy.indexOf(rule.minRole);
          const userRoleIndex = Math.max(
            ...user.roles.map(r => roleHierarchy.indexOf(r))
          );

          if (userRoleIndex < requiredRoleIndex) {
            return {
              allowed: false,
              reason: `Insufficient permissions. Required role: ${rule.minRole}`
            };
          }
        }

        return { allowed: true };
      }
    }

    return {
      allowed: false,
      reason: 'Endpoint not found or unauthorized'
    };
  }

  /**
   * Authorize request
   * Middleware function to check authorization
   * @param {Object} req - HTTP request object
   * @returns {Object} { authorized: boolean, user: Object|null, reason: string }
   */
  authorize(req) {
    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
    const method = req.method;

    // Check if endpoint is public
    if (this.isPublicEndpoint(pathname, method)) {
      return { authorized: true, user: null };
    }

    // Authenticate request
    const user = this.authenticateRequest(req);
    if (!user) {
      return {
        authorized: false,
        user: null,
        reason: 'Missing or invalid authentication credentials'
      };
    }

    // Check permissions
    const permissionCheck = this.checkPermission(user, pathname, method);
    if (!permissionCheck.allowed) {
      return {
        authorized: false,
        user,
        reason: permissionCheck.reason
      };
    }

    return { authorized: true, user };
  }

  /**
   * Get ACL for endpoint
   * @param {string} pathname - Request pathname
   * @param {string} method - HTTP method
   * @returns {Object|null} ACL rule or null
   */
  getACL(pathname, method) {
    for (const rule of this.aclRules) {
      if (rule.method === method && this.pathMatches(pathname, rule.path)) {
        return rule;
      }
    }
    return null;
  }

  /**
   * Add custom ACL rule
   * @param {Object} rule - ACL rule object
   */
  addACLRule(rule) {
    this.aclRules.push(rule);
  }

  /**
   * Get all ACL rules
   * @returns {Array} Array of ACL rules
   */
  getACLRules() {
    return Array.from(this.aclRules);
  }
}

module.exports = RBACMiddleware;
