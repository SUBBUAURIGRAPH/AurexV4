/**
 * Authentication Middleware Tests
 * Tests for JWT token verification and authentication
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyToken, authMiddleware, AuthenticatedRequest } from '../auth.js';
import { ApiError, ErrorCodes } from '../../../types/index.js';

// Set JWT_SECRET for testing
const TEST_SECRET = 'test-jwt-secret-key-12345';
process.env.JWT_SECRET = TEST_SECRET;

describe('Auth Middleware', () => {
  describe('verifyToken', () => {
    it('should verify valid JWT token', () => {
      const payload = {
        userId: 'user-123',
        email: 'user@example.com'
      };
      const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '24h' });

      const result = verifyToken(token);

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-123');
      expect(result.email).toBe('user@example.com');
    });

    it('should return null for expired token', () => {
      const payload = {
        userId: 'user-123',
        email: 'user@example.com'
      };
      const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '-1h' });

      const result = verifyToken(token);

      expect(result).toBeNull();
    });

    it('should return null for invalid signature', () => {
      const payload = {
        userId: 'user-123',
        email: 'user@example.com'
      };
      const token = jwt.sign(payload, 'wrong-secret', { expiresIn: '24h' });

      const result = verifyToken(token);

      expect(result).toBeNull();
    });

    it('should return null for malformed token', () => {
      const result = verifyToken('invalid.token.format');

      expect(result).toBeNull();
    });

    it('should return null for missing required fields', () => {
      const payload = {
        userId: 'user-123'
        // Missing email
      };
      const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '24h' });

      const result = verifyToken(token);

      expect(result).toBeNull();
    });

    it('should return null when JWT_SECRET is missing', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      const payload = {
        userId: 'user-123',
        email: 'user@example.com'
      };
      const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '24h' });

      const result = verifyToken(token);

      expect(result).toBeNull();

      // Restore
      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe('authMiddleware', () => {
    let req: Partial<AuthenticatedRequest>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
      req = {
        headers: {}
      };
      res = {};
      next = jest.fn();
    });

    it('should attach user to request with valid token', () => {
      const payload = {
        userId: 'user-123',
        email: 'user@example.com'
      };
      const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '24h' });

      req.headers = {
        authorization: `Bearer ${token}`
      };

      authMiddleware(req as AuthenticatedRequest, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect((req as AuthenticatedRequest).userId).toBe('user-123');
      expect((req as AuthenticatedRequest).user).toEqual({
        id: 'user-123',
        email: 'user@example.com'
      });
    });

    it('should return 401 when Authorization header is missing', () => {
      authMiddleware(req as AuthenticatedRequest, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ErrorCodes.UNAUTHORIZED);
    });

    it('should return 401 for invalid Authorization header format', () => {
      req.headers = {
        authorization: 'InvalidFormat token'
      };

      authMiddleware(req as AuthenticatedRequest, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ErrorCodes.INVALID_TOKEN);
    });

    it('should return 401 for invalid token', () => {
      req.headers = {
        authorization: 'Bearer invalid.token.here'
      };

      authMiddleware(req as AuthenticatedRequest, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ErrorCodes.INVALID_TOKEN);
    });

    it('should return 401 for expired token', () => {
      const payload = {
        userId: 'user-123',
        email: 'user@example.com'
      };
      const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '-1h' });

      req.headers = {
        authorization: `Bearer ${token}`
      };

      authMiddleware(req as AuthenticatedRequest, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ErrorCodes.INVALID_TOKEN);
    });

    it('should handle Bearer token correctly', () => {
      const payload = {
        userId: 'user-456',
        email: 'another@example.com'
      };
      const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '24h' });

      req.headers = {
        authorization: `Bearer ${token}`
      };

      authMiddleware(req as AuthenticatedRequest, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect((req as AuthenticatedRequest).userId).toBe('user-456');
      expect((req as AuthenticatedRequest).user?.email).toBe('another@example.com');
    });
  });
});
