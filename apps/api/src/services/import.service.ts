import { prisma } from '@aurex/database';
import { createEmissionSchema, type PaginatedResponse } from '@aurex/shared';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';

/**
 * AV4-255 — CSV bulk import service for emissions records.
 *
 * Synchronous hand-written CSV parser (no new dependency). Handles:
 *   - RFC-4180-lite quoted fields with "" escapes
 *   - \r\n and \n line endings
 *   - Optional trailing newline
 *
 * Expected header:
 *   scope,category,source,value,unit,periodStart,periodEnd
 * Optional 8th column: metadata (JSON string)
 *
 * Each row is validated against createEmissionSchema. Good rows are inserted
 * in a single createMany; errored rows are collected per-row with the row
 * number (1-based, excluding header) and a human-readable message.
 */

export interface ImportJobResult {
  id: string;
  orgId: string;
  createdBy: string;
  filename: string;
  status: string;
  totalRows: number;
  processedRows: number;
  successRows: number;
  errorRows: number;
  errors: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportRowError {
  row: number;
  message: string;
  raw?: Record<string, string>;
}

const REQUIRED_HEADERS = [
  'scope',
  'category',
  'source',
  'value',
  'unit',
  'periodStart',
  'periodEnd',
] as const;

/**
 * Parse a single CSV line into fields, handling quoted values with "" escapes.
 * Exported for unit tests.
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Parse a CSV buffer/string into { header, rows }. Rejects empty input and
 * validates the required header columns. Exported for tests.
 */
export function parseCsv(csv: string): { header: string[]; rows: string[][] } {
  // Strip UTF-8 BOM if present, normalise newlines.
  const cleaned = csv.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const lines = cleaned.split('\n').filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new AppError(400, 'Bad Request', 'CSV is empty');
  }

  const header = parseCsvLine(lines[0]!).map((h) => h.trim());

  for (const required of REQUIRED_HEADERS) {
    if (!header.includes(required)) {
      throw new AppError(
        400,
        'Bad Request',
        `CSV header missing required column: ${required}`,
      );
    }
  }

  const rows = lines.slice(1).map((line) => parseCsvLine(line));
  return { header, rows };
}

function toRowObject(header: string[], fields: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < header.length; i += 1) {
    obj[header[i]!] = (fields[i] ?? '').trim();
  }
  return obj;
}

export async function importEmissionsCsv(
  orgId: string,
  createdBy: string,
  filename: string,
  csvBuffer: Buffer | string,
): Promise<ImportJobResult> {
  const csv = typeof csvBuffer === 'string' ? csvBuffer : csvBuffer.toString('utf-8');

  // Create the job row up-front so a failed parse still leaves a record.
  const job = await prisma.importJob.create({
    data: {
      orgId,
      createdBy,
      filename,
      status: 'PROCESSING',
    },
  });

  let header: string[];
  let rows: string[][];
  try {
    ({ header, rows } = parseCsv(csv));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown parse error';
    const failed = await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        errors: [{ row: 0, message }] as unknown as object,
      },
    });
    logger.warn({ jobId: job.id, orgId, message }, 'CSV import parse failed');
    return failed as unknown as ImportJobResult;
  }

  const errors: ImportRowError[] = [];
  const toInsert: Array<{
    orgId: string;
    createdBy: string;
    scope: string;
    category: string;
    source: string;
    value: number;
    unit: string;
    periodStart: Date;
    periodEnd: Date;
    metadata: Record<string, unknown> | null;
  }> = [];

  rows.forEach((fields, idx) => {
    const rowNum = idx + 1; // 1-based row number excluding header
    const raw = toRowObject(header, fields);

    const valueNum = Number(raw.value);
    if (!Number.isFinite(valueNum)) {
      errors.push({ row: rowNum, message: `value is not a number: "${raw.value}"`, raw });
      return;
    }

    let metadata: Record<string, unknown> | undefined;
    if (raw.metadata && raw.metadata.length > 0) {
      try {
        const parsed = JSON.parse(raw.metadata) as unknown;
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          metadata = parsed as Record<string, unknown>;
        } else {
          errors.push({ row: rowNum, message: 'metadata must be a JSON object', raw });
          return;
        }
      } catch {
        errors.push({ row: rowNum, message: 'metadata is not valid JSON', raw });
        return;
      }
    }

    const parseResult = createEmissionSchema.safeParse({
      scope: raw.scope,
      category: raw.category,
      source: raw.source,
      value: valueNum,
      unit: raw.unit || undefined,
      periodStart: raw.periodStart,
      periodEnd: raw.periodEnd,
      metadata,
    });

    if (!parseResult.success) {
      const message = parseResult.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      errors.push({ row: rowNum, message, raw });
      return;
    }

    const data = parseResult.data;
    const periodStart = new Date(data.periodStart);
    const periodEnd = new Date(data.periodEnd);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      errors.push({ row: rowNum, message: 'periodStart/periodEnd must be parseable dates', raw });
      return;
    }

    toInsert.push({
      orgId,
      createdBy,
      scope: data.scope,
      category: data.category,
      source: data.source,
      value: data.value,
      unit: data.unit,
      periodStart,
      periodEnd,
      metadata: metadata ?? null,
    });
  });

  let inserted = 0;
  if (toInsert.length > 0) {
    // createMany is fast but doesn't run per-row defaults — that's fine here,
    // we've already normalised every row.
    const result = await prisma.emissionsRecord.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: toInsert as any,
      skipDuplicates: false,
    });
    inserted = result.count;
  }

  const finalStatus = errors.length === 0 ? 'COMPLETED' : inserted > 0 ? 'COMPLETED' : 'FAILED';

  const updated = await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: finalStatus,
      totalRows: rows.length,
      processedRows: rows.length,
      successRows: inserted,
      errorRows: errors.length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errors: (errors.length > 0 ? errors : null) as any,
    },
  });

  logger.info(
    { jobId: job.id, orgId, total: rows.length, ok: inserted, errs: errors.length },
    'CSV import complete',
  );
  return updated as unknown as ImportJobResult;
}

export async function getImportJob(id: string, orgId: string): Promise<ImportJobResult> {
  const job = await prisma.importJob.findFirst({ where: { id, orgId } });
  if (!job) {
    throw new AppError(404, 'Not Found', 'Import job not found');
  }
  return job as unknown as ImportJobResult;
}

export async function listImportJobs(
  orgId: string,
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<ImportJobResult>> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const skip = (safePage - 1) * safePageSize;

  const [jobs, total] = await Promise.all([
    prisma.importJob.findMany({
      where: { orgId },
      skip,
      take: safePageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.importJob.count({ where: { orgId } }),
  ]);

  return {
    data: jobs as unknown as ImportJobResult[],
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.ceil(total / safePageSize),
    },
  };
}
