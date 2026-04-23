import { Router, type IRouter } from 'express';
import { AppError } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { isValidEmail, sanitizeInput } from '../lib/security.js';
import * as authService from '../services/auth.service.js';

export const authRouter: IRouter = Router();

/**
 * ADM-036/037: Modular auth routes with real JWT + bcrypt
 * ADM-040: Auth failure tracking via service layer
 * ADM-052: Input validation & sanitization
 */

function getClientIP(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      throw new AppError(400, 'Bad Request', 'Email and password are required');
    }
    if (!isValidEmail(email)) {
      throw new AppError(400, 'Bad Request', 'Invalid email format');
    }

    const result = await authService.login(
      sanitizeInput(email, 254),
      password,
      getClientIP(req),
      req.headers['user-agent'],
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/register', async (req, res, next) => {
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

    const user = await authService.register(
      sanitizeInput(email, 254),
      password,
      sanitizeInput(name, 200),
    );

    res.status(201).json({ data: user });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      throw new AppError(400, 'Bad Request', 'Refresh token required');
    }

    const tokens = await authService.refreshTokens(
      refreshToken,
      getClientIP(req),
      req.headers['user-agent'],
    );

    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    await authService.logout(refreshToken ?? '', req.user?.sub);
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({
    data: {
      id: req.user!.sub,
      email: req.user!.email,
      role: req.user!.role,
    },
  });
});
