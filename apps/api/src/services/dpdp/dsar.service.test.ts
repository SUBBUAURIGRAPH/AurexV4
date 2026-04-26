/**
 * AAT-R3 / AV4-430 — DSAR service unit tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    dataPrincipalRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    emissionsRecord: { findMany: vi.fn() },
    retirement: { findMany: vi.fn() },
    consentRecord: { findMany: vi.fn() },
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma, Prisma: {} }));

import {
  buildDataExport,
  completeRequest,
  createRequest,
  listAll,
  listForUser,
  rejectRequest,
} from './dsar.service.js';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const HANDLER_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
});

function makeDsar(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dsar-1',
    userId: USER_ID,
    requestType: 'access',
    status: 'pending',
    requestNotes: null,
    responseUrl: null,
    responseNotes: null,
    requestedAt: new Date('2026-04-26T00:00:00Z'),
    completedAt: null,
    rejectedAt: null,
    rejectedReason: null,
    handlerUserId: null,
    createdAt: new Date('2026-04-26T00:00:00Z'),
    updatedAt: new Date('2026-04-26T00:00:00Z'),
    ...overrides,
  };
}

describe('createRequest', () => {
  it('creates an access DSAR with status=pending', async () => {
    mockPrisma.dataPrincipalRequest.create.mockResolvedValue(makeDsar());
    const dto = await createRequest({ userId: USER_ID, requestType: 'access' });
    expect(dto.requestType).toBe('access');
    expect(dto.status).toBe('pending');
    expect(mockPrisma.dataPrincipalRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: USER_ID,
        requestType: 'access',
        status: 'pending',
      }),
    });
  });

  it('passes through requestNotes for correction/erasure', async () => {
    mockPrisma.dataPrincipalRequest.create.mockResolvedValue(
      makeDsar({ requestType: 'correction', requestNotes: 'Fix my email' }),
    );
    const dto = await createRequest({
      userId: USER_ID,
      requestType: 'correction',
      requestNotes: 'Fix my email',
    });
    expect(dto.requestNotes).toBe('Fix my email');
  });
});

describe('listForUser / listAll', () => {
  it('listForUser orders by requestedAt desc', async () => {
    mockPrisma.dataPrincipalRequest.findMany.mockResolvedValue([makeDsar()]);
    const rows = await listForUser(USER_ID);
    expect(rows).toHaveLength(1);
    expect(mockPrisma.dataPrincipalRequest.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: { requestedAt: 'desc' },
    });
  });

  it('listAll filters by status when provided + paginates', async () => {
    mockPrisma.dataPrincipalRequest.findMany.mockResolvedValue([makeDsar()]);
    mockPrisma.dataPrincipalRequest.count.mockResolvedValue(1);

    const result = await listAll({ status: 'pending', page: 2, pageSize: 10 });
    expect(result.total).toBe(1);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    const args = mockPrisma.dataPrincipalRequest.findMany.mock.calls[0]![0]!;
    expect(args.where).toEqual({ status: 'pending' });
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
  });
});

describe('completeRequest', () => {
  it('flips to completed with handler + response fields', async () => {
    mockPrisma.dataPrincipalRequest.findUnique.mockResolvedValue(makeDsar());
    mockPrisma.dataPrincipalRequest.update.mockResolvedValue(
      makeDsar({
        status: 'completed',
        completedAt: new Date('2026-04-27T00:00:00Z'),
        handlerUserId: HANDLER_ID,
        responseUrl: 'https://example.com/export.json',
      }),
    );

    const dto = await completeRequest({
      requestId: 'dsar-1',
      handlerUserId: HANDLER_ID,
      responseUrl: 'https://example.com/export.json',
    });
    expect(dto?.status).toBe('completed');
    expect(dto?.handlerUserId).toBe(HANDLER_ID);
    expect(dto?.responseUrl).toBe('https://example.com/export.json');
  });

  it('returns null when DSAR not found', async () => {
    mockPrisma.dataPrincipalRequest.findUnique.mockResolvedValue(null);
    const dto = await completeRequest({
      requestId: 'missing',
      handlerUserId: HANDLER_ID,
    });
    expect(dto).toBeNull();
    expect(mockPrisma.dataPrincipalRequest.update).not.toHaveBeenCalled();
  });
});

describe('rejectRequest', () => {
  it('flips to rejected with reason', async () => {
    mockPrisma.dataPrincipalRequest.findUnique.mockResolvedValue(makeDsar());
    mockPrisma.dataPrincipalRequest.update.mockResolvedValue(
      makeDsar({
        status: 'rejected',
        rejectedAt: new Date('2026-04-27T00:00:00Z'),
        rejectedReason: 'Legal hold',
        handlerUserId: HANDLER_ID,
      }),
    );

    const dto = await rejectRequest({
      requestId: 'dsar-1',
      handlerUserId: HANDLER_ID,
      rejectedReason: 'Legal hold',
    });
    expect(dto?.status).toBe('rejected');
    expect(dto?.rejectedReason).toBe('Legal hold');
  });
});

describe('buildDataExport', () => {
  it('aggregates user profile + emissions + retirements + consent', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: USER_ID,
      email: 'a@b.com',
      name: 'Alice',
    });
    mockPrisma.emissionsRecord.findMany.mockResolvedValue([
      { id: 'er-1', scope: 'SCOPE_1', value: 10 },
    ]);
    mockPrisma.retirement.findMany.mockResolvedValue([
      { id: 'rt-1', tonnesRetired: 5 },
    ]);
    mockPrisma.consentRecord.findMany.mockResolvedValue([]);

    const exp = await buildDataExport(USER_ID);
    expect(exp.user).toEqual({ id: USER_ID, email: 'a@b.com', name: 'Alice' });
    expect(exp.emissionsRecords).toHaveLength(1);
    expect(exp.retirements).toHaveLength(1);
    expect(typeof exp.generatedAt).toBe('string');
    expect(exp.notice).toMatch(/Basic DPDP/);
  });
});
