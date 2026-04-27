/**
 * AAT-DEEPRESEARCH — tests for the Gemini Deep Research adapter.
 *
 * Mocks `global.fetch` so the suite never touches the network. Coverage:
 *   - Constructor + lazy-key resolution
 *   - Mock mode returns deterministic stub
 *   - HTTP error mapping (401/403 → Auth, 429 → RateLimit, 5xx → Server)
 *   - JSON-in-markdown response is unwrapped + parsed
 *   - Citations extracted from `groundingMetadata` fallback
 *   - ping() probe semantics
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalFetch = global.fetch;
const fetchMock = vi.fn();

beforeEach(() => {
   
  global.fetch = fetchMock as any;
  fetchMock.mockReset();
});

afterEach(() => {
  global.fetch = originalFetch;
});

import {
  GeminiAuthError,
  GeminiBadResponseError,
  GeminiDeepResearchProvider,
  GeminiKeyMissingError,
  GeminiNetworkError,
  GeminiRateLimitError,
  GeminiServerError,
} from './gemini-deep-research.js';

const SAVED_ENV: Record<string, string | undefined> = {};
const TRACKED_KEYS = [
  'NODE_ENV',
  'GOOGLE_AI_API_KEY',
  'GEMINI_API_KEY',
  'GEMINI_MOCK_MODE',
  'GEMINI_DEEP_RESEARCH_MODEL',
  'GEMINI_QUICK_MODEL',
  'GEMINI_STANDARD_MODEL',
] as const;

beforeEach(() => {
  for (const k of TRACKED_KEYS) SAVED_ENV[k] = process.env[k];
});

afterEach(() => {
  for (const k of TRACKED_KEYS) {
    if (SAVED_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED_ENV[k];
  }
});

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () =>
      typeof body === 'string' ? body : JSON.stringify(body),
     
  } as any;
}

function buildGeminiResponse(textBody: string): unknown {
  return {
    candidates: [
      {
        content: { parts: [{ text: textBody }] },
      },
    ],
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 200,
    },
  };
}

function buildFinding(): {
  summary: string;
  keyPoints: string[];
  citations: { title: string; url: string; publishedAt?: string }[];
} {
  return {
    summary: 'Test summary about UNFCCC SB.',
    keyPoints: ['Point 1', 'Point 2'],
    citations: [
      {
        title: 'UNFCCC SB-60 update',
        url: 'https://unfccc.int/sb-60',
        publishedAt: '2026-03-01T00:00:00Z',
      },
    ],
  };
}

// ─── Constructor / key resolution ──────────────────────────────────────

describe('GeminiDeepResearchProvider — constructor + key resolution', () => {
  it('throws GeminiKeyMissingError on first call when key is unset in non-test env', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MOCK_MODE;

    const provider = new GeminiDeepResearchProvider();
    // Constructor must NOT throw (lazy resolution).
    expect(provider).toBeDefined();

    // First research() call materialises the key — throws.
    await expect(
      provider.research({ topic: 'anything' }),
    ).rejects.toBeInstanceOf(GeminiKeyMissingError);
  });

  it('accepts the fixture key when NODE_ENV=test (mock mode auto-engages)', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MOCK_MODE;

    const provider = new GeminiDeepResearchProvider();
    expect(provider).toBeDefined();
  });

  it('reads GOOGLE_AI_API_KEY in preference to GEMINI_API_KEY', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GOOGLE_AI_API_KEY = 'preferred-key';
    process.env.GEMINI_API_KEY = 'fallback-key';
    delete process.env.GEMINI_MOCK_MODE;

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, buildGeminiResponse(JSON.stringify(buildFinding()))),
    );
    const provider = new GeminiDeepResearchProvider();
    await provider.research({ topic: 'BCR procedure changes' });
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('key=preferred-key');
  });

  it('falls back to GEMINI_API_KEY when GOOGLE_AI_API_KEY is unset', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GOOGLE_AI_API_KEY;
    process.env.GEMINI_API_KEY = 'fallback-key';

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, buildGeminiResponse(JSON.stringify(buildFinding()))),
    );
    const provider = new GeminiDeepResearchProvider();
    await provider.research({ topic: 'test' });
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('key=fallback-key');
  });
});

// ─── Mock mode ─────────────────────────────────────────────────────────

describe('GeminiDeepResearchProvider — mock mode', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('returns a deterministic stub without calling fetch', async () => {
    const provider = new GeminiDeepResearchProvider();
    const finding = await provider.research({
      topic: 'Verra methodology release',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(finding.summary).toContain('Verra methodology release');
    expect(finding.keyPoints).toHaveLength(3);
    expect(finding.citations).toHaveLength(2);
    expect(finding.meta.provider).toBe('gemini-deep-research');
  });

  it('ping() returns ok=true in mock mode without HTTP', async () => {
    const provider = new GeminiDeepResearchProvider();
    const result = await provider.ping();
    expect(result.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── Live mode HTTP error mapping ──────────────────────────────────────

describe('GeminiDeepResearchProvider — error mapping', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.GOOGLE_AI_API_KEY = 'live-test-key';
    delete process.env.GEMINI_MOCK_MODE;
  });

  it('maps HTTP 401 to GeminiAuthError', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { error: { message: 'Invalid key' } }),
    );
    const provider = new GeminiDeepResearchProvider();
    await expect(
      provider.research({ topic: 'test' }),
    ).rejects.toBeInstanceOf(GeminiAuthError);
  });

  it('maps HTTP 403 to GeminiAuthError', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { error: { message: 'PermissionDenied' } }),
    );
    const provider = new GeminiDeepResearchProvider();
    const err = await provider
      .research({ topic: 'test' })
      .catch((e) => e);
    expect(err).toBeInstanceOf(GeminiAuthError);
    expect((err as GeminiAuthError).httpStatus).toBe(403);
  });

  it('maps HTTP 429 to GeminiRateLimitError', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, { error: { message: 'Quota exhausted' } }),
    );
    const provider = new GeminiDeepResearchProvider();
    await expect(
      provider.research({ topic: 'test' }),
    ).rejects.toBeInstanceOf(GeminiRateLimitError);
  });

  it('maps HTTP 503 to GeminiServerError', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(503, { error: { message: 'overloaded' } }),
    );
    const provider = new GeminiDeepResearchProvider();
    const err = await provider
      .research({ topic: 'test' })
      .catch((e) => e);
    expect(err).toBeInstanceOf(GeminiServerError);
    expect((err as GeminiServerError).httpStatus).toBe(503);
  });

  it('maps network failure to GeminiNetworkError', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ENOTFOUND'));
    const provider = new GeminiDeepResearchProvider();
    const err = await provider
      .research({ topic: 'test' })
      .catch((e) => e);
    expect(err).toBeInstanceOf(GeminiNetworkError);
    expect((err as Error).message).toMatch(/ENOTFOUND/);
  });

  it('maps non-JSON response to GeminiBadResponseError', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Unexpected token');
      },
      text: async () => 'not json',
       
    } as any);
    const provider = new GeminiDeepResearchProvider();
    await expect(
      provider.research({ topic: 'test' }),
    ).rejects.toBeInstanceOf(GeminiBadResponseError);
  });
});

// ─── JSON-in-markdown response parsing ─────────────────────────────────

describe('GeminiDeepResearchProvider — JSON output parsing', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.GOOGLE_AI_API_KEY = 'live-test-key';
    delete process.env.GEMINI_MOCK_MODE;
  });

  it('parses plain JSON output', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, buildGeminiResponse(JSON.stringify(buildFinding()))),
    );
    const provider = new GeminiDeepResearchProvider();
    const finding = await provider.research({ topic: 'test' });

    expect(finding.summary).toBe('Test summary about UNFCCC SB.');
    expect(finding.keyPoints).toEqual(['Point 1', 'Point 2']);
    expect(finding.citations).toHaveLength(1);
    expect(finding.citations[0]!.url).toBe('https://unfccc.int/sb-60');
    expect(finding.meta.tokensInput).toBe(100);
    expect(finding.meta.tokensOutput).toBe(200);
  });

  it('strips ```json fenced markdown wrapper around JSON output', async () => {
    const wrapped = '```json\n' + JSON.stringify(buildFinding()) + '\n```';
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, buildGeminiResponse(wrapped)),
    );
    const provider = new GeminiDeepResearchProvider();
    const finding = await provider.research({ topic: 'test' });
    expect(finding.summary).toBe('Test summary about UNFCCC SB.');
    expect(finding.citations).toHaveLength(1);
  });

  it('strips bare ``` fenced markdown wrapper around JSON output', async () => {
    const wrapped = '```\n' + JSON.stringify(buildFinding()) + '\n```';
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, buildGeminiResponse(wrapped)),
    );
    const provider = new GeminiDeepResearchProvider();
    const finding = await provider.research({ topic: 'test' });
    expect(finding.summary).toBe('Test summary about UNFCCC SB.');
  });

  it('throws GeminiBadResponseError when JSON is missing summary field', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        200,
        buildGeminiResponse(JSON.stringify({ keyPoints: ['x'] })),
      ),
    );
    const provider = new GeminiDeepResearchProvider();
    await expect(
      provider.research({ topic: 'test' }),
    ).rejects.toBeInstanceOf(GeminiBadResponseError);
  });

  it('falls back to groundingMetadata for citations when JSON omits them', async () => {
    const findingMissingCitations = {
      summary: 'Test summary.',
      keyPoints: ['Point 1'],
      citations: [],
    };
    const responseBody = {
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(findingMissingCitations) }],
          },
          groundingMetadata: {
            groundingChunks: [
              {
                web: {
                  uri: 'https://verra.org/grounded-source',
                  title: 'Grounded Verra source',
                },
              },
              {
                web: {
                  uri: 'https://goldstandard.org/grounded',
                  title: 'Gold Standard',
                },
              },
            ],
          },
        },
      ],
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, responseBody));

    const provider = new GeminiDeepResearchProvider();
    const finding = await provider.research({ topic: 'test' });
    expect(finding.citations).toHaveLength(2);
    expect(finding.citations[0]!.url).toBe('https://verra.org/grounded-source');
    expect(finding.citations[0]!.title).toBe('Grounded Verra source');
  });
});

// ─── Depth → model mapping ─────────────────────────────────────────────

describe('GeminiDeepResearchProvider — depth → model mapping', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.GOOGLE_AI_API_KEY = 'live-test-key';
    delete process.env.GEMINI_MOCK_MODE;
    delete process.env.GEMINI_QUICK_MODEL;
    delete process.env.GEMINI_STANDARD_MODEL;
    delete process.env.GEMINI_DEEP_RESEARCH_MODEL;
  });

  it('uses gemini-2.5-flash for depth=quick', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, buildGeminiResponse(JSON.stringify(buildFinding()))),
    );
    const provider = new GeminiDeepResearchProvider();
    await provider.research({ topic: 't', depth: 'quick' });
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('gemini-2.5-flash');
  });

  it('uses gemini-2.5-pro for depth=standard (default)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, buildGeminiResponse(JSON.stringify(buildFinding()))),
    );
    const provider = new GeminiDeepResearchProvider();
    await provider.research({ topic: 't' });
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('gemini-2.5-pro');
    expect(String(url)).not.toContain('deep-research');
  });

  it('uses gemini-2.5-pro-deep-research for depth=deep', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, buildGeminiResponse(JSON.stringify(buildFinding()))),
    );
    const provider = new GeminiDeepResearchProvider();
    await provider.research({ topic: 't', depth: 'deep' });
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('gemini-2.5-pro-deep-research');
  });

  it('honours GEMINI_DEEP_RESEARCH_MODEL override (fallback path)', async () => {
    process.env.GEMINI_DEEP_RESEARCH_MODEL = 'gemini-2.5-pro';
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, buildGeminiResponse(JSON.stringify(buildFinding()))),
    );
    const provider = new GeminiDeepResearchProvider();
    await provider.research({ topic: 't', depth: 'deep' });
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('gemini-2.5-pro');
    expect(String(url)).not.toContain('deep-research');
  });
});

// ─── ping() ────────────────────────────────────────────────────────────

describe('GeminiDeepResearchProvider — ping (live mode)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.GOOGLE_AI_API_KEY = 'live-test-key';
    delete process.env.GEMINI_MOCK_MODE;
  });

  it('returns ok=true on HTTP 200 from /models listing', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { models: [{ name: 'models/gemini-2.5-pro' }] }),
    );
    const provider = new GeminiDeepResearchProvider();
    const result = await provider.ping();
    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/v1beta/models?key=');
    expect(init.method).toBe('GET');
  });

  it('returns ok=false with reason on 403', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { error: { message: 'PermissionDenied' } }),
    );
    const provider = new GeminiDeepResearchProvider();
    const result = await provider.ping();
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/HTTP 403/);
  });

  it('returns ok=false on network failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ENOTFOUND'));
    const provider = new GeminiDeepResearchProvider();
    const result = await provider.ping();
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/ENOTFOUND/);
  });
});

// ─── Request body shape ────────────────────────────────────────────────

describe('GeminiDeepResearchProvider — request body shape', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.GOOGLE_AI_API_KEY = 'live-test-key';
    delete process.env.GEMINI_MOCK_MODE;
  });

  it('attaches google_search tool and a JSON-mime generation config', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, buildGeminiResponse(JSON.stringify(buildFinding()))),
    );
    const provider = new GeminiDeepResearchProvider();
    await provider.research({
      topic: 'BCR procedure',
      scope: '2026 H1',
      maxSources: 5,
      citationsRequired: true,
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init.body as string);
    expect(body.tools).toEqual([{ google_search: {} }]);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.systemInstruction.parts[0].text).toContain(
      'regulatory analyst',
    );
    expect(body.contents[0].role).toBe('user');
    const userText = body.contents[0].parts[0].text as string;
    expect(userText).toContain('BCR procedure');
    expect(userText).toContain('2026 H1');
    expect(userText).toContain('at most 5 citations');
    expect(userText).toContain('Citations are REQUIRED');
  });
});
