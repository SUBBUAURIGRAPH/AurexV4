import { Router, type IRouter } from 'express';
import {
  createSupplierSchema,
  updateSupplierSchema,
  listSuppliersQuerySchema,
  createSupplierRequestSchema,
  submitSupplierRequestSchema,
  decideSupplierRequestSchema,
  listSupplierRequestsQuerySchema,
} from '@aurex/shared';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { requireOrgRole } from '../middleware/org-role.js';
import * as supplierService from '../services/supplier.service.js';

export const suppliersRouter: IRouter = Router();

suppliersRouter.use(requireAuth, requireOrgScope);

const MANAGE_ROLES = ['ORG_ADMIN', 'SUPER_ADMIN', 'MANAGER'];
const DECIDE_ROLES = ['ORG_ADMIN', 'SUPER_ADMIN', 'MANAGER', 'APPROVER'];

/**
 * GET /suppliers/requests — list data requests (must be before /:id so the
 * literal path takes precedence over the param route).
 */
suppliersRouter.get('/requests', async (req, res, next) => {
  try {
    const parsed = listSupplierRequestsQuerySchema.parse(req.query);
    const result = await supplierService.listDataRequests(req.orgId!, parsed);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

suppliersRouter.get('/requests/:id', async (req, res, next) => {
  try {
    const row = await supplierService.getDataRequest(req.params.id as string, req.orgId!);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

suppliersRouter.post('/requests/:id/submit', async (req, res, next) => {
  try {
    const { submittedValue } = submitSupplierRequestSchema.parse(req.body);
    const row = await supplierService.submitDataRequest(
      req.params.id as string,
      req.orgId!,
      req.user!.sub,
      submittedValue,
      req.ip,
    );
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

suppliersRouter.patch(
  '/requests/:id/decide',
  requireOrgRole(...DECIDE_ROLES),
  async (req, res, next) => {
    try {
      const { status, reviewNotes } = decideSupplierRequestSchema.parse(req.body);
      const row = await supplierService.decideDataRequest(
        req.params.id as string,
        req.orgId!,
        req.user!.sub,
        status,
        reviewNotes,
        req.ip,
      );
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Suppliers CRUD ─────────────────────────────────────────────────────

suppliersRouter.get('/', async (req, res, next) => {
  try {
    const parsed = listSuppliersQuerySchema.parse(req.query);
    const result = await supplierService.listSuppliers(req.orgId!, parsed);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

suppliersRouter.post('/', requireOrgRole(...MANAGE_ROLES), async (req, res, next) => {
  try {
    const data = createSupplierSchema.parse(req.body);
    const row = await supplierService.createSupplier(req.orgId!, req.user!.sub, data, req.ip);
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

suppliersRouter.get('/:id', async (req, res, next) => {
  try {
    const row = await supplierService.getSupplier(req.params.id as string, req.orgId!);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

suppliersRouter.patch('/:id', requireOrgRole(...MANAGE_ROLES), async (req, res, next) => {
  try {
    const data = updateSupplierSchema.parse(req.body);
    const row = await supplierService.updateSupplier(
      req.params.id as string,
      req.orgId!,
      req.user!.sub,
      data as Record<string, unknown>,
      req.ip,
    );
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

suppliersRouter.delete('/:id', requireOrgRole('ORG_ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    await supplierService.deleteSupplier(
      req.params.id as string,
      req.orgId!,
      req.user!.sub,
      req.ip,
    );
    res.json({ message: 'Supplier deleted' });
  } catch (err) {
    next(err);
  }
});

suppliersRouter.post('/:id/requests', requireOrgRole(...MANAGE_ROLES), async (req, res, next) => {
  try {
    const data = createSupplierRequestSchema.parse(req.body);
    const row = await supplierService.createDataRequest(
      req.params.id as string,
      req.orgId!,
      req.user!.sub,
      data,
      req.ip,
    );
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});
