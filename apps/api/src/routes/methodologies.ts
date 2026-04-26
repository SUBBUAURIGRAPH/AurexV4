import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as methodologyService from '../services/methodology.service.js';

export const methodologiesRouter: IRouter = Router();

methodologiesRouter.use(requireAuth);

/**
 * GET / — list A6.4 methodologies (read-only catalogue).
 * Query: category (BASELINE_AND_MONITORING | REMOVAL | SMALL_SCALE | CONSOLIDATED | CDM_TRANSITION)
 *
 * AAT-R1: rows include the AV4-417 approval tracking fields
 * (`approvalSourceUrl`, `approvalDate`, `lastReviewedAt`) and the AV4-420
 * ICVCM CCP fields (`ccpEligible`, `ccpAssessmentDate`,
 * `ccpAssessmentSourceUrl`). The fields are nullable on the catalogue and
 * default to `null` / `false` for legacy rows.
 */
methodologiesRouter.get('/', async (req, res, next) => {
  try {
    const { category, isActive } = req.query as { category?: string; isActive?: string };
    const rows = await methodologyService.listMethodologies({
      category,
      isActive: isActive === undefined ? true : isActive === 'true',
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /:code — fetch one methodology by its A6.4 code (e.g. "A6.4-STAN-METH-004").
 */
methodologiesRouter.get('/:code', async (req, res, next) => {
  try {
    const row = await methodologyService.getMethodologyByCode(req.params.code as string);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});
