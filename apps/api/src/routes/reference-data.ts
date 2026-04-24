import { Router, type IRouter } from 'express';
import { z } from 'zod';
import * as emissionsService from '../services/emissions.service.js';
import * as categoryMappingService from '../services/category-mapping.service.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';

export const referenceDataRouter: IRouter = Router();

const upsertMappingSchema = z.object({
  scope: z.enum(['SCOPE_1', 'SCOPE_2', 'SCOPE_3']),
  category: z.string().min(1).max(100),
  esgIndicatorCodes: z.array(z.string()).max(50),
  brsrIndicatorCodes: z.array(z.string()).max(50),
});

/**
 * GET /emission-sources — List emission sources (reference data, no auth required)
 * Query: scope, category
 */
referenceDataRouter.get('/emission-sources', async (req, res, next) => {
  try {
    const { scope, category } = req.query as { scope?: string; category?: string };
    const sources = await emissionsService.listEmissionSources(scope, category);
    res.json({ data: sources });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /emission-factors — List emission factors (reference data, no auth required)
 * Query: scope, category, source
 */
referenceDataRouter.get('/emission-factors', async (req, res, next) => {
  try {
    const { scope, category, source } = req.query as {
      scope?: string;
      category?: string;
      source?: string;
    };
    const factors = await emissionsService.listEmissionFactors(scope, category, source);
    res.json({ data: factors });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /category-mappings — list mappings available to the caller's org.
 * Returns org overrides merged with platform defaults (both visible so the UI
 * can show "inherited" vs "custom"). Query: scope, includeDefaults.
 */
referenceDataRouter.get(
  '/category-mappings',
  requireAuth,
  requireOrgScope,
  async (req, res, next) => {
    try {
      const { scope, includeDefaults } = req.query as {
        scope?: string;
        includeDefaults?: string;
      };
      const rows = await categoryMappingService.listMappings({
        orgId: req.orgId!,
        scope,
        includeDefaults: includeDefaults !== 'false',
      });
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /category-mappings/resolve — resolve (scope, category) to its effective
 * mapping for this org. Org override wins over platform default.
 * Query: scope (required), category (required).
 */
referenceDataRouter.get(
  '/category-mappings/resolve',
  requireAuth,
  requireOrgScope,
  async (req, res, next) => {
    try {
      const { scope, category } = req.query as { scope?: string; category?: string };
      if (!scope || !category) {
        res.status(400).json({
          type: 'https://aurex.in/errors/bad-request',
          title: 'Bad Request',
          status: 400,
          detail: 'scope and category are required',
        });
        return;
      }
      const mapping = await categoryMappingService.resolveMapping(
        req.orgId!,
        scope,
        category,
      );
      res.json({ data: mapping });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /category-mappings — upsert an org-specific override. ORG_ADMIN+ only.
 */
referenceDataRouter.put(
  '/category-mappings',
  requireAuth,
  requireOrgScope,
  requireOrgRole('ORG_ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const data = upsertMappingSchema.parse(req.body);
      const row = await categoryMappingService.upsertOrgMapping(req.orgId!, data);
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /category-mappings/:scope/:category — remove an org override
 * (reverts to platform default). ORG_ADMIN+ only.
 */
referenceDataRouter.delete(
  '/category-mappings/:scope/:category',
  requireAuth,
  requireOrgScope,
  requireOrgRole('ORG_ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      await categoryMappingService.deleteOrgMapping(
        req.orgId!,
        req.params.scope as string,
        req.params.category as string,
      );
      res.json({ message: 'Override removed' });
    } catch (err) {
      next(err);
    }
  },
);
