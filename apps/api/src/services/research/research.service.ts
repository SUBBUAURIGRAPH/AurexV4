/**
 * AAT-DEEPRESEARCH — research service.
 *
 * Thin orchestration layer between the routes (`admin-research.ts`,
 * `health.ts`) and the provider abstraction (`provider.ts`).
 *
 * Responsibilities:
 *   1. Provider factory — returns the Gemini Deep Research adapter by
 *      default; the singleton can be replaced in tests via
 *      `_setProviderForTests()`.
 *   2. Persistence — every `runResearch()` call writes a
 *      `RegulatoryResearchRun` audit row (PENDING up-front so a process
 *      crash mid-call still leaves a forensic breadcrumb, then flipped
 *      to SUCCESS or FAILED on completion). Best-effort: a DB write
 *      failure must not bubble back to the caller.
 *   3. Read paths — `listRecentRuns()` powers the admin index and the
 *      health endpoint's "last 24h" rollup.
 */

import {
  prisma,
  type RegulatoryResearchRun,
  type RegulatoryResearchRunStatus,
} from '@aurex/database';
import { logger } from '../../lib/logger.js';
import {
  GeminiDeepResearchProvider,
} from './gemini-deep-research.js';
import type {
  ResearchFinding,
  ResearchProvider,
  ResearchQuery,
} from './provider.js';

// ─── Factory ───────────────────────────────────────────────────────────

let cachedProvider: ResearchProvider | null = null;

export function getProvider(): ResearchProvider {
  if (cachedProvider) return cachedProvider;
  cachedProvider = new GeminiDeepResearchProvider();
  return cachedProvider;
}

/**
 * Test-only — swap the active provider with a stub. Used by the route
 * + service tests to inject deterministic findings without touching
 * Gemini.
 */
export function _setProviderForTests(provider: ResearchProvider | null): void {
  cachedProvider = provider;
}

// ─── runResearch ───────────────────────────────────────────────────────

export interface RunResearchOptions {
  /** Free-text actor identifier — 'admin' (route), 'cron', 'workflow'. */
  triggeredBy?: string;
}

export interface RunResearchResult {
  finding: ResearchFinding;
  runId: string;
}

async function persistInitialRow(
  query: ResearchQuery,
  provider: ResearchProvider,
  model: string,
  triggeredBy: string | null,
): Promise<string | null> {
  try {
    const row = await prisma.regulatoryResearchRun.create({
      data: {
        topic: query.topic,
        scope: query.scope ?? null,
        depth: query.depth ?? 'standard',
        provider: provider.providerName,
        model,
        status: 'PENDING' as RegulatoryResearchRunStatus,
        triggeredBy: triggeredBy,
      },
      select: { id: true },
    });
    return row.id;
  } catch (err) {
    logger.warn(
      { err, topic: query.topic },
      'RegulatoryResearchRun audit row create failed',
    );
    return null;
  }
}

async function markRowSuccess(
  recordId: string | null,
  finding: ResearchFinding,
): Promise<void> {
  if (!recordId) return;
  try {
    await prisma.regulatoryResearchRun.update({
      where: { id: recordId },
      data: {
        status: 'SUCCESS' as RegulatoryResearchRunStatus,
        durationMs: finding.meta.durationMs,
        tokensInput: finding.meta.tokensInput ?? null,
        tokensOutput: finding.meta.tokensOutput ?? null,
        summary: finding.summary,
        keyPoints: finding.keyPoints,
        citations: finding.citations as unknown as object,
      },
    });
  } catch (err) {
    logger.warn(
      { err, recordId },
      'RegulatoryResearchRun mark-success failed (non-fatal)',
    );
  }
}

async function markRowFailed(
  recordId: string | null,
  errorMessage: string,
): Promise<void> {
  if (!recordId) return;
  try {
    await prisma.regulatoryResearchRun.update({
      where: { id: recordId },
      data: {
        status: 'FAILED' as RegulatoryResearchRunStatus,
        errorMessage: errorMessage.slice(0, 4000),
      },
    });
  } catch (err) {
    logger.warn(
      { err, recordId },
      'RegulatoryResearchRun mark-failed failed (non-fatal)',
    );
  }
}

/**
 * Map depth → model for audit purposes BEFORE the call. Mirrors the
 * adapter's resolution but doesn't import the adapter's private helper
 * — both paths read the same env vars.
 */
function modelForAuditRow(depth: ResearchQuery['depth']): string {
  switch (depth) {
    case 'quick':
      return process.env.GEMINI_QUICK_MODEL ?? 'gemini-2.5-flash';
    case 'deep':
      return (
        process.env.GEMINI_DEEP_RESEARCH_MODEL ?? 'gemini-2.5-pro-deep-research'
      );
    case 'standard':
    default:
      return process.env.GEMINI_STANDARD_MODEL ?? 'gemini-2.5-pro';
  }
}

/**
 * Run a research query through the active provider, persist the audit
 * row, and return the finding + the audit row's id.
 *
 * Failures are RAISED (the caller — typically a route handler — maps
 * them to RFC 7807). The audit row is still written in the FAILED
 * state so ops always has a forensic breadcrumb.
 */
export async function runResearch(
  query: ResearchQuery,
  opts: RunResearchOptions = {},
): Promise<RunResearchResult> {
  const provider = getProvider();
  const triggeredBy = opts.triggeredBy ?? null;
  const auditModel = modelForAuditRow(query.depth);
  const recordId = await persistInitialRow(
    query,
    provider,
    auditModel,
    triggeredBy,
  );

  try {
    const finding = await provider.research(query);
    await markRowSuccess(recordId, finding);
    return { finding, runId: recordId ?? '' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markRowFailed(recordId, message);
    throw err;
  }
}

// ─── listRecentRuns ────────────────────────────────────────────────────

export interface ListRecentRunsOptions {
  status?: RegulatoryResearchRunStatus;
  topic?: string;
  since?: Date;
  limit?: number;
  offset?: number;
}

export interface ListRecentRunsResult {
  rows: RegulatoryResearchRun[];
  total: number;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function listRecentRuns(
  opts: ListRecentRunsOptions = {},
): Promise<ListRecentRunsResult> {
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(opts.offset ?? 0, 0);

  const where: {
    status?: RegulatoryResearchRunStatus;
    topic?: { contains: string; mode: 'insensitive' };
    createdAt?: { gte: Date };
  } = {};
  if (opts.status) where.status = opts.status;
  if (opts.topic && opts.topic.trim().length > 0) {
    where.topic = { contains: opts.topic.trim(), mode: 'insensitive' };
  }
  if (opts.since) where.createdAt = { gte: opts.since };

  const [rows, total] = await Promise.all([
    prisma.regulatoryResearchRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.regulatoryResearchRun.count({ where }),
  ]);

  return { rows, total };
}

export async function getRunById(
  id: string,
): Promise<RegulatoryResearchRun | null> {
  return prisma.regulatoryResearchRun.findUnique({ where: { id } });
}

// ─── 24h rollup (used by /health/research) ────────────────────────────

export interface ResearchRunsRollup {
  success: number;
  failed: number;
}

export async function loadRunsLast24h(): Promise<ResearchRunsRollup> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const [success, failed] = await Promise.all([
      prisma.regulatoryResearchRun.count({
        where: {
          status: 'SUCCESS' as RegulatoryResearchRunStatus,
          createdAt: { gte: since },
        },
      }),
      prisma.regulatoryResearchRun.count({
        where: {
          status: 'FAILED' as RegulatoryResearchRunStatus,
          createdAt: { gte: since },
        },
      }),
    ]);
    return { success, failed };
  } catch (err) {
    logger.warn({ err }, 'RegulatoryResearchRun 24h rollup failed');
    return { success: 0, failed: 0 };
  }
}

export interface LastRunSummary {
  lastRunOk: string | null;
  lastRunFailed: string | null;
}

export async function loadLastRunSummary(): Promise<LastRunSummary> {
  try {
    const [lastOk, lastFailed] = await Promise.all([
      prisma.regulatoryResearchRun.findFirst({
        where: { status: 'SUCCESS' as RegulatoryResearchRunStatus },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      prisma.regulatoryResearchRun.findFirst({
        where: { status: 'FAILED' as RegulatoryResearchRunStatus },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);
    return {
      lastRunOk: lastOk?.createdAt?.toISOString() ?? null,
      lastRunFailed: lastFailed?.createdAt?.toISOString() ?? null,
    };
  } catch (err) {
    logger.warn({ err }, 'RegulatoryResearchRun last-run summary failed');
    return { lastRunOk: null, lastRunFailed: null };
  }
}
