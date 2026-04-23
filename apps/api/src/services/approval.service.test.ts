import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @aurex/database before importing the service. vi.mock is hoisted,
// so we construct the mock prisma via vi.hoisted() so it's available both
// inside the factory and in the test body.
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    approvalRequest: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    approvalComment: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));

import { AppError } from '../middleware/error-handler.js';
import {
  addComment,
  buildApprovalsWhere,
  decideApproval,
  listApprovals,
  submitApproval,
} from './approval.service.js';

describe('buildApprovalsWhere', () => {
  it('always scopes to orgId', () => {
    const where = buildApprovalsWhere({ orgId: 'org-1', page: 1, pageSize: 20 });
    expect(where).toEqual({ orgId: 'org-1' });
  });

  it('composes status, resource, and requestedBy filters', () => {
    const where = buildApprovalsWhere({
      orgId: 'org-1',
      status: 'PENDING',
      resource: 'emissions_record',
      requestedBy: 'user-2',
      page: 1,
      pageSize: 20,
    });
    expect(where).toEqual({
      orgId: 'org-1',
      status: 'PENDING',
      resource: 'emissions_record',
      requestedBy: 'user-2',
    });
  });

  it('omits optional filters when not supplied', () => {
    const where = buildApprovalsWhere({
      orgId: 'org-1',
      status: 'APPROVED',
      page: 2,
      pageSize: 10,
    });
    expect(where).toEqual({ orgId: 'org-1', status: 'APPROVED' });
  });
});

describe('listApprovals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes the composed where to findMany/count and returns pagination', async () => {
    mockPrisma.approvalRequest.findMany.mockResolvedValue([
      {
        id: 'a1',
        orgId: 'org-1',
        resource: 'emissions_record',
        resourceId: 'e1',
        requestedBy: 'user-1',
        status: 'PENDING',
        decidedBy: null,
        decidedAt: null,
        reason: null,
        payload: null,
        createdAt: new Date('2026-03-01T00:00:00Z'),
        updatedAt: new Date('2026-03-01T00:00:00Z'),
      },
    ]);
    mockPrisma.approvalRequest.count.mockResolvedValue(1);

    const result = await listApprovals({
      orgId: 'org-1',
      status: 'PENDING',
      page: 2,
      pageSize: 10,
    });

    expect(mockPrisma.approvalRequest.findMany).toHaveBeenCalledWith({
      where: { orgId: 'org-1', status: 'PENDING' },
      skip: 10,
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    expect(mockPrisma.approvalRequest.count).toHaveBeenCalledWith({
      where: { orgId: 'org-1', status: 'PENDING' },
    });
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
    expect(result.data[0]?.id).toBe('a1');
  });
});

describe('submitApproval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a PENDING row and records an audit log', async () => {
    mockPrisma.approvalRequest.create.mockResolvedValue({
      id: 'a1',
      orgId: 'org-1',
      resource: 'emissions_record',
      resourceId: 'e1',
      requestedBy: 'user-1',
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.auditLog.create.mockResolvedValue({});

    const result = await submitApproval({
      orgId: 'org-1',
      requestedBy: 'user-1',
      resource: 'emissions_record',
      resourceId: 'e1',
      payload: { note: 'please review' },
    });

    expect(mockPrisma.approvalRequest.create).toHaveBeenCalledWith({
      data: {
        orgId: 'org-1',
        requestedBy: 'user-1',
        resource: 'emissions_record',
        resourceId: 'e1',
        payload: { note: 'please review' },
      },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: 'org-1',
        userId: 'user-1',
        action: 'approval.submitted',
        resource: 'approval_request',
        resourceId: 'a1',
      }),
    });
    expect(result.id).toBe('a1');
  });
});

describe('decideApproval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws 404 when the request does not exist in the org', async () => {
    mockPrisma.approvalRequest.findFirst.mockResolvedValue(null);

    await expect(
      decideApproval({
        id: 'a1',
        orgId: 'org-1',
        deciderId: 'user-2',
        status: 'APPROVED',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('throws 409 when the request is already decided', async () => {
    mockPrisma.approvalRequest.findFirst.mockResolvedValue({
      id: 'a1',
      orgId: 'org-1',
      status: 'APPROVED',
    });
    // updateMany returns 0 because the status filter (=PENDING) doesn't match.
    mockPrisma.approvalRequest.updateMany.mockResolvedValue({ count: 0 });

    const err = await decideApproval({
      id: 'a1',
      orgId: 'org-1',
      deciderId: 'user-2',
      status: 'REJECTED',
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(409);
  });

  it('updates the row atomically and records an audit log on success', async () => {
    mockPrisma.approvalRequest.findFirst.mockResolvedValue({
      id: 'a1',
      orgId: 'org-1',
      status: 'PENDING',
    });
    mockPrisma.approvalRequest.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.approvalRequest.findUnique.mockResolvedValue({
      id: 'a1',
      orgId: 'org-1',
      status: 'APPROVED',
      decidedBy: 'user-2',
      decidedAt: new Date(),
    });
    mockPrisma.auditLog.create.mockResolvedValue({});

    const result = await decideApproval({
      id: 'a1',
      orgId: 'org-1',
      deciderId: 'user-2',
      status: 'APPROVED',
      reason: 'looks good',
    });

    expect(mockPrisma.approvalRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'a1', orgId: 'org-1', status: 'PENDING' },
      data: {
        status: 'APPROVED',
        decidedBy: 'user-2',
        decidedAt: expect.any(Date),
        reason: 'looks good',
      },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'approval.approved',
        resource: 'approval_request',
        resourceId: 'a1',
      }),
    });
    expect(result.status).toBe('APPROVED');
  });
});

describe('addComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws 404 when the approval does not exist in the org', async () => {
    mockPrisma.approvalRequest.findFirst.mockResolvedValue(null);

    const err = await addComment({
      requestId: 'a1',
      orgId: 'org-1',
      userId: 'user-1',
      body: 'nope',
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(404);
    expect(mockPrisma.approvalComment.create).not.toHaveBeenCalled();
  });

  it('inserts the comment when the approval belongs to the org', async () => {
    mockPrisma.approvalRequest.findFirst.mockResolvedValue({ id: 'a1' });
    mockPrisma.approvalComment.create.mockResolvedValue({
      id: 'c1',
      requestId: 'a1',
      userId: 'user-1',
      body: 'hello',
      createdAt: new Date(),
    });

    const result = await addComment({
      requestId: 'a1',
      orgId: 'org-1',
      userId: 'user-1',
      body: 'hello',
    });

    expect(mockPrisma.approvalComment.create).toHaveBeenCalledWith({
      data: { requestId: 'a1', userId: 'user-1', body: 'hello' },
    });
    expect(result.id).toBe('c1');
    expect(result.body).toBe('hello');
  });
});
