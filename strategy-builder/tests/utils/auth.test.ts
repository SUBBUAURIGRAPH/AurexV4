/**
 * Authentication Utilities Tests
 */

import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  hashPassword,
  comparePassword
} from '../../src/utils/auth';
import { UserRole } from '../../src/types';

describe('Authentication Utilities', () => {
  describe('generateAccessToken', () => {
    it('should generate valid JWT token', () => {
      const token = generateAccessToken({
        userId: '123',
        email: 'test@example.com',
        role: UserRole.TRADER
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token', () => {
      const token = generateRefreshToken('123');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const token = generateAccessToken({
        userId: '123',
        email: 'test@example.com',
        role: UserRole.TRADER
      });

      const decoded = verifyToken(token);

      expect(decoded.userId).toBe('123');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.role).toBe(UserRole.TRADER);
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyToken('invalid-token')).toThrow();
    });
  });

  describe('hashPassword', () => {
    it('should hash password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await hashPassword(password);

      const result = await comparePassword(password, hash);

      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await hashPassword(password);

      const result = await comparePassword('WrongPassword', hash);

      expect(result).toBe(false);
    });
  });
});
