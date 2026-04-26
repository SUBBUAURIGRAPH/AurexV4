/**
 * AAT-DEEPRESEARCH — admin routes for the Google Deep Research (Gemini)
 * adapter. SUPER_ADMIN only.
 *
 *   POST  /api/v1/admin/research/run            — kick off a research run
 *   GET   /api/v1/admin/research/runs           — paginated list (filters)
 *   GET   /api/v1/admin/research/runs/:id       — single run
 *
 * The POST endpoint is the entry point for both interactive ops use
 * (curl from the runbook) and the weekly GitHub workflow
 * (`.github/workflows/gemini-regulatory-research.yml`). Both authenticate
 * with a long-lived super-admin JWT.
 *
 * Errors map onto RFC 7807 Problem Detail (ADM-052) — the provider
 * adapter's specific error classes (GeminiAuthError, GeminiRateLimitError,
 * GeminiServerError, GeminiNetworkError) bubble up to the express error
 * handler and surface as 502 Bad Gateway with the upstream error code in
 * `detail` so callers can dashboard the failure mode.
 */

import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import {
  getRunById,
  listRecentRuns,
  runResearch,
} from '../services/research/research.service.js';
import {
  GeminiAuthError,
  GeminiBadResponseError,
  GeminiKeyMissingError,
  GeminiNetworkError,
  GeminiRateLimitError,
  GeminiServerError,
} from '../services/research/gemini-deep-research.js';
import type { RegulatoryResearchRunStatus } from '@aurex/database';

export const adminResearchRouter: IRouter = Router();

adminResearchRouter.use(requireAuth, requireRole('SUPER_ADMIN'));

// ── Schemas ──────────────────────────────────────────────────────────────

const depthSchema = z.enum(['quick', 'standard', 'deep']);

const runResearchSchema = z.object({
  topic: z.string().min(3).max(500),
  scope: z.string().max(2000).optional(),
  depth: depthSchema.optional(),
  citationsRequired: z.boolean().optional(),
  maxSources: z.number().int().min(1).max(50).optional(),
});

const listFilterSchema = z.object({
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED']).optional(),
  topic: z.string().min(1).max(500).optional(),
  since: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const idParamSchema = z.object({ id: z.string().uuid('id must be a UUID') });

// ── Error mapping ────────────────────────────────────────────────────────

/**
 * Translate provider-layer errors into RFC 7807 AppError instances. Any
 * other error bubbles to the global error handler and surfaces as 500.
 */
function mapProviderError(err: unknown): AppError | null {
  if (err instanceof GeminiKeyMissingError) {
    return new AppError(
      503,
      'Service Unavailable',
      'GOOGLE_AI_API_KEY (or GEMINI_API_KEY) is not configured on this deployment.',
      'https://aurex.in/errors/research-key-missing',
    );
  }
  if (err instanceof GeminiAuthError) {
    return new AppError(
      502,
      'Bad Gateway',
      `Gemini auth failure: ${err.message}`,
      'https://aurex.in/errors/research-upstream-auth',
    );
  }
  if (err instanceof GeminiRateLimitError) {
    return new AppError(
      429,
      'Too Many Requests',
      err.message,
      'https://aurex.in/errors/research-rate-limited',
    );
  }
  if (err instanceof GeminiServerError) {
    return new AppError(
      502,
      'Bad Gateway',
      `Gemini upstream error: ${err.message}`,
      'https://aurex.in/errors/research-upstream',
    );
  }
  if (err instanceof GeminiNetworkError) {
    return new AppError(
      502,
      'Bad Gateway',
      `Gemini network error: ${err.message}`,
      'https://aurex.in/errors/research-network',
    );
  }
  if (err instanceof GeminiBadResponseError) {
    return new AppError(
      502,
      'Bad Gateway',
      `Gemini bad response: ${err.message}`,
      'https://aurex.in/errors/research-bad-response',
    );
  }
  return null;
}

// ── POST /run ────────────────────────────────────────────────────────────

adminResearchRouter.post(
  '/run',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = runResearchSchema.parse(req.body);

      const { finding, runId } = await runResearch(
        {
          topic: body.topic,
          ...(body.scope ? { scope: body.scope } : {}),
          ...(body.depth ? { depth: body.depth } : {}),
          ...(body.citationsRequired !== undefined
            ? { citationsRequired: body.citationsRequired }
            : {}),
          ...(body.maxSources !== undefined
            ? { maxSources: body.maxSources }
            : {}),
        },
        { triggeredBy: 'admin' },
      );

      res.status(200).json({ data: { ...finding, runId } });
    } catch (err) {
      const mapped = mapProviderError(err);
      if (mapped) {
        next(mapped);
        return;
      }
      next(err);
    }
  },
);

// ── GET /runs ────────────────────────────────────────────────────────────

adminResearchRouter.get(
  '/runs',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = listFilterSchema.parse(req.query);

      const result = await listRecentRuns({
        ...(filters.status
          ? { status: filters.status as RegulatoryResearchRunStatus }
          : {}),
        ...(filters.topic ? { topic: filters.topic } : {}),
        ...(filters.since ? { since: new Date(filters.since) } : {}),
        ...(filters.limit !== undefined ? { limit: filters.limit } : {}),
        ...(filters.offset !== undefined ? { offset: filters.offset } : {}),
      });

      res.status(200).json({
        data: result.rows,
        count: result.rows.length,
        total: result.total,
        limit: filters.limit ?? 25,
        offset: filters.offset ?? 0,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /runs/:id ────────────────────────────────────────────────────────

adminResearchRouter.get(
  '/runs/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const row = await getRunById(id);
      if (!row) {
        throw new AppError(
          404,
          'Not Found',
          `RegulatoryResearchRun ${id} not found`,
        );
      }
      res.status(200).json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);
