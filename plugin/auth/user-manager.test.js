/**
 * User Manager Tests
 * @version 1.0.0
 */

const UserManager = require('./user-manager');

describe('UserManager', () => {
  let userManager;

  beforeEach(() => {
    userManager = new UserManager();
  });

  describe('User Creation', () => {
    test('should create new user', () => {
      const user = userManager.createUser('testuser', 'test@example.com', 'password123');

      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.roles).toContain('user');
      expect(user.passwordHash).toBeUndefined(); // Should not expose hash
    });

    test('should reject duplicate username', () => {
      userManager.createUser('testuser', 'test1@example.com', 'password123');

      expect(() => {
        userManager.createUser('testuser', 'test2@example.com', 'password456');
      }).toThrow('Username already exists');
    });

    test('should reject duplicate email', () => {
      userManager.createUser('testuser1', 'test@example.com', 'password123');

      expect(() => {
        userManager.createUser('testuser2', 'test@example.com', 'password456');
      }).toThrow('Email already registered');
    });

    test('should validate username length', () => {
      expect(() => {
        userManager.createUser('ab', 'test@example.com', 'password123');
      }).toThrow('Username must be at least 3 characters');
    });

    test('should validate password length', () => {
      expect(() => {
        userManager.createUser('testuser', 'test@example.com', 'short');
      }).toThrow('Password must be at least 8 characters');
    });

    test('should validate email format', () => {
      expect(() => {
        userManager.createUser('testuser', 'invalid-email', 'password123');
      }).toThrow('Invalid email address');
    });

    test('should create user with custom roles', () => {
      const user = userManager.createUser(
        'testuser',
        'test@example.com',
        'password123',
        ['admin', 'trader']
      );

      expect(user.roles).toContain('admin');
      expect(user.roles).toContain('trader');
    });
  });

  describe('User Authentication', () => {
    beforeEach(() => {
      userManager.createUser('testuser', 'test@example.com', 'password123');
    });

    test('should authenticate user with correct password', () => {
      const user = userManager.authenticateUser('testuser', 'password123');

      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');
    });

    test('should reject incorrect password', () => {
      expect(() => {
        userManager.authenticateUser('testuser', 'wrongpassword');
      }).toThrow('Invalid username or password');
    });

    test('should reject non-existent user', () => {
      expect(() => {
        userManager.authenticateUser('nonexistent', 'password123');
      }).toThrow('Invalid username or password');
    });

    test('should reject inactive user', () => {
      const users = Array.from(userManager.users.values());
      const testUser = users.find(u => u.username === 'testuser');
      testUser.isActive = false;

      expect(() => {
        userManager.authenticateUser('testuser', 'password123');
      }).toThrow('User account is inactive');
    });

    test('should update lastLogin on authentication', () => {
      const beforeTime = new Date();
      const user = userManager.authenticateUser('testuser', 'password123');
      const afterTime = new Date();

      const storedUser = Array.from(userManager.users.values())
        .find(u => u.username === 'testuser');

      expect(storedUser.lastLogin).toBeDefined();
      expect(storedUser.lastLogin.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(storedUser.lastLogin.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('User Management', () => {
    let userId;

    beforeEach(() => {
      const user = userManager.createUser('testuser', 'test@example.com', 'password123');
      userId = user.id;
    });

    test('should get user by ID', () => {
      const user = userManager.getUser(userId);

      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');
    });

    test('should get user by username', () => {
      const user = userManager.getUserByUsername('testuser');

      expect(user).toBeDefined();
      expect(user.id).toBe(userId);
    });

    test('should update user', () => {
      const updated = userManager.updateUser(userId, {
        email: 'newemail@example.com'
      });

      expect(updated.email).toBe('newemail@example.com');
    });

    test('should update user password', () => {
      userManager.updateUser(userId, { password: 'newpassword123' });

      // Old password should not work
      expect(() => {
        userManager.authenticateUser('testuser', 'password123');
      }).toThrow();

      // New password should work
      const user = userManager.authenticateUser('testuser', 'newpassword123');
      expect(user).toBeDefined();
    });

    test('should delete user', () => {
      userManager.deleteUser(userId);

      expect(userManager.getUser(userId)).toBeNull();
    });

    test('should list users', () => {
      userManager.createUser('user2', 'user2@example.com', 'password123');

      const users = userManager.listUsers();

      expect(users.length).toBeGreaterThan(1);
    });
  });

  describe('API Key Management', () => {
    let userId;

    beforeEach(() => {
      const user = userManager.createUser('testuser', 'test@example.com', 'password123');
      userId = user.id;
    });

    test('should create API key', () => {
      const apiKey = userManager.createAPIKey(userId, 'test-key', ['read:agents']);

      expect(apiKey).toBeDefined();
      expect(apiKey.apiKey).toBeDefined();
      expect(apiKey.name).toBe('test-key');
      expect(apiKey.permissions).toContain('read:agents');
    });

    test('should verify valid API key', () => {
      const { apiKey } = userManager.createAPIKey(userId, 'test-key', []);

      const keyData = userManager.verifyAPIKey(apiKey);

      expect(keyData).toBeDefined();
      expect(keyData.userId).toBe(userId);
    });

    test('should reject invalid API key', () => {
      const keyData = userManager.verifyAPIKey('invalid-key');

      expect(keyData).toBeNull();
    });

    test('should revoke API key', () => {
      const { id, apiKey } = userManager.createAPIKey(userId, 'test-key', []);

      userManager.revokeAPIKey(id);

      const keyData = userManager.verifyAPIKey(apiKey);
      expect(keyData).toBeNull();
    });

    test('should list API keys for user', () => {
      userManager.createAPIKey(userId, 'key1', []);
      userManager.createAPIKey(userId, 'key2', []);

      const keys = userManager.listAPIKeys(userId);

      expect(keys.length).toBe(2);
      expect(keys[0].name).toBe('key1');
      expect(keys[1].name).toBe('key2');
    });

    test('should delete API keys when user is deleted', () => {
      userManager.createAPIKey(userId, 'test-key', []);

      userManager.deleteUser(userId);

      const keys = userManager.listAPIKeys(userId);
      expect(keys.length).toBe(0);
    });
  });

  describe('Role Management', () => {
    let userId;

    beforeEach(() => {
      const user = userManager.createUser(
        'testuser',
        'test@example.com',
        'password123',
        ['user', 'analyst']
      );
      userId = user.id;
    });

    test('should check if user has role', () => {
      expect(userManager.hasRole(userId, 'user')).toBe(true);
      expect(userManager.hasRole(userId, 'analyst')).toBe(true);
      expect(userManager.hasRole(userId, 'admin')).toBe(false);
    });

    test('should check if user has permission', () => {
      expect(userManager.hasPermission(userId, 'read:agents')).toBe(true);
      expect(userManager.hasPermission(userId, 'execute:skills')).toBe(true);
    });

    test('should grant admin all permissions', () => {
      const user = userManager.createUser(
        'testadmin',
        'testadmin@example.com',
        'password123',
        ['admin']
      );

      expect(userManager.hasPermission(user.id, 'read:agents')).toBe(true);
      expect(userManager.hasPermission(user.id, 'admin:users')).toBe(true);
      expect(userManager.hasPermission(user.id, 'any:permission')).toBe(true);
    });

    test('should grant guest limited permissions', () => {
      const user = userManager.createUser(
        'testguest',
        'testguest@example.com',
        'password123',
        ['guest']
      );

      expect(userManager.hasPermission(user.id, 'read:agents')).toBe(true);
      expect(userManager.hasPermission(user.id, 'execute:skills')).toBe(false);
    });
  });

  describe('Default Admin User', () => {
    test('should have default admin user', () => {
      const admin = userManager.getUserByUsername('admin');

      expect(admin).toBeDefined();
      expect(admin.roles).toContain('admin');
    });

    test('should authenticate with default admin credentials', () => {
      const admin = userManager.authenticateUser('admin', 'admin123');

      expect(admin).toBeDefined();
      expect(admin.username).toBe('admin');
    });
  });
});
