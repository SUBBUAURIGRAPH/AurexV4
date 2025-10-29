/**
 * JWT Authentication Tests
 * @version 1.0.0
 */

const JWTAuth = require('./jwt-auth');

describe('JWTAuth', () => {
  let jwtAuth;

  beforeEach(() => {
    jwtAuth = new JWTAuth();
  });

  describe('Token Generation', () => {
    test('should generate valid JWT token', () => {
      const token = jwtAuth.generateToken({
        userId: 'user123',
        username: 'testuser',
        roles: ['user']
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });

    test('should include correct payload in token', () => {
      const token = jwtAuth.generateToken({
        userId: 'user123',
        username: 'testuser',
        roles: ['user']
      });

      const payload = jwtAuth.verifyToken(token);
      expect(payload.userId).toBe('user123');
      expect(payload.username).toBe('testuser');
      expect(payload.roles).toEqual(['user']);
    });

    test('should generate unique JWT IDs', () => {
      const token1 = jwtAuth.generateToken({
        userId: 'user123',
        username: 'testuser',
        roles: ['user']
      });

      const token2 = jwtAuth.generateToken({
        userId: 'user123',
        username: 'testuser',
        roles: ['user']
      });

      const payload1 = jwtAuth.verifyToken(token1);
      const payload2 = jwtAuth.verifyToken(token2);

      expect(payload1.jti).not.toBe(payload2.jti);
    });
  });

  describe('Token Verification', () => {
    test('should verify valid token', () => {
      const token = jwtAuth.generateToken({
        userId: 'user123',
        username: 'testuser',
        roles: ['user']
      });

      const payload = jwtAuth.verifyToken(token);
      expect(payload).toBeDefined();
      expect(payload.userId).toBe('user123');
    });

    test('should reject invalid token format', () => {
      expect(() => jwtAuth.verifyToken('invalid.token')).toThrow();
    });

    test('should reject tampered token', () => {
      const token = jwtAuth.generateToken({
        userId: 'user123',
        username: 'testuser',
        roles: ['user']
      });

      const parts = token.split('.');
      const tamperedToken = parts[0] + '.' + parts[1] + '.invalidsignature';

      expect(() => jwtAuth.verifyToken(tamperedToken)).toThrow();
    });

    test('should reject expired token', (done) => {
      const token = jwtAuth.generateToken(
        {
          userId: 'user123',
          username: 'testuser',
          roles: ['user']
        },
        -1 // Expired 1 second ago
      );

      expect(() => jwtAuth.verifyToken(token)).toThrow('Token expired');
      done();
    });
  });

  describe('Token Refresh', () => {
    test('should create refresh token pair', () => {
      const tokens = jwtAuth.createRefreshToken({
        userId: 'user123',
        username: 'testuser',
        roles: ['user']
      });

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBe(3600);
    });

    test('should refresh access token using refresh token', () => {
      const tokens = jwtAuth.createRefreshToken({
        userId: 'user123',
        username: 'testuser',
        roles: ['user']
      });

      const newTokens = jwtAuth.refreshAccessToken(tokens.refreshToken);

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.accessToken).not.toBe(tokens.accessToken);
    });

    test('should reject invalid token type for refresh', () => {
      const accessToken = jwtAuth.generateToken(
        {
          userId: 'user123',
          username: 'testuser',
          roles: ['user'],
          type: 'access'
        },
        3600
      );

      expect(() => jwtAuth.refreshAccessToken(accessToken)).toThrow();
    });
  });

  describe('Token Revocation', () => {
    test('should revoke token', () => {
      const token = jwtAuth.generateToken({
        userId: 'user123',
        username: 'testuser',
        roles: ['user']
      });

      jwtAuth.revokeToken(token);

      expect(() => jwtAuth.verifyToken(token)).toThrow('Token not found in store');
    });
  });

  describe('Session Management', () => {
    test('should create session', () => {
      const sessionId = jwtAuth.createSession('user123', { loginTime: new Date() });

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
    });

    test('should verify valid session', () => {
      const sessionId = jwtAuth.createSession('user123', {});

      const isValid = jwtAuth.verifySession(sessionId);
      expect(isValid).toBe(true);
    });

    test('should reject invalid session', () => {
      const isValid = jwtAuth.verifySession('invalid-session-id');
      expect(isValid).toBe(false);
    });

    test('should get session details', () => {
      const sessionId = jwtAuth.createSession('user123', { ip: '127.0.0.1' });

      const session = jwtAuth.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session.userId).toBe('user123');
      expect(session.metadata.ip).toBe('127.0.0.1');
    });

    test('should revoke session', () => {
      const sessionId = jwtAuth.createSession('user123', {});

      jwtAuth.revokeSession(sessionId);

      const session = jwtAuth.getSession(sessionId);
      expect(session).toBeNull();
    });
  });

  describe('Cleanup', () => {
    test('should clean up expired tokens', () => {
      // Create token that expires immediately
      jwtAuth.generateToken({
        userId: 'user123',
        username: 'testuser',
        roles: ['user']
      }, -1);

      const initialStats = jwtAuth.getStats();
      jwtAuth.cleanup();
      const afterCleanup = jwtAuth.getStats();

      expect(afterCleanup.activeTokens).toBeLessThan(initialStats.activeTokens);
    });
  });

  describe('Statistics', () => {
    test('should report statistics', () => {
      jwtAuth.generateToken({
        userId: 'user123',
        username: 'testuser',
        roles: ['user']
      });

      jwtAuth.createSession('user123', {});

      const stats = jwtAuth.getStats();

      expect(stats.activeTokens).toBe(1);
      expect(stats.activeSessions).toBe(1);
      expect(stats.config.accessTokenExpiry).toBe(3600);
    });
  });
});
