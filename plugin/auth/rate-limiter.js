/**
 * Rate Limiting Middleware
 * Implements request throttling and brute force protection
 * @version 1.0.0
 */

/**
 * Rate Limiter
 * @class RateLimiter
 * @description Provides rate limiting and brute force protection
 */
class RateLimiter {
  /**
   * Initialize Rate Limiter
   * @param {Object} config - Configuration object
   * @param {number} config.windowMs - Time window in milliseconds
   * @param {number} config.maxRequests - Max requests per window
   * @param {number} config.loginWindowMs - Login-specific window (optional)
   * @param {number} config.maxLoginAttempts - Max login attempts (optional)
   * @param {number} config.lockoutDurationMs - Lockout duration in ms (optional)
   */
  constructor(config = {}) {
    this.windowMs = config.windowMs || 15 * 60 * 1000; // 15 minutes
    this.maxRequests = config.maxRequests || 100;
    this.loginWindowMs = config.loginWindowMs || 15 * 60 * 1000; // 15 minutes
    this.maxLoginAttempts = config.maxLoginAttempts || 5;
    this.lockoutDurationMs = config.lockoutDurationMs || 30 * 60 * 1000; // 30 minutes

    // In-memory stores for request tracking
    this.requestCounts = new Map(); // { ip: { count, resetTime } }
    this.loginAttempts = new Map(); // { identifier: { count, resetTime, lockedUntil } }
    this.blockedIPs = new Set(); // IPs currently blocked

    // Cleanup old entries periodically
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every minute
  }

  /**
   * Get client IP address from request
   * @param {Object} req - HTTP request object
   * @returns {string} Client IP address
   * @private
   */
  getClientIP(req) {
    // Try X-Forwarded-For first (for proxied requests)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    // Fallback to socket address
    return req.socket.remoteAddress || 'unknown';
  }

  /**
   * Check if IP is blocked
   * @param {string} ip - Client IP address
   * @returns {boolean} True if IP is blocked
   * @private
   */
  isIPBlocked(ip) {
    return this.blockedIPs.has(ip);
  }

  /**
   * Block IP temporarily
   * @param {string} ip - IP to block
   * @param {number} durationMs - Duration of block
   * @private
   */
  blockIP(ip, durationMs = this.lockoutDurationMs) {
    this.blockedIPs.add(ip);
    setTimeout(() => {
      this.blockedIPs.delete(ip);
    }, durationMs);
  }

  /**
   * Check general request rate limit
   * @param {Object} req - HTTP request object
   * @returns {Object} { allowed: boolean, remaining: number, resetTime: Date }
   */
  checkRateLimit(req) {
    const ip = this.getClientIP(req);

    // Check if IP is blocked
    if (this.isIPBlocked(ip)) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(),
        reason: 'IP blocked due to excessive requests'
      };
    }

    const now = Date.now();
    let record = this.requestCounts.get(ip);

    // Initialize or reset if window expired
    if (!record || record.resetTime < now) {
      record = {
        count: 0,
        resetTime: now + this.windowMs
      };
      this.requestCounts.set(ip, record);
    }

    // Increment counter
    record.count++;

    // Check if limit exceeded
    if (record.count > this.maxRequests) {
      // Block IP after threshold
      if (record.count > this.maxRequests + 10) {
        this.blockIP(ip);
      }

      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(record.resetTime),
        reason: 'Rate limit exceeded'
      };
    }

    return {
      allowed: true,
      remaining: this.maxRequests - record.count,
      resetTime: new Date(record.resetTime)
    };
  }

  /**
   * Check login rate limit and brute force protection
   * @param {string} identifier - Username or email (login identifier)
   * @param {string} ip - Client IP address
   * @returns {Object} { allowed: boolean, remaining: number, lockedUntil: Date|null }
   */
  checkLoginLimit(identifier, ip) {
    const now = Date.now();

    // Create composite key: username + IP
    const key = `${identifier}:${ip}`;
    let record = this.loginAttempts.get(key);

    // Initialize or reset if window expired
    if (!record || record.resetTime < now) {
      record = {
        count: 0,
        resetTime: now + this.loginWindowMs,
        lockedUntil: null
      };
      this.loginAttempts.set(key, record);
    }

    // Check if account is locked
    if (record.lockedUntil && record.lockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        lockedUntil: new Date(record.lockedUntil),
        reason: 'Account temporarily locked due to too many failed attempts'
      };
    }

    // Clear lock if duration has passed
    if (record.lockedUntil && record.lockedUntil < now) {
      record.count = 0;
      record.lockedUntil = null;
    }

    // Increment counter
    record.count++;

    // Check if limit exceeded
    if (record.count > this.maxLoginAttempts) {
      // Lock account
      record.lockedUntil = now + this.lockoutDurationMs;

      return {
        allowed: false,
        remaining: 0,
        lockedUntil: new Date(record.lockedUntil),
        reason: 'Too many failed login attempts'
      };
    }

    return {
      allowed: true,
      remaining: this.maxLoginAttempts - record.count,
      lockedUntil: null
    };
  }

  /**
   * Reset login attempts for successful login
   * @param {string} identifier - Username or email
   * @param {string} ip - Client IP address
   */
  resetLoginAttempts(identifier, ip) {
    const key = `${identifier}:${ip}`;
    this.loginAttempts.delete(key);
  }

  /**
   * Record failed login attempt
   * @param {string} identifier - Username or email
   * @param {string} ip - Client IP address
   */
  recordFailedLogin(identifier, ip) {
    // Already tracked by checkLoginLimit
    // This method exists for explicit tracking if needed
  }

  /**
   * Get rate limit status for IP
   * @param {string} ip - Client IP address
   * @returns {Object} Rate limit status
   */
  getStatus(ip) {
    const record = this.requestCounts.get(ip);
    return {
      ip,
      isBlocked: this.isIPBlocked(ip),
      requests: record ? record.count : 0,
      resetTime: record ? new Date(record.resetTime) : null
    };
  }

  /**
   * Cleanup expired records
   * @private
   */
  cleanup() {
    const now = Date.now();

    // Cleanup request counts
    for (const [ip, record] of this.requestCounts.entries()) {
      if (record.resetTime < now) {
        this.requestCounts.delete(ip);
      }
    }

    // Cleanup login attempts
    for (const [key, record] of this.loginAttempts.entries()) {
      // Only delete if reset time has passed AND lock is expired
      if (record.resetTime < now && (!record.lockedUntil || record.lockedUntil < now)) {
        this.loginAttempts.delete(key);
      }
    }
  }

  /**
   * Reset all limits (for testing)
   */
  reset() {
    this.requestCounts.clear();
    this.loginAttempts.clear();
    this.blockedIPs.clear();
  }

  /**
   * Stop cleanup interval
   */
  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

/**
 * Express middleware for rate limiting
 * @param {RateLimiter} limiter - RateLimiter instance
 * @returns {Function} Express middleware
 */
function createRateLimitMiddleware(limiter) {
  return (req, res, next) => {
    const limit = limiter.checkRateLimit(req);

    // Add headers
    res.setHeader('X-RateLimit-Limit', limiter.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit.remaining));
    res.setHeader('X-RateLimit-Reset', limit.resetTime.toISOString());

    if (!limit.allowed) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Too Many Requests',
        message: limit.reason,
        retryAfter: Math.ceil((limit.resetTime - new Date()) / 1000)
      }));
      return;
    }

    next();
  };
}

/**
 * Express middleware for login rate limiting
 * @param {RateLimiter} limiter - RateLimiter instance
 * @returns {Function} Express middleware
 */
function createLoginRateLimitMiddleware(limiter) {
  return (req, res, next) => {
    // Extract identifier from request body (must be parsed first)
    let identifier = null;

    if (req.body && req.body.username) {
      identifier = req.body.username;
    } else if (req.body && req.body.email) {
      identifier = req.body.email;
    } else {
      // If no identifier found, proceed but log warning
      console.warn('No identifier found in login request');
      next();
      return;
    }

    const ip = limiter.getClientIP(req);
    const limit = limiter.checkLoginLimit(identifier, ip);

    // Add headers
    res.setHeader('X-RateLimit-Limit', limiter.maxLoginAttempts);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit.remaining));

    if (limit.lockedUntil) {
      res.setHeader('X-RateLimit-Reset', limit.lockedUntil.toISOString());
      res.setHeader('Retry-After', Math.ceil((limit.lockedUntil - new Date()) / 1000));
    }

    if (!limit.allowed) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Too Many Login Attempts',
        message: limit.reason,
        lockedUntil: limit.lockedUntil ? limit.lockedUntil.toISOString() : null,
        retryAfter: limit.lockedUntil ?
          Math.ceil((limit.lockedUntil - new Date()) / 1000) : 60
      }));
      return;
    }

    // Store limiter and identifier for later use
    req.rateLimiter = limiter;
    req.loginIdentifier = identifier;
    req.loginIP = ip;

    next();
  };
}

module.exports = {
  RateLimiter,
  createRateLimitMiddleware,
  createLoginRateLimitMiddleware
};
