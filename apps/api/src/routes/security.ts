import { Router, type IRouter } from 'express';
import { changePasswordSchema, mfaVerifySchema, mfaDisableSchema } from '@aurex/shared';
import { requireAuth } from '../middleware/auth.js';
import * as securityService from '../services/security.service.js';
import * as userService from '../services/user.service.js';

/**
 * AV4-273 — account self-service security routes. All scoped to
 * `req.user.sub` — a user can only manage their own credentials/sessions.
 * Mounted under /api/v1/users/me so URLs read naturally.
 */
export const securityRouter: IRouter = Router();

securityRouter.use(requireAuth);

securityRouter.get('/', async (req, res, next) => {
  try {
    const profile = await userService.getProfile(req.user!.sub);
    res.json({ data: profile });
  } catch (err) {
    next(err);
  }
});

securityRouter.patch('/password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    await securityService.changePassword(
      req.user!.sub,
      currentPassword,
      newPassword,
      req.ip,
      req.headers['user-agent'],
    );
    res.json({ message: 'Password changed. All sessions invalidated.' });
  } catch (err) {
    next(err);
  }
});

securityRouter.post('/mfa/enroll', async (req, res, next) => {
  try {
    const { secret, otpauthUrl } = await securityService.enrollMfa(
      req.user!.sub,
      req.user!.email,
    );
    res.json({ data: { secret, otpauthUrl } });
  } catch (err) {
    next(err);
  }
});

securityRouter.post('/mfa/verify', async (req, res, next) => {
  try {
    const { code } = mfaVerifySchema.parse(req.body);
    await securityService.verifyMfaEnrollment(
      req.user!.sub,
      code,
      req.ip,
      req.headers['user-agent'],
    );
    res.json({ data: { enabled: true } });
  } catch (err) {
    next(err);
  }
});

securityRouter.post('/mfa/disable', async (req, res, next) => {
  try {
    const { password } = mfaDisableSchema.parse(req.body);
    await securityService.disableMfa(
      req.user!.sub,
      password,
      req.ip,
      req.headers['user-agent'],
    );
    res.json({ data: { enabled: false } });
  } catch (err) {
    next(err);
  }
});

securityRouter.get('/sessions', async (req, res, next) => {
  try {
    const rows = await securityService.listSessions(req.user!.sub);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

securityRouter.delete('/sessions/:id', async (req, res, next) => {
  try {
    await securityService.revokeSession(req.user!.sub, req.params.id as string);
    res.json({ message: 'Session revoked' });
  } catch (err) {
    next(err);
  }
});

securityRouter.delete('/sessions', async (req, res, next) => {
  try {
    const result = await securityService.revokeAllSessions(req.user!.sub);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});
