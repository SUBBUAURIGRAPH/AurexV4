import { describe, expect, it } from 'vitest';
import { buildKv2DataUrlPath } from './openbao-kv.js';

describe('openbao KV v2 path', () => {
  it('builds Vault KV v2 data paths (slash-separated logical path)', () => {
    expect(buildKv2DataUrlPath('secret', 'aurex/api')).toBe(
      '/v1/secret/data/aurex/api'
    );
    expect(buildKv2DataUrlPath('secret', 'single')).toBe('/v1/secret/data/single');
  });
});
