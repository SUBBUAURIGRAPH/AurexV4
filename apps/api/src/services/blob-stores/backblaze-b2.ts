import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import type { BlobStore, BlobPutResult } from '../archival.service.js';
import { logger } from '../../lib/logger.js';

/**
 * AV4-338 — BackblazeB2BlobStore.
 *
 * Backblaze B2 is S3-compatible, so we use the AWS SDK v3 client. Region must
 * match the B2 bucket region (e.g. `us-west-000`). Endpoint is the B2
 * S3-compatible URL (e.g. `https://s3.us-west-000.backblazeb2.com`).
 *
 * Required env vars (all must be set or the constructor throws):
 *   BACKBLAZE_B2_ENDPOINT
 *   BACKBLAZE_B2_REGION
 *   BACKBLAZE_B2_BUCKET
 *   BACKBLAZE_B2_KEY_ID
 *   BACKBLAZE_B2_APP_KEY
 *
 * `put` / `get` / `exists` mirror the `BlobStore` contract. URLs returned by
 * `put` use the `b2://<bucket>/<key>` scheme — this is **not** a direct
 * download URL, it's the canonical identifier stored in `DatapointArchive`.
 * Restore uses the blob key (also stored in the URL fragment) to fetch the
 * object via the S3 client — access is always through the scoped application
 * key, never public.
 */
export class BackblazeB2BlobStore implements BlobStore {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(cfg?: Partial<BackblazeB2Config>) {
    const resolved = resolveConfig(cfg);
    this.bucket = resolved.bucket;

    const s3Config: S3ClientConfig = {
      endpoint: resolved.endpoint,
      region: resolved.region,
      credentials: {
        accessKeyId: resolved.keyId,
        secretAccessKey: resolved.appKey,
      },
      // B2 recommends path-style addressing for the S3-compatible API.
      forcePathStyle: true,
    };
    this.client = new S3Client(s3Config);
  }

  async put(key: string, bytes: Buffer): Promise<BlobPutResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: 'application/gzip',
      }),
    );
    logger.info({ bucket: this.bucket, key, bytes: bytes.length }, 'B2 put');
    return { url: `b2://${this.bucket}/${key}`, bytes: bytes.length };
  }

  async get(key: string): Promise<Buffer> {
    const resp = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const body = resp.Body;
    if (!body) {
      throw new Error(`B2 get: empty body for key ${key}`);
    }
    // AWS SDK v3 exposes `transformToByteArray` on the Body stream.
    // Fallback to a manual stream drain for older Node stream shapes.
    if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === 'function') {
      const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
      return Buffer.from(bytes);
    }
    return await streamToBuffer(body as NodeJS.ReadableStream);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch (err: unknown) {
      // AWS SDK v3 surfaces 404 as `NotFound` name on the error.
      const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (
        e?.name === 'NotFound' ||
        e?.name === 'NoSuchKey' ||
        e?.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw err;
    }
  }
}

// ─── Config ─────────────────────────────────────────────────────────────

export interface BackblazeB2Config {
  endpoint: string;
  region: string;
  bucket: string;
  keyId: string;
  appKey: string;
}

const REQUIRED_ENV = [
  'BACKBLAZE_B2_ENDPOINT',
  'BACKBLAZE_B2_REGION',
  'BACKBLAZE_B2_BUCKET',
  'BACKBLAZE_B2_KEY_ID',
  'BACKBLAZE_B2_APP_KEY',
] as const;

function resolveConfig(override?: Partial<BackblazeB2Config>): BackblazeB2Config {
  const fromEnv: Partial<BackblazeB2Config> = {
    endpoint: process.env.BACKBLAZE_B2_ENDPOINT,
    region: process.env.BACKBLAZE_B2_REGION,
    bucket: process.env.BACKBLAZE_B2_BUCKET,
    keyId: process.env.BACKBLAZE_B2_KEY_ID,
    appKey: process.env.BACKBLAZE_B2_APP_KEY,
  };
  const merged: Partial<BackblazeB2Config> = { ...fromEnv, ...override };
  const missing = REQUIRED_ENV.filter((k) => {
    const mapKey = envKeyToConfig(k);
    return !merged[mapKey];
  });
  if (missing.length > 0) {
    throw new Error(
      `BackblazeB2BlobStore: missing required env vars: ${missing.join(', ')}. See docs/A6_4_RETENTION_POLICY.md §4.`,
    );
  }
  return merged as BackblazeB2Config;
}

function envKeyToConfig(k: (typeof REQUIRED_ENV)[number]): keyof BackblazeB2Config {
  switch (k) {
    case 'BACKBLAZE_B2_ENDPOINT':
      return 'endpoint';
    case 'BACKBLAZE_B2_REGION':
      return 'region';
    case 'BACKBLAZE_B2_BUCKET':
      return 'bucket';
    case 'BACKBLAZE_B2_KEY_ID':
      return 'keyId';
    case 'BACKBLAZE_B2_APP_KEY':
      return 'appKey';
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}
