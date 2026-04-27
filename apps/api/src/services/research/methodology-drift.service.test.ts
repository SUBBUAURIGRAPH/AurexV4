/**
 * AAT-R5 / AV4-425 — methodology-drift.service tests.
 */
import { describe, expect, it, vi } from 'vitest';

const { mockRunResearch } = vi.hoisted(() => ({ mockRunResearch: vi.fn() }));

vi.mock('./research.service.js', () => ({
  runResearch: mockRunResearch,
}));

import {
  buildMethodologyDriftPrompt,
  scanMethodologyDrift,
} from './methodology-drift.service.js';

// ── buildMethodologyDriftPrompt ──────────────────────────────────────────

describe('buildMethodologyDriftPrompt', () => {
  it('includes the registry label in topic + scope', () => {
    const { topic, scope } = buildMethodologyDriftPrompt('verra');
    expect(topic).toContain('Verra');
    expect(scope).toContain('Verra');
  });

  it('covers gold-standard registry', () => {
    const { topic, scope } = buildMethodologyDriftPrompt('gold-standard');
    expect(topic).toContain('Gold Standard');
    expect(scope).toContain('Gold Standard');
  });

  it('mentions 90-day window in scope', () => {
    const { scope } = buildMethodologyDriftPrompt('verra');
    expect(scope).toContain('90 days');
  });
});

// ── scanMethodologyDrift ─────────────────────────────────────────────────

const FAKE_FINDING = {
  summary: 'No significant methodology updates in the last 90 days.',
  findings: [],
  citationCount: 0,
  rawText: '',
};

describe('scanMethodologyDrift', () => {
  it('returns a MethodologyDriftReport with the registry + finding', async () => {
    mockRunResearch.mockResolvedValue({ finding: FAKE_FINDING, runId: 'run-1' });
    const report = await scanMethodologyDrift('verra');
    expect(report.registry).toBe('verra');
    expect(report.runId).toBe('run-1');
    expect(report.finding).toBe(FAKE_FINDING);
    expect(report.scannedAt).toBeTruthy();
  });

  it('passes triggeredBy option to runResearch', async () => {
    mockRunResearch.mockResolvedValue({ finding: FAKE_FINDING, runId: 'run-2' });
    await scanMethodologyDrift('gold-standard', { triggeredBy: 'test-cron' });
    expect(mockRunResearch).toHaveBeenCalledWith(
      expect.objectContaining({ depth: 'deep', citationsRequired: true }),
      expect.objectContaining({ triggeredBy: 'test-cron' }),
    );
  });

  it('uses default triggeredBy when not supplied', async () => {
    mockRunResearch.mockResolvedValue({ finding: FAKE_FINDING, runId: 'run-3' });
    await scanMethodologyDrift('verra');
    expect(mockRunResearch).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ triggeredBy: 'methodology-drift-watcher' }),
    );
  });
});
