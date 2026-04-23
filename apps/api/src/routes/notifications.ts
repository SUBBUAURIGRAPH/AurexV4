import { Router, type IRouter } from 'express';
import { listNotificationsQuerySchema, updatePrefsSchema } from '@aurex/shared';
import { requireAuth } from '../middleware/auth.js';
import * as notificationService from '../services/notification.service.js';

export const notificationsRouter: IRouter = Router();

// All notification endpoints require auth; notifications are scoped to the
// calling user (not the org), so requireOrgScope isn't needed here.
notificationsRouter.use(requireAuth);

/**
 * GET /notifications — List notifications for the current user.
 * Query: unreadOnly, page, pageSize. Returns { data, pagination, unreadCount }.
 */
notificationsRouter.get('/', async (req, res, next) => {
  try {
    const parsed = listNotificationsQuerySchema.parse(req.query);
    const result = await notificationService.listNotifications({
      userId: req.user!.sub,
      unreadOnly: parsed.unreadOnly,
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /notifications/preferences — Current user's preferences.
 * Creates a default row on first read so callers always get a 200.
 * Declared before `/:id/read` to avoid being captured by a param route.
 */
notificationsRouter.get('/preferences', async (req, res, next) => {
  try {
    const prefs = await notificationService.getPreferences(req.user!.sub);
    res.json({ data: prefs });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /notifications/preferences — Update (upsert) current user's preferences.
 */
notificationsRouter.patch('/preferences', async (req, res, next) => {
  try {
    const data = updatePrefsSchema.parse(req.body);
    const prefs = await notificationService.updatePreferences(req.user!.sub, data);
    res.json({ data: prefs });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /notifications/mark-all-read — Mark all unread notifications as read.
 */
notificationsRouter.post('/mark-all-read', async (req, res, next) => {
  try {
    const result = await notificationService.markAllRead(req.user!.sub);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /notifications/:id/read — Mark a single notification as read.
 * 404 if the notification isn't owned by the caller.
 */
notificationsRouter.patch('/:id/read', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const updated = await notificationService.markRead(id, req.user!.sub);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});
