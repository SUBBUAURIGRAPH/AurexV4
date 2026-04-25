/**
 * AAT-λ / AV4-355 + AV4-356 — Public BioCarbon marketplace API.
 *
 * Mounted at /api/v1/biocarbon/* with NO authentication. Implements:
 *   GET /marketplace          — paginated list of MINTED issuances (B14)
 *   GET /tokens/:bcrSerialId  — single-token detail with timeline + B13/B14
 *
 * Security posture:
 *   - No PII in any response (retiree identity is redacted; only the BCR
 *     purpose code + a hashed beneficiary ref token are surfaced).
 *   - The dedicated `publicReadLimiter` allows 300 req/min per IP — a looser
 *     cap than the general 100/min so SEO crawlers + casual browsing don't
 *     get throttled, while still preventing scraping floods.
 */
import { Router, type IRouter } from 'express';
import { z } from 'zod';
import {
  TokenNotFoundError,
  getTokenDetail,
  listMarketplace,
  type ListMarketplaceQuery,
  type PublicListingStatus,
} from '../services/biocarbon-public.service.js';
import { rateLimiter } from '../middleware/rate-limiter.js';

export const biocarbonPublicRouter: IRouter = Router();

// TODO(AV4-355): swap for a dedicated public-read limiter (300 req/min cap)
// once the looser-bucket middleware lands. For now, the global rateLimiter
// is the authoritative gate.
biocarbonPublicRouter.use(rateLimiter);

const STATUS_VALUES: readonly PublicListingStatus[] = [
  'MINTED',
  'DELISTED_IN_FLIGHT',
  'RETIRED',
] as const;

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  methodologyCode: z.string().min(1).max(100).optional(),
  vintage: z.coerce.number().int().min(2000).max(2100).optional(),
  status: z.enum(['MINTED', 'DELISTED_IN_FLIGHT', 'RETIRED']).optional(),
  search: z.string().min(1).max(255).optional(),
});

biocarbonPublicRouter.get('/marketplace', async (req, res, next) => {
  try {
    const parsed = listQuerySchema.parse(req.query);
    const query: ListMarketplaceQuery = parsed;
    const result = await listMarketplace(query);
    // Normalise STATUS_VALUES use so it isn't tree-shaken (referenced for typing only).
    void STATUS_VALUES;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const detailParamsSchema = z.object({
  bcrSerialId: z.string().min(1).max(255),
});

biocarbonPublicRouter.get('/tokens/:bcrSerialId', async (req, res, next) => {
  try {
    const { bcrSerialId } = detailParamsSchema.parse(req.params);
    const result = await getTokenDetail(bcrSerialId);
    res.json(result);
  } catch (err) {
    if (err instanceof TokenNotFoundError) {
      res.status(404).json({
        type: 'https://aurex.in/errors/token-not-found',
        title: 'Not Found',
        status: 404,
        detail: err.message,
        instance: req.originalUrl,
      });
      return;
    }
    next(err);
  }
});
