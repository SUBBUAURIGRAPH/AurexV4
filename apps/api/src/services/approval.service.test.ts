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
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    approvalComment: {
      create: vi.fn(),
    },
    approvalVote: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    orgWorkflowEnablement: {
      findUnique: vi.fn(),
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
        recipeId: null,
        requiredApprovers: 1,
        approvalsReceived: 0,
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

  it('resolves the recipe quorum and stamps it onto the new row', async () => {
    // No recipe enabled → fall back to the platform default of 1 approver.
    mockPrisma.orgWorkflowEnablement.findUnique.mockResolvedValue(null);

    mockPrisma.approvalRequest.create.mockResolvedValue({
      id: 'a1',
      orgId: 'org-1',
      resource: 'emissions_record',
      resourceId: 'e1',
      requestedBy: 'user-1',
      status: 'PENDING',
      recipeId: null,
      requiredApprovers: 1,
      approvalsReceived: 0,
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
      data: expect.objectContaining({
        orgId: 'org-1',
        requestedBy: 'user-1',
        resource: 'emissions_record',
        resourceId: 'e1',
        recipeId: null,
        requiredApprovers: 1,
        payload: { note: 'please review' },
      }),
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

  it('picks up the enabled recipe quorum when one exists', async () => {
    mockPrisma.orgWorkflowEnablement.findUnique.mockResolvedValue({
      recipeId: 'recipe-2',
      recipe: { requiredApprovers: 2 },
    });
    mockPrisma.approvalRequest.create.mockResolvedValue({
      id: 'a2',
      orgId: 'org-1',
      resource: 'report',
      resourceId: 'r1',
      requestedBy: 'user-1',
      status: 'PENDING',
      recipeId: 'recipe-2',
      requiredApprovers: 2,
      approvalsReceived: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await submitApproval({
      orgId: 'org-1',
      requestedBy: 'user-1',
      resource: 'report',
      resourceId: 'r1',
    });

    expect(mockPrisma.approvalRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipeId: 'recipe-2',
        requiredApprovers: 2,
      }),
    });
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
      requiredApprovers: 1,
      approvalsReceived: 1,
    });

    const err = await decideApproval({
      id: 'a1',
      orgId: 'org-1',
      deciderId: 'user-2',
      status: 'REJECTED',
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(409);
    expect(mockPrisma.approvalVote.create).not.toHaveBeenCalled();
  });

  it('throws 409 when the approver has already voted', async () => {
    mockPrisma.approvalRequest.findFirst.mockResolvedValue({
      id: 'a1',
      orgId: 'org-1',
      status: 'PENDING',
      requiredApprovers: 2,
      approvalsReceived: 0,
    });
    mockPrisma.approvalVote.findUnique.mockResolvedValue({
      id: 'v1',
      requestId: 'a1',
      userId: 'user-2',
      decision: 'APPROVED',
    });

    const err = await decideApproval({
      id: 'a1',
      orgId: 'org-1',
      deciderId: 'user-2',
      status: 'APPROVED',
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(409);
    expect(mockPrisma.approvalVote.create).not.toHaveBeenCalled();
  });

  it('flips to REJECTED on the first rejection vote (any-one fails quorum)', async () => {
    mockPrisma.approvalRequest.findFirst.mockResolvedValue({
      id: 'a1',
      orgId: 'org-1',
      status: 'PENDING',
      requiredApprovers: 3,
      approvalsReceived: 1,
    });
    mockPrisma.approvalVote.findUnique.mockResolvedValue(null);
    mockPrisma.approvalVote.create.mockResolvedValue({ id: 'v2' });
    mockPrisma.approvalRequest.update.mockResolvedValue({
      id: 'a1',
      status: 'REJECTED',
      decidedBy: 'user-2',
      decidedAt: new Date(),
    });

    const result = await decideApproval({
      id: 'a1',
      orgId: 'org-1',
      deciderId: 'user-2',
      status: 'REJECTED',
      reason: 'data is off',
    });

    expect(mockPrisma.approvalVote.create).toHaveBeenCalledWith({
      data: {
        requestId: 'a1',
        userId: 'user-2',
        decision: 'REJECTED',
        reason: 'data is off',
      },
    });
    expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: expect.objectContaining({
        status: 'REJECTED',
        decidedBy: 'user-2',
        reason: 'data is off',
      }),
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'approval.rejected' }),
    });
    expect(result.status).toBe('REJECTED');
  });

  it('increments the tally without flipping when quorum not yet reached', async () => {
    mockPrisma.approvalRequest.findFirst.mockResolvedValue({
      id: 'a1',
      orgId: 'org-1',
      status: 'PENDING',
      requiredApprovers: 3,
      approvalsReceived: 1,
    });
    mockPrisma.approvalVote.findUnique.mockResolvedValue(null);
    mockPrisma.approvalVote.create.mockResolvedValue({ id: 'v3' });
    mockPrisma.approvalRequest.update.mockResolvedValue({
      id: 'a1',
      status: 'PENDING',
      approvalsReceived: 2,
      requiredApprovers: 3,
    });

    const result = await decideApproval({
      id: 'a1',
      orgId: 'org-1',
      deciderId: 'user-3',
      status: 'APPROVED',
    });

    const updateArgs = mockPrisma.approvalRequest.update.mock.calls[0]?.[0] as
      | { data: Record<string, unknown> }
      | undefined;
    expect(updateArgs?.data.approvalsReceived).toBe(2);
    // Should NOT have flipped status.
    expect(updateArgs?.data.status).toBeUndefined();
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'approval.vote_cast' }),
    });
    expect(result.status).toBe('PENDING');
  });

  it('flips to APPROVED when the final approving vote reaches the quorum', async () => {
    mockPrisma.approvalRequest.findFirst.mockResolvedValue({
      id: 'a1',
      orgId: 'org-1',
      status: 'PENDING',
      requiredApprovers: 2,
      approvalsReceived: 1,
    });
    mockPrisma.approvalVote.findUnique.mockResolvedValue(null);
    mockPrisma.approvalVote.create.mockResolvedValue({ id: 'v4' });
    mockPrisma.approvalRequest.update.mockResolvedValue({
      id: 'a1',
      status: 'APPROVED',
      approvalsReceived: 2,
      requiredApprovers: 2,
      decidedBy: 'user-4',
      decidedAt: new Date(),
    });

    const result = await decideApproval({
      id: 'a1',
      orgId: 'org-1',
      deciderId: 'user-4',
      status: 'APPROVED',
      reason: 'looks good',
    });

    const updateArgs = mockPrisma.approvalRequest.update.mock.calls[0]?.[0] as
      | { data: Record<string, unknown> }
      | undefined;
    expect(updateArgs?.data.status).toBe('APPROVED');
    expect(updateArgs?.data.approvalsReceived).toBe(2);
    expect(updateArgs?.data.decidedBy).toBe('user-4');
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'approval.approved' }),
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
