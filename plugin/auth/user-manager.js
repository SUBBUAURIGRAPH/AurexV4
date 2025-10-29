/**
 * User Management Module
 * Handles user creation, validation, and role management
 * @version 1.0.0
 */

const crypto = require('crypto');

/**
 * User Manager
 * @class UserManager
 * @description Manages user lifecycle, credentials, and roles
 */
class UserManager {
  /**
   * Initialize User Manager
   * @param {Object} config - Configuration object
   */
  constructor(config = {}) {
    // In-memory user store (for development)
    // In production, use a database
    this.users = new Map();
    this.apiKeys = new Map();
    this.userIdCounter = 1;

    // Create default admin user
    this.createUser('admin', 'admin@hms.local', 'admin123', ['admin', 'user']);
  }

  /**
   * Hash password using PBKDF2
   * @param {string} password - Plain text password
   * @param {string} salt - Salt (generated if not provided)
   * @returns {Object} { hash, salt }
   * @private
   */
  hashPassword(password, salt = null) {
    const useSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto
      .pbkdf2Sync(password, useSalt, 100000, 64, 'sha256')
      .toString('hex');
    return { hash, salt: useSalt };
  }

  /**
   * Verify password
   * @param {string} password - Plain text password to verify
   * @param {string} hash - Stored password hash
   * @param {string} salt - Stored password salt
   * @returns {boolean} True if password matches
   * @private
   */
  verifyPassword(password, hash, salt) {
    const { hash: newHash } = this.hashPassword(password, salt);
    return newHash === hash;
  }

  /**
   * Create new user
   * @param {string} username - Username
   * @param {string} email - Email address
   * @param {string} password - Password
   * @param {Array} roles - User roles (default: ['user'])
   * @returns {Object} User object
   * @throws {Error} If username already exists
   */
  createUser(username, email, password, roles = ['user']) {
    // Validate input
    if (!username || username.length < 3) {
      throw new Error('Username must be at least 3 characters');
    }
    if (!email || !this.isValidEmail(email)) {
      throw new Error('Invalid email address');
    }
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    if (!Array.isArray(roles) || roles.length === 0) {
      throw new Error('User must have at least one role');
    }

    // Check if username exists
    for (const user of this.users.values()) {
      if (user.username === username) {
        throw new Error('Username already exists');
      }
      if (user.email === email) {
        throw new Error('Email already registered');
      }
    }

    const userId = `user_${this.userIdCounter++}`;
    const { hash, salt } = this.hashPassword(password);

    const user = {
      id: userId,
      username,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      roles: roles.filter(r => this.isValidRole(r)),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null,
      isActive: true,
      metadata: {}
    };

    this.users.set(userId, user);
    return this.formatUserResponse(user);
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {Object|null} User object or null
   */
  getUser(userId) {
    const user = this.users.get(userId);
    return user ? this.formatUserResponse(user) : null;
  }

  /**
   * Get user by username
   * @param {string} username - Username
   * @returns {Object|null} User object or null
   */
  getUserByUsername(username) {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return this.formatUserResponse(user);
      }
    }
    return null;
  }

  /**
   * Authenticate user
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Object} Authenticated user object
   * @throws {Error} If authentication fails
   */
  authenticateUser(username, password) {
    const user = this.getUserByUsername(username);
    if (!user) {
      throw new Error('Invalid username or password');
    }

    const storedUser = this.users.get(user.id);
    if (!this.verifyPassword(password, storedUser.passwordHash, storedUser.passwordSalt)) {
      throw new Error('Invalid username or password');
    }

    if (!storedUser.isActive) {
      throw new Error('User account is inactive');
    }

    // Update last login
    storedUser.lastLogin = new Date();

    return this.formatUserResponse(storedUser);
  }

  /**
   * Update user
   * @param {string} userId - User ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated user object
   * @throws {Error} If user not found
   */
  updateUser(userId, updates) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Prevent direct password update via this method
    if (updates.password) {
      const { hash, salt } = this.hashPassword(updates.password);
      user.passwordHash = hash;
      user.passwordSalt = salt;
      delete updates.password;
    }

    // Update allowed fields
    if (updates.email) {
      // Check email uniqueness
      for (const [id, u] of this.users.entries()) {
        if (id !== userId && u.email === updates.email) {
          throw new Error('Email already in use');
        }
      }
      user.email = updates.email;
    }

    if (updates.roles && Array.isArray(updates.roles)) {
      user.roles = updates.roles.filter(r => this.isValidRole(r));
    }

    if (updates.metadata) {
      user.metadata = { ...user.metadata, ...updates.metadata };
    }

    user.updatedAt = new Date();
    return this.formatUserResponse(user);
  }

  /**
   * Delete user
   * @param {string} userId - User ID
   * @throws {Error} If user not found
   */
  deleteUser(userId) {
    if (!this.users.has(userId)) {
      throw new Error('User not found');
    }

    // Revoke all API keys for this user
    for (const [key, apiKey] of this.apiKeys.entries()) {
      if (apiKey.userId === userId) {
        this.apiKeys.delete(key);
      }
    }

    this.users.delete(userId);
  }

  /**
   * List all users
   * @param {Object} options - Query options
   * @returns {Array} Array of user objects
   */
  listUsers(options = {}) {
    const users = Array.from(this.users.values());
    return users
      .filter(u => !options.roleFilter || options.roleFilter.some(r => u.roles.includes(r)))
      .filter(u => options.activeOnly === undefined || u.isActive === options.activeOnly)
      .map(u => this.formatUserResponse(u));
  }

  /**
   * Create API key for user
   * @param {string} userId - User ID
   * @param {string} name - API key name
   * @param {Array} permissions - API key permissions
   * @returns {Object} API key details
   * @throws {Error} If user not found
   */
  createAPIKey(userId, name, permissions = []) {
    if (!this.users.has(userId)) {
      throw new Error('User not found');
    }

    const apiKey = crypto.randomBytes(32).toString('hex');
    const hashedKey = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');

    const keyData = {
      id: `key_${crypto.randomBytes(8).toString('hex')}`,
      userId,
      name,
      hashedKey,
      permissions,
      createdAt: new Date(),
      expiresAt: options?.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      isActive: true,
      lastUsed: null
    };

    this.apiKeys.set(keyData.id, keyData);

    return {
      id: keyData.id,
      apiKey, // Only shown once during creation
      name: keyData.name,
      permissions: keyData.permissions,
      expiresAt: keyData.expiresAt,
      createdAt: keyData.createdAt
    };
  }

  /**
   * Verify API key
   * @param {string} apiKey - API key to verify
   * @returns {Object|null} API key data if valid
   */
  verifyAPIKey(apiKey) {
    const hashedKey = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');

    for (const keyData of this.apiKeys.values()) {
      if (keyData.hashedKey === hashedKey && keyData.isActive) {
        if (keyData.expiresAt && keyData.expiresAt < new Date()) {
          keyData.isActive = false;
          return null;
        }
        keyData.lastUsed = new Date();
        return keyData;
      }
    }
    return null;
  }

  /**
   * Revoke API key
   * @param {string} keyId - API key ID
   * @throws {Error} If key not found
   */
  revokeAPIKey(keyId) {
    const keyData = this.apiKeys.get(keyId);
    if (!keyData) {
      throw new Error('API key not found');
    }
    keyData.isActive = false;
  }

  /**
   * List API keys for user
   * @param {string} userId - User ID
   * @returns {Array} Array of API key objects
   */
  listAPIKeys(userId) {
    const keys = [];
    for (const keyData of this.apiKeys.values()) {
      if (keyData.userId === userId) {
        keys.push({
          id: keyData.id,
          name: keyData.name,
          permissions: keyData.permissions,
          createdAt: keyData.createdAt,
          expiresAt: keyData.expiresAt,
          isActive: keyData.isActive,
          lastUsed: keyData.lastUsed
        });
      }
    }
    return keys;
  }

  /**
   * Check if user has role
   * @param {string} userId - User ID
   * @param {string} role - Role to check
   * @returns {boolean} True if user has role
   */
  hasRole(userId, role) {
    const user = this.users.get(userId);
    return user ? user.roles.includes(role) : false;
  }

  /**
   * Check if user has permission
   * @param {string} userId - User ID
   * @param {string} permission - Permission to check
   * @returns {boolean} True if user has permission
   */
  hasPermission(userId, permission) {
    const user = this.users.get(userId);
    if (!user) return false;

    // Admin has all permissions
    if (user.roles.includes('admin')) return true;

    // Role-based permissions mapping
    const rolePermissions = {
      admin: ['*'],
      user: ['read:agents', 'read:skills', 'execute:skills'],
      guest: ['read:agents']
    };

    for (const role of user.roles) {
      const permissions = rolePermissions[role] || [];
      if (permissions.includes('*') || permissions.includes(permission)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid email
   * @private
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate role
   * @param {string} role - Role to validate
   * @returns {boolean} True if valid role
   * @private
   */
  isValidRole(role) {
    const validRoles = ['admin', 'user', 'guest', 'analyst', 'trader'];
    return validRoles.includes(role);
  }

  /**
   * Format user response (remove sensitive fields)
   * @param {Object} user - User object
   * @returns {Object} Formatted user object
   * @private
   */
  formatUserResponse(user) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLogin: user.lastLogin,
      metadata: user.metadata
    };
  }
}

module.exports = UserManager;
