import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Unit tests for BackblazeB2BlobStore (AV4-338).
 *
 * The AWS SDK `S3Client` is mocked so tests don't hit network. We assert:
 *   - constructor throws when any required BACKBLAZE_B2_* env var is missing
 *   - `put` → `get` round-trip passes bytes through correctly
 *   - `exists` returns false on 404 / NotFound, true on 200
 */

const sendMock = vi.fn();

vi.mock('@aws-sdk/client-s3', () => {
  class S3Client {
    constructor(public cfg: unknown) {}
    send(cmd: unknown) {
      return sendMock(cmd);
    }
  }
  class PutObjectCommand {
    constructor(public input: unknown) {}
  }
  class GetObjectCommand {
    constructor(public input: unknown) {}
  }
  class HeadObjectCommand {
    constructor(public input: unknown) {}
  }
  return { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand };
});

const ENV_KEYS = [
  'BACKBLAZE_B2_ENDPOINT',
  'BACKBLAZE_B2_REGION',
  'BACKBLAZE_B2_BUCKET',
  'BACKBLAZE_B2_KEY_ID',
  'BACKBLAZE_B2_APP_KEY',
] as const;

const GOOD_ENV: Record<(typeof ENV_KEYS)[number], string> = {
  BACKBLAZE_B2_ENDPOINT: 'https://s3.us-west-000.backblazeb2.com',
  BACKBLAZE_B2_REGION: 'us-west-000',
  BACKBLAZE_B2_BUCKET: 'aurex-test-archive',
  BACKBLAZE_B2_KEY_ID: 'test-key-id',
  BACKBLAZE_B2_APP_KEY: 'test-app-key',
};

let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    process.env[k] = GOOD_ENV[k];
  }
  sendMock.mockReset();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe('BackblazeB2BlobStore', () => {
  it('throws at construction when required env vars are missing', async () => {
    delete process.env.BACKBLAZE_B2_BUCKET;
    delete process.env.BACKBLAZE_B2_APP_KEY;
    const { BackblazeB2BlobStore } = await import('./backblaze-b2.js');
    expect(() => new BackblazeB2BlobStore()).toThrow(/BACKBLAZE_B2_BUCKET/);
  });

  it('put returns b2:// URL and forwards bytes to S3Client', async () => {
    const { BackblazeB2BlobStore } = await import('./backblaze-b2.js');
    sendMock.mockResolvedValueOnce({}); // PutObject response
    const store = new BackblazeB2BlobStore();
    const bytes = Buffer.from('hello-b2');
    const res = await store.put('archives/test.bin', bytes);
    expect(res).toEqual({ url: 'b2://aurex-test-archive/archives/test.bin', bytes: 8 });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const cmd = sendMock.mock.calls[0]?.[0] as { input: { Bucket: string; Key: string; Body: Buffer } };
    expect(cmd.input.Bucket).toBe('aurex-test-archive');
    expect(cmd.input.Key).toBe('archives/test.bin');
    expect(cmd.input.Body).toEqual(bytes);
  });

  it('put → get round-trips bytes through the mocked S3 client', async () => {
    const { BackblazeB2BlobStore } = await import('./backblaze-b2.js');
    const payload = Buffer.from('round-trip-payload');
    // put
    sendMock.mockResolvedValueOnce({});
    // get — return a Body with `transformToByteArray`
    sendMock.mockResolvedValueOnce({
      Body: {
        transformToByteArray: async () => new Uint8Array(payload),
      },
    });
    const store = new BackblazeB2BlobStore();
    await store.put('archives/rt.bin', payload);
    const out = await store.get('archives/rt.bin');
    expect(out.equals(payload)).toBe(true);
  });

  it('exists returns false when HEAD responds NotFound', async () => {
    const { BackblazeB2BlobStore } = await import('./backblaze-b2.js');
    const notFound: Error & { name: string; $metadata: { httpStatusCode: number } } = Object.assign(
      new Error('not found'),
      { name: 'NotFound', $metadata: { httpStatusCode: 404 } },
    );
    sendMock.mockRejectedValueOnce(notFound);
    const store = new BackblazeB2BlobStore();
    const ok = await store.exists('archives/missing.bin');
    expect(ok).toBe(false);
  });

  it('exists returns true when HEAD succeeds', async () => {
    const { BackblazeB2BlobStore } = await import('./backblaze-b2.js');
    sendMock.mockResolvedValueOnce({});
    const store = new BackblazeB2BlobStore();
    const ok = await store.exists('archives/present.bin');
    expect(ok).toBe(true);
  });

  it('exists re-throws non-404 errors', async () => {
    const { BackblazeB2BlobStore } = await import('./backblaze-b2.js');
    sendMock.mockRejectedValueOnce(
      Object.assign(new Error('boom'), {
        name: 'InternalError',
        $metadata: { httpStatusCode: 500 },
      }),
    );
    const store = new BackblazeB2BlobStore();
    await expect(store.exists('archives/any.bin')).rejects.toThrow(/boom/);
  });
});
