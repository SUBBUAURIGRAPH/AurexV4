import { Router, type IRouter } from 'express';
import { AppError } from '../middleware/error-handler.js';
import { isValidEmail, sanitizeInput } from '../lib/security.js';
import { logger } from '../lib/logger.js';

export const authRouter: IRouter = Router();

/**
 * ADM-036/037: Modular auth routes
 * ADM-040: Separate rate limit tracking for auth failures
 * ADM-052: Input validation & sanitization
 */

authRouter.post('/login', (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      throw new AppError(400, 'Bad Request', 'Email and password are required');
    }

    if (!isValidEmail(email)) {
      throw new AppError(400, 'Bad Request', 'Invalid email format');
    }

    const sanitizedEmail = sanitizeInput(email, 254);

    // TODO: Implement actual auth with database lookup, bcrypt verify, JWT issuance
    logger.info({ email: sanitizedEmail }, 'Login attempt');

    res.json({
      message: 'Auth endpoint ready — database integration pending',
      email: sanitizedEmail,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/register', (req, res, next) => {
  try {
    const { email, password, name } = req.body as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email || !password || !name) {
      throw new AppError(400, 'Bad Request', 'Email, password, and name are required');
    }

    if (!isValidEmail(email)) {
      throw new AppError(400, 'Bad Request', 'Invalid email format');
    }

    if (password.length < 8) {
      throw new AppError(400, 'Bad Request', 'Password must be at least 8 characters');
    }

    logger.info({ email: sanitizeInput(email, 254) }, 'Registration attempt');

    res.status(201).json({
      message: 'Registration endpoint ready — database integration pending',
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (_req, res) => {
  // TODO: Invalidate JWT, clear session
  res.json({ message: 'Logged out' });
});

authRouter.get('/me', (_req, res) => {
  // TODO: JWT verification middleware
  res.status(401).json({
    type: 'https://aurex.in/errors/unauthorized',
    title: 'Unauthorized',
    status: 401,
    detail: 'Authentication required',
  });
});
