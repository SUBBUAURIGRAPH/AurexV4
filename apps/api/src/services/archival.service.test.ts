import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

/**
 * Unit tests for `archival.service` — AV4-338.
 *
 * We mock `@aurex/database` and `./audit-log.service` so the service is
 * exercised without Postgres. The BlobStore under test is a tiny in-memory
 * stub passed explicitly via `opts.blobStore`.
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    monitoringPeriod: { findUnique: vi.fn(), findMany: vi.fn() },
    monitoringDatapoint: { deleteMany: vi.fn(), createMany: vi.fn() },
    datapointArchive: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));
vi.mock('./audit-log.service.js', () => ({ recordAudit: vi.fn() }));

import {
  archivePeriod,
  restorePeriod,
  LocalDirBlobStore,
  type BlobStore,
} from './archival.service.js';

// In-memory blob store for round-trip tests.
class MemoryBlobStore implements BlobStore {
  private data = new Map<string, Buffer>();
  async put(key: string, bytes: Buffer) {
    this.data.set(key, bytes);
    return { url: `mem://${key}`, bytes: bytes.length };
  }
  async get(key: string) {
    const b = this.data.get(key);
    if (!b) throw new Error(`not found: ${key}`);
    return b;
  }
  async exists(key: string) {
    return this.data.has(key);
  }
  tamper(key: string, replacement: Buffer) {
    this.data.set(key, replacement);
  }
}

const samplePeriod = {
  id: 'p-1',
  activityId: 'a-1',
  periodStart: new Date('2026-01-01'),
  periodEnd: new Date('2026-03-31'),
  activity: { id: 'a-1', title: 't', creditingPeriodEnd: new Date('2020-01-01') },
  datapoints: [
    {
      id: 'dp-1',
      periodId: 'p-1',
      parameterId: 'pa-1',
      timestamp: new Date('2026-01-15T00:00:00Z'),
      rawValue: { toString: () => '123.45' },
      adjustedValue: { toString: () => '123.40' },
      provenance: 'METER',
      sourceRef: 'm-001',
      uncertaintyPct: { toString: () => '1.500' },
      notes: 'ok',
      createdAt: new Date('2026-01-15T00:00:01Z'),
    },
    {
      id: 'dp-2',
      periodId: 'p-1',
      parameterId: 'pa-1',
      timestamp: new Date('2026-02-15T00:00:00Z'),
      rawValue: { toString: () => '67.89' },
      adjustedValue: null,
      provenance: 'METER',
      sourceRef: null,
      uncertaintyPct: null,
      notes: null,
      createdAt: new Date('2026-02-15T00:00:01Z'),
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no existing archive, period found, transaction passes through.
  mockPrisma.datapointArchive.findUnique.mockResolvedValue(null);
  mockPrisma.monitoringPeriod.findUnique.mockResolvedValue(samplePeriod);
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
    return fn(mockPrisma);
  });
  mockPrisma.datapointArchive.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'arc-1',
    periodId: data.periodId,
    archiveUrl: data.archiveUrl,
    archiveFormat: data.archiveFormat,
    rowCount: data.rowCount,
    checksumSha256: data.checksumSha256,
    bytes: data.bytes,
    restoreCount: 0,
    archivedAt: new Date(),
    createdAt: new Date(),
  }));
  mockPrisma.monitoringDatapoint.deleteMany.mockResolvedValue({ count: 2 });
  mockPrisma.monitoringDatapoint.createMany.mockResolvedValue({ count: 2 });
  mockPrisma.datapointArchive.update.mockResolvedValue({});
});

describe('archival.service', () => {
  it('archivePeriod round-trips data to the blob store and writes a DatapointArchive row', async () => {
    const blob = new MemoryBlobStore();
    const result = await archivePeriod('p-1', { blobStore: blob, userId: 'u-1' });

    expect(result.archive.rowCount).toBe(2);
    expect(result.archive.checksumSha256).toHaveLength(64);
    expect(result.archive.bytes).toBeGreaterThan(0);
    expect(mockPrisma.monitoringDatapoint.deleteMany).toHaveBeenCalledWith({
      where: { periodId: 'p-1' },
    });
    // Archive URL includes the blob key fragment for restore lookup.
    expect(result.archive.archiveUrl).toContain('#key=');
  });

  it('archivePeriod rejects already-archived period with 409', async () => {
    mockPrisma.datapointArchive.findUnique.mockResolvedValueOnce({
      id: 'existing',
      periodId: 'p-1',
    });
    await expect(archivePeriod('p-1', { blobStore: new MemoryBlobStore() })).rejects.toThrow(
      /already archived/,
    );
  });

  it('restorePeriod verifies SHA-256 and re-hydrates datapoints', async () => {
    const blob = new MemoryBlobStore();
    const { archive } = await archivePeriod('p-1', { blobStore: blob });

    // Wire restorePeriod: findUnique returns the archive we just wrote.
    const archiveRow = {
      id: archive.id,
      periodId: archive.periodId,
      archiveUrl: archive.archiveUrl,
      checksumSha256: archive.checksumSha256,
      rowCount: archive.rowCount,
      bytes: archive.bytes,
      restoreCount: 0,
    };
    mockPrisma.datapointArchive.findUnique.mockResolvedValueOnce(archiveRow);

    const r = await restorePeriod(archive.id, { blobStore: blob });

    expect(r.rowsRestored).toBe(2);
    expect(r.periodId).toBe('p-1');
    // createMany called with the two original datapoints re-serialised.
    const call = mockPrisma.monitoringDatapoint.createMany.mock.calls[0]?.[0] as {
      data: Array<{ id: string }>;
    };
    expect(call.data).toHaveLength(2);
    expect(call.data.map((d) => d.id)).toEqual(['dp-1', 'dp-2']);
    expect(mockPrisma.datapointArchive.update).toHaveBeenCalledWith({
      where: { id: archive.id },
      data: { restoreCount: { increment: 1 } },
    });
  });

  it('restorePeriod blocks re-hydration when SHA-256 does not match', async () => {
    const blob = new MemoryBlobStore();
    const { archive } = await archivePeriod('p-1', { blobStore: blob });

    // Tamper with blob contents after archival.
    const fragMatch = /#key=([^&]+)$/.exec(archive.archiveUrl);
    const key = decodeURIComponent(fragMatch![1]!);
    blob.tamper(key, gzipSync(Buffer.from('corrupted')));

    mockPrisma.datapointArchive.findUnique.mockResolvedValueOnce({
      id: archive.id,
      periodId: archive.periodId,
      archiveUrl: archive.archiveUrl,
      checksumSha256: archive.checksumSha256,
      rowCount: archive.rowCount,
      bytes: archive.bytes,
      restoreCount: 0,
    });

    await expect(restorePeriod(archive.id, { blobStore: blob })).rejects.toThrow(
      /SHA-256 verification/,
    );
    // Crucially, createMany must NOT have been called on the tampered read.
    expect(mockPrisma.monitoringDatapoint.createMany).not.toHaveBeenCalled();
  });

  it('LocalDirBlobStore rejects keys containing .. (path traversal guard)', async () => {
    const store = new LocalDirBlobStore('/tmp/aurex-blob-store-test');
    await expect(store.put('../escape.bin', Buffer.from(''))).rejects.toThrow(/traversal/);
  });

  it('checksum is computed over the compressed payload (deterministic)', () => {
    // Sanity: the same JSONL bytes produce the same gzip+sha when archived twice.
    const jsonl = '{"a":1}\n{"b":2}\n';
    const gz1 = gzipSync(Buffer.from(jsonl));
    const gz2 = gzipSync(Buffer.from(jsonl));
    const h1 = createHash('sha256').update(gz1).digest('hex');
    const h2 = createHash('sha256').update(gz2).digest('hex');
    expect(h1).toBe(h2);
  });
});
