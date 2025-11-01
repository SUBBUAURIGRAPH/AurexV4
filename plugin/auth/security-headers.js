/**
 * Security Headers Middleware
 * Adds security headers to all HTTP responses
 * @version 1.0.0
 */

/**
 * Security Headers Manager
 * @class SecurityHeaders
 * @description Manages and enforces security headers
 */
class SecurityHeaders {
  /**
   * Initialize Security Headers
   * @param {Object} config - Configuration object
   */
  constructor(config = {}) {
    this.config = {
      // Clickjacking protection
      frameOptions: config.frameOptions || 'DENY',

      // MIME type sniffing protection
      contentTypeOptions: config.contentTypeOptions || 'nosniff',

      // XSS protection
      xssProtection: config.xssProtection || '1; mode=block',

      // HSTS (HTTP Strict Transport Security)
      strictTransportSecurity: config.strictTransportSecurity ||
        'max-age=31536000; includeSubDomains; preload',

      // Content Security Policy
      contentSecurityPolicy: config.contentSecurityPolicy || this.getDefaultCSP(),

      // Referrer Policy
      referrerPolicy: config.referrerPolicy || 'strict-origin-when-cross-origin',

      // Permissions Policy (formerly Feature Policy)
      permissionsPolicy: config.permissionsPolicy || this.getDefaultPermissionsPolicy(),

      // Cross-Origin policies
      crossOriginEmbedderPolicy: config.crossOriginEmbedderPolicy !== false,
      crossOriginOpenerPolicy: config.crossOriginOpenerPolicy !== false,
      crossOriginResourcePolicy: config.crossOriginResourcePolicy || 'cross-origin',

      // Additional headers
      enableCORS: config.enableCORS !== false,
      enableDNSPrefetch: config.enableDNSPrefetch !== false
    };
  }

  /**
   * Get default Content Security Policy
   * @returns {string} CSP header value
   * @private
   */
  getDefaultCSP() {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' cdn.jsdelivr.net fonts.googleapis.com",
      "img-src 'self' data: https:",
      "font-src 'self' data: fonts.gstatic.com",
      "connect-src 'self' ws: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests"
    ].join('; ');
  }

  /**
   * Get default Permissions Policy
   * @returns {string} Permissions Policy header value
   * @private
   */
  getDefaultPermissionsPolicy() {
    return [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
      'payment=()',
      'usb=()',
      'xr-spatial-tracking=()',
      'clipboard-read=()',
      'clipboard-write=()'
    ].join(', ');
  }

  /**
   * Get security headers object
   * @returns {Object} Headers to set
   */
  getHeaders() {
    const headers = {};

    // Clickjacking protection
    headers['X-Frame-Options'] = this.config.frameOptions;

    // MIME type sniffing protection
    headers['X-Content-Type-Options'] = this.config.contentTypeOptions;

    // XSS protection
    headers['X-XSS-Protection'] = this.config.xssProtection;

    // HSTS
    headers['Strict-Transport-Security'] = this.config.strictTransportSecurity;

    // CSP
    headers['Content-Security-Policy'] = this.config.contentSecurityPolicy;

    // Referrer Policy
    headers['Referrer-Policy'] = this.config.referrerPolicy;

    // Permissions Policy
    headers['Permissions-Policy'] = this.config.permissionsPolicy;

    // Cross-Origin Embedder Policy
    if (this.config.crossOriginEmbedderPolicy) {
      headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
    }

    // Cross-Origin Opener Policy
    if (this.config.crossOriginOpenerPolicy) {
      headers['Cross-Origin-Opener-Policy'] = 'same-origin';
    }

    // Cross-Origin Resource Policy
    headers['Cross-Origin-Resource-Policy'] = this.config.crossOriginResourcePolicy;

    // Additional headers
    if (!this.config.enableDNSPrefetch) {
      headers['X-DNS-Prefetch-Control'] = 'off';
    }

    return headers;
  }

  /**
   * Create Express middleware
   * @returns {Function} Express middleware
   */
  middleware() {
    const headers = this.getHeaders();

    return (req, res, next) => {
      // Add security headers
      for (const [key, value] of Object.entries(headers)) {
        res.setHeader(key, value);
      }

      // Add CORS headers if enabled
      if (this.config.enableCORS) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers',
          'Content-Type, Authorization, X-API-Key, X-Requested-With');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
      }

      // Add custom headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');

      next();
    };
  }

  /**
   * Validate CSP compliance
   * @param {string} csp - CSP header value to validate
   * @returns {Object} Validation result
   */
  validateCSP(csp) {
    const directives = csp.split(';').map(d => d.trim());
    const result = {
      valid: true,
      warnings: [],
      errors: []
    };

    // Check for dangerous directives
    if (csp.includes('unsafe-inline') && !csp.includes('script-src')) {
      result.warnings.push('unsafe-inline in style-src should be avoided');
    }

    if (csp.includes("script-src 'unsafe-eval'")) {
      result.errors.push("'unsafe-eval' in script-src is dangerous");
      result.valid = false;
    }

    if (!csp.includes('default-src')) {
      result.warnings.push("Missing default-src directive");
    }

    return result;
  }

  /**
   * Check headers are set in response
   * @param {Object} res - HTTP response object
   * @returns {Object} Security header check results
   */
  checkHeaders(res) {
    const required = [
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Strict-Transport-Security',
      'Content-Security-Policy'
    ];

    const result = {
      allPresent: true,
      missing: [],
      present: []
    };

    for (const header of required) {
      if (res.getHeader(header)) {
        result.present.push(header);
      } else {
        result.missing.push(header);
        result.allPresent = false;
      }
    }

    return result;
  }
}

/**
 * Create security headers middleware
 * @param {Object} config - Configuration
 * @returns {Function} Express middleware
 */
function createSecurityHeadersMiddleware(config = {}) {
  const securityHeaders = new SecurityHeaders(config);
  return securityHeaders.middleware();
}

module.exports = {
  SecurityHeaders,
  createSecurityHeadersMiddleware
};
