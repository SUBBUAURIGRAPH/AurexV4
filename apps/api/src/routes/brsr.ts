import { Router, type IRouter } from 'express';
import {
  listBrsrPrinciplesQuerySchema,
  listBrsrIndicatorsQuerySchema,
  upsertBrsrResponseSchema,
  listBrsrResponsesQuerySchema,
} from '@aurex/shared';
import { prisma } from '@aurex/database';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import { requireOnboardingComplete } from '../middleware/onboarding-gate.js';
import { requireActiveSubscription } from '../middleware/subscription-active-gate.js';
import * as brsrService from '../services/brsr.service.js';
import {
  renderBrsrPdf,
  renderBrsrXbrl,
  validateBrsrXbrl,
} from '../services/brsr-render.service.js';

export const brsrRouter: IRouter = Router();

/**
 * AAT-10D (Wave 10d): roles permitted to generate the BRSR Core PDF /
 * XBRL output. Viewers (READ-only) can still read responses but cannot
 * trigger a regulator-grade export — that path is gated to writers +
 * admins so the action shows up cleanly in the audit log.
 */
const BRSR_RENDER_ROLES = ['ORG_ADMIN', 'MAKER', 'APPROVER', 'SUPER_ADMIN'];

brsrRouter.use(requireAuth);

brsrRouter.get('/principles', async (req, res, next) => {
  try {
    const parsed = listBrsrPrinciplesQuerySchema.parse(req.query);
    const result = await brsrService.listPrinciples(parsed);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

brsrRouter.get('/principles/:id', async (req, res, next) => {
  try {
    const row = await brsrService.getPrinciple(req.params.id as string);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

brsrRouter.get('/indicators', async (req, res, next) => {
  try {
    const parsed = listBrsrIndicatorsQuerySchema.parse(req.query);
    const result = await brsrService.listIndicators(parsed);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

brsrRouter.get('/indicators/:id', async (req, res, next) => {
  try {
    const row = await brsrService.getIndicator(req.params.id as string);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

brsrRouter.get('/responses', requireOrgScope, async (req, res, next) => {
  try {
    const parsed = listBrsrResponsesQuerySchema.parse(req.query);
    const result = await brsrService.listResponses(req.orgId!, parsed);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

brsrRouter.put('/responses', requireOrgScope, requireOnboardingComplete, requireActiveSubscription, async (req, res, next) => {
  try {
    const data = upsertBrsrResponseSchema.parse(req.body);
    const row = await brsrService.upsertResponse(req.orgId!, req.user!.sub, data);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /responses/:year/render?format=pdf|xbrl  (AAT-10D / Wave 10d)
 *
 * Generate a BRSR Core export for the caller's org for the given
 * BRSR start year (the URL takes a single number — `2024` — and the
 * service normalises it to the `2024-25` fiscal-year string).
 *
 *   • format=pdf  (default) → application/pdf, attachment download
 *   • format=xbrl           → application/xml, attachment download
 *
 * The PDF is human-review-grade and includes a cover page, ToC, and
 * one section per principle. The XBRL is well-formed under the SEBI
 * BRSR Core taxonomy namespace; see XBRL_TAXONOMY_GAPS in
 * brsr-render.service.ts for the explicit certification-vs-this-wave
 * delta. Both formats are read-only — no DB mutations occur.
 *
 * Auth: requireOrgScope + requireOrgRole(ORG_ADMIN/MAKER/APPROVER/
 * SUPER_ADMIN). Viewers are deliberately excluded.
 *
 * IMPORTANT: This route is registered BEFORE
 * `/responses/:indicatorId/:fiscalYear` because Express matches routes
 * in registration order and `/responses/2024/render` would otherwise
 * be captured by the more general two-parameter route.
 */
brsrRouter.get(
  '/responses/:year/render',
  requireOrgScope,
  requireOrgRole(...BRSR_RENDER_ROLES),
  async (req, res, next) => {
    try {
      const yearRaw = req.params.year as string;
      const year = Number(yearRaw);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        res.status(400).json({
          type: 'https://aurex.in/errors/bad-request',
          title: 'Bad Request',
          status: 400,
          detail: `Invalid BRSR year: "${yearRaw}" (expected an integer 2000..2100)`,
        });
        return;
      }

      const formatRaw = typeof req.query.format === 'string'
        ? req.query.format.toLowerCase()
        : 'pdf';
      if (formatRaw !== 'pdf' && formatRaw !== 'xbrl') {
        res.status(400).json({
          type: 'https://aurex.in/errors/bad-request',
          title: 'Bad Request',
          status: 400,
          detail: `Invalid format: "${formatRaw}" (expected "pdf" or "xbrl")`,
        });
        return;
      }

      // Resolve org slug for the filename. Falls back to the orgId
      // prefix if the membership-resolved org row has somehow been
      // soft-deleted between requireOrgScope and here.
      const org = await prisma.organization.findUnique({
        where: { id: req.orgId! },
        select: { slug: true },
      });
      const orgSlug = org?.slug ?? `org-${req.orgId!.slice(0, 8)}`;

      if (formatRaw === 'pdf') {
        const buf = await renderBrsrPdf(req.orgId!, year);
        const filename = `brsr-${orgSlug}-${year}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${filename}"`,
        );
        res.setHeader('Content-Length', buf.byteLength.toString());
        res.send(buf);
        return;
      }

      // format === 'xbrl'
      const xml = await renderBrsrXbrl(req.orgId!, year);

      // AAT-R2 / AV4-426: SEBI XSD validation. Warn-mode for now —
      // we still emit the XBRL even when validation fails so operators
      // can iterate, but the result is surfaced via response headers
      // (download path) or the JSON body (validate=true path) so
      // dashboards + the BRSR Builder UI can flag warn-mode filings.
      // Flip to hard-fail (return 422) once the canonical SEBI XSD
      // replaces the vendored placeholder — see BRSR_XSD_VERSION.
      const xsdValidation = validateBrsrXbrl(xml);
      if (!xsdValidation.valid) {
        // Don't fail the request; just log. Keeps the warn-mode
        // contract explicit in the server log even when the caller
        // didn't ask for the validate=true JSON envelope.
         
        console.warn(
          '[brsr] XBRL warn-mode validation failed',
          xsdValidation.errors,
        );
      }

      // ── JSON envelope: ?validate=true returns { data: { xml,
      //    xsdValidation } } so the BRSR Builder can surface the
      //    validation result inline without re-uploading the file
      //    through a second endpoint. Default behaviour stays the
      //    binary attachment download for backwards compat with the
      //    existing Generate button.
      const wantValidateEnvelope =
        typeof req.query.validate === 'string' &&
        ['1', 'true', 'yes'].includes(req.query.validate.toLowerCase());

      if (wantValidateEnvelope) {
        res.json({
          data: {
            xml,
            xsdValidation,
            fiscalYear: `${year}-${String((year + 1) % 100).padStart(2, '0')}`,
            orgSlug,
          },
        });
        return;
      }

      const filename = `brsr-${orgSlug}-${year}.xbrl`;
      const buf = Buffer.from(xml, 'utf-8');
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.setHeader('Content-Length', buf.byteLength.toString());
      // AAT-R2 / AV4-426: surface the warn-mode XSD validation summary
      // in response headers so dashboards + e2e tests can detect bad
      // filings without re-parsing the body.
      res.setHeader(
        'X-Brsr-Xsd-Valid',
        xsdValidation.valid ? 'true' : 'false',
      );
      res.setHeader('X-Brsr-Xsd-Version', xsdValidation.xsdVersion);
      if (xsdValidation.placeholder) {
        res.setHeader('X-Brsr-Xsd-Placeholder', 'true');
      }
      if (!xsdValidation.valid) {
        res.setHeader(
          'X-Brsr-Xsd-Error-Count',
          String(xsdValidation.errors.length),
        );
      }
      res.send(buf);
    } catch (err) {
      next(err);
    }
  },
);

brsrRouter.get('/responses/:indicatorId/:fiscalYear', requireOrgScope, async (req, res, next) => {
  try {
    const row = await brsrService.getResponse(
      req.orgId!,
      req.params.indicatorId as string,
      req.params.fiscalYear as string,
    );
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});
