/**
 * Input Validation Module
 * Validates and sanitizes user input for authentication endpoints
 * @version 1.0.0
 */

/**
 * Input Validator
 * @class InputValidator
 * @description Validates and sanitizes authentication inputs
 */
class InputValidator {
  /**
   * Initialize Input Validator
   * @param {Object} config - Configuration object
   */
  constructor(config = {}) {
    this.config = {
      // Username validation
      usernameMinLength: config.usernameMinLength || 3,
      usernameMaxLength: config.usernameMaxLength || 50,
      usernamePattern: config.usernamePattern || /^[a-zA-Z0-9._-]+$/,

      // Email validation
      emailPattern: config.emailPattern ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

      // Password validation
      passwordMinLength: config.passwordMinLength || 8,
      passwordMaxLength: config.passwordMaxLength || 128,
      passwordRequireUppercase: config.passwordRequireUppercase !== false,
      passwordRequireLowercase: config.passwordRequireLowercase !== false,
      passwordRequireNumbers: config.passwordRequireNumbers !== false,
      passwordRequireSpecialChars: config.passwordRequireSpecialChars !== false,

      // JWT validation
      maxTokenLength: config.maxTokenLength || 4000,

      // API Key validation
      apiKeyMinLength: config.apiKeyMinLength || 32,
      apiKeyMaxLength: config.apiKeyMaxLength || 256
    };
  }

  /**
   * Sanitize string input
   * @param {string} input - Input string
   * @returns {string} Sanitized string
   * @private
   */
  sanitizeString(input) {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .trim()
      .replace(/[<>]/g, '') // Remove angle brackets
      .substring(0, 1000); // Limit length
  }

  /**
   * Validate username
   * @param {string} username - Username to validate
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validateUsername(username) {
    const errors = [];

    if (!username) {
      errors.push('Username is required');
      return { valid: false, errors };
    }

    if (typeof username !== 'string') {
      errors.push('Username must be a string');
      return { valid: false, errors };
    }

    const sanitized = this.sanitizeString(username);

    if (sanitized.length < this.config.usernameMinLength) {
      errors.push(`Username must be at least ${this.config.usernameMinLength} characters`);
    }

    if (sanitized.length > this.config.usernameMaxLength) {
      errors.push(`Username must not exceed ${this.config.usernameMaxLength} characters`);
    }

    if (!this.config.usernamePattern.test(sanitized)) {
      errors.push('Username can only contain letters, numbers, dots, hyphens, and underscores');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized
    };
  }

  /**
   * Validate email
   * @param {string} email - Email to validate
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validateEmail(email) {
    const errors = [];

    if (!email) {
      errors.push('Email is required');
      return { valid: false, errors };
    }

    if (typeof email !== 'string') {
      errors.push('Email must be a string');
      return { valid: false, errors };
    }

    const sanitized = this.sanitizeString(email);

    if (sanitized.length > 254) {
      errors.push('Email is too long');
    }

    if (!this.config.emailPattern.test(sanitized)) {
      errors.push('Invalid email format');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized
    };
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} { valid: boolean, errors: string[], strength: string }
   */
  validatePassword(password) {
    const errors = [];
    let strength = 'weak';

    if (!password) {
      errors.push('Password is required');
      return { valid: false, errors, strength };
    }

    if (typeof password !== 'string') {
      errors.push('Password must be a string');
      return { valid: false, errors, strength };
    }

    if (password.length < this.config.passwordMinLength) {
      errors.push(`Password must be at least ${this.config.passwordMinLength} characters`);
    }

    if (password.length > this.config.passwordMaxLength) {
      errors.push(`Password must not exceed ${this.config.passwordMaxLength} characters`);
    }

    // Check complexity requirements
    let complexityScore = 0;

    if (this.config.passwordRequireUppercase && /[A-Z]/.test(password)) {
      complexityScore++;
    } else if (this.config.passwordRequireUppercase) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.config.passwordRequireLowercase && /[a-z]/.test(password)) {
      complexityScore++;
    } else if (this.config.passwordRequireLowercase) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.config.passwordRequireNumbers && /[0-9]/.test(password)) {
      complexityScore++;
    } else if (this.config.passwordRequireNumbers) {
      errors.push('Password must contain at least one number');
    }

    if (this.config.passwordRequireSpecialChars && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      complexityScore++;
    } else if (this.config.passwordRequireSpecialChars) {
      errors.push('Password must contain at least one special character');
    }

    // Determine strength
    if (complexityScore === 4 && password.length >= 12) {
      strength = 'strong';
    } else if (complexityScore >= 3 && password.length >= 10) {
      strength = 'medium';
    } else {
      strength = 'weak';
    }

    return {
      valid: errors.length === 0,
      errors,
      strength
    };
  }

  /**
   * Validate JWT token format
   * @param {string} token - Token to validate
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validateToken(token) {
    const errors = [];

    if (!token) {
      errors.push('Token is required');
      return { valid: false, errors };
    }

    if (typeof token !== 'string') {
      errors.push('Token must be a string');
      return { valid: false, errors };
    }

    if (token.length > this.config.maxTokenLength) {
      errors.push(`Token exceeds maximum length of ${this.config.maxTokenLength}`);
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      errors.push('Invalid token format (must have 3 parts)');
    }

    // Validate base64 encoding
    for (let i = 0; i < parts.length; i++) {
      try {
        Buffer.from(parts[i], 'base64').toString();
      } catch (error) {
        errors.push(`Invalid base64 encoding in token part ${i + 1}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate API key format
   * @param {string} apiKey - API key to validate
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validateAPIKey(apiKey) {
    const errors = [];

    if (!apiKey) {
      errors.push('API key is required');
      return { valid: false, errors };
    }

    if (typeof apiKey !== 'string') {
      errors.push('API key must be a string');
      return { valid: false, errors };
    }

    if (apiKey.length < this.config.apiKeyMinLength) {
      errors.push(`API key must be at least ${this.config.apiKeyMinLength} characters`);
    }

    if (apiKey.length > this.config.apiKeyMaxLength) {
      errors.push(`API key must not exceed ${this.config.apiKeyMaxLength} characters`);
    }

    // Check for valid characters (alphanumeric + underscore/hyphen)
    if (!/^[a-zA-Z0-9_-]+$/.test(apiKey)) {
      errors.push('API key can only contain alphanumeric characters, hyphens, and underscores');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate login request body
   * @param {Object} body - Request body
   * @returns {Object} Validation result
   */
  validateLoginRequest(body) {
    const errors = {};

    if (!body) {
      return { valid: false, errors: { body: 'Request body is required' } };
    }

    // Validate username
    const usernameValidation = this.validateUsername(body.username);
    if (!usernameValidation.valid) {
      errors.username = usernameValidation.errors;
    }

    // Validate password
    if (!body.password) {
      errors.password = ['Password is required'];
    } else if (typeof body.password !== 'string') {
      errors.password = ['Password must be a string'];
    } else if (body.password.length > this.config.passwordMaxLength) {
      errors.password = ['Password exceeds maximum length'];
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
      sanitized: {
        username: usernameValidation.sanitized
      }
    };
  }

  /**
   * Validate registration request body
   * @param {Object} body - Request body
   * @returns {Object} Validation result
   */
  validateRegistrationRequest(body) {
    const errors = {};
    const sanitized = {};

    if (!body) {
      return { valid: false, errors: { body: 'Request body is required' } };
    }

    // Validate username
    const usernameValidation = this.validateUsername(body.username);
    if (!usernameValidation.valid) {
      errors.username = usernameValidation.errors;
    } else {
      sanitized.username = usernameValidation.sanitized;
    }

    // Validate email
    const emailValidation = this.validateEmail(body.email);
    if (!emailValidation.valid) {
      errors.email = emailValidation.errors;
    } else {
      sanitized.email = emailValidation.sanitized;
    }

    // Validate password
    const passwordValidation = this.validatePassword(body.password);
    if (!passwordValidation.valid) {
      errors.password = passwordValidation.errors;
    } else {
      sanitized.password = body.password; // Don't include password in sanitized
      sanitized.passwordStrength = passwordValidation.strength;
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
      sanitized
    };
  }

  /**
   * Validate all token claims
   * @param {Object} payload - Token payload
   * @returns {Object} Validation result
   */
  validateTokenClaims(payload) {
    const errors = [];

    if (!payload) {
      errors.push('Payload is required');
      return { valid: false, errors };
    }

    // Required claims
    const required = ['userId', 'iat', 'exp'];
    for (const claim of required) {
      if (!payload[claim]) {
        errors.push(`Missing required claim: ${claim}`);
      }
    }

    // Validate standard claims
    if (typeof payload.iat !== 'number') {
      errors.push('Invalid iat claim');
    }

    if (typeof payload.exp !== 'number') {
      errors.push('Invalid exp claim');
    }

    if (payload.exp <= payload.iat) {
      errors.push('Token expiry must be after issuance');
    }

    // Validate userId
    if (typeof payload.userId !== 'string') {
      errors.push('userId must be a string');
    }

    // Validate roles if present
    if (payload.roles && !Array.isArray(payload.roles)) {
      errors.push('roles must be an array');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = {
  InputValidator
};
