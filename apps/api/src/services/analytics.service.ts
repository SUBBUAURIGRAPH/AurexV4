import { prisma } from '@aurex/database';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

export interface SummaryResult {
  total: number;
  scope1: number;
  scope2: number;
  scope3: number;
  changePercent: number | null;
}

export interface TrendPoint {
  month: string;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

export interface BreakdownItem {
  scope: string;
  value: number;
  percentage: number;
}

export interface TopSourceItem {
  source: string;
  category: string;
  value: number;
}

export interface CategoryItem {
  category: string;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

export interface YoYPoint {
  month: string;
  currentYear: number;
  previousYear: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildDateFilter(dateFrom?: string, dateTo?: string) {
  const filter: Record<string, Date> = {};
  if (dateFrom) filter.gte = new Date(dateFrom);
  if (dateTo) filter.lte = new Date(dateTo);
  return Object.keys(filter).length > 0 ? filter : undefined;
}

function toNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return Number(val);
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export async function getSummary(
  orgId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<SummaryResult> {
  const periodFilter = buildDateFilter(dateFrom, dateTo);

  const where = {
    orgId,
    status: 'VERIFIED' as const,
    ...(periodFilter ? { periodStart: periodFilter } : {}),
  };

  const aggregations = await prisma.emissionsRecord.groupBy({
    by: ['scope'],
    where,
    _sum: { value: true },
  });

  const scopeMap: Record<string, number> = { SCOPE_1: 0, SCOPE_2: 0, SCOPE_3: 0 };
  for (const row of aggregations) {
    scopeMap[row.scope] = toNumber(row._sum.value);
  }

  const scope1 = scopeMap['SCOPE_1'] ?? 0;
  const scope2 = scopeMap['SCOPE_2'] ?? 0;
  const scope3 = scopeMap['SCOPE_3'] ?? 0;
  const total = scope1 + scope2 + scope3;

  // Calculate change percent vs previous period of equal length
  let changePercent: number | null = null;
  if (dateFrom && dateTo) {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const durationMs = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - durationMs);
    const prevTo = new Date(from);

    const prevAgg = await prisma.emissionsRecord.aggregate({
      where: {
        orgId,
        status: 'VERIFIED',
        periodStart: { gte: prevFrom, lte: prevTo },
      },
      _sum: { value: true },
    });

    const prevTotal = toNumber(prevAgg._sum.value);
    if (prevTotal > 0) {
      changePercent = Math.round(((total - prevTotal) / prevTotal) * 10000) / 100;
    }
  }

  return {
    total,
    scope1,
    scope2,
    scope3,
    changePercent,
  };
}

// ─── Trend ───────────────────────────────────────────────────────────────────

export async function getTrend(orgId: string, months = 12): Promise<TrendPoint[]> {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const records = await prisma.emissionsRecord.findMany({
    where: {
      orgId,
      status: 'VERIFIED',
      periodStart: { gte: startDate },
    },
    select: {
      scope: true,
      value: true,
      periodStart: true,
    },
  });

  // Build month buckets
  const buckets = new Map<string, { scope1: number; scope2: number; scope3: number }>();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, { scope1: 0, scope2: 0, scope3: 0 });
  }

  for (const rec of records) {
    const d = rec.periodStart;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;

    const val = toNumber(rec.value);
    if (rec.scope === 'SCOPE_1') bucket.scope1 += val;
    else if (rec.scope === 'SCOPE_2') bucket.scope2 += val;
    else if (rec.scope === 'SCOPE_3') bucket.scope3 += val;
  }

  const result: TrendPoint[] = [];
  for (const [month, data] of buckets) {
    result.push({
      month,
      scope1: Math.round(data.scope1 * 10000) / 10000,
      scope2: Math.round(data.scope2 * 10000) / 10000,
      scope3: Math.round(data.scope3 * 10000) / 10000,
      total: Math.round((data.scope1 + data.scope2 + data.scope3) * 10000) / 10000,
    });
  }

  return result;
}

// ─── Breakdown ───────────────────────────────────────────────────────────────

export async function getBreakdown(
  orgId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<BreakdownItem[]> {
  const periodFilter = buildDateFilter(dateFrom, dateTo);

  const aggregations = await prisma.emissionsRecord.groupBy({
    by: ['scope'],
    where: {
      orgId,
      status: 'VERIFIED',
      ...(periodFilter ? { periodStart: periodFilter } : {}),
    },
    _sum: { value: true },
  });

  const total = aggregations.reduce(
    (sum: number, row: (typeof aggregations)[number]) => sum + toNumber(row._sum.value),
    0,
  );

  return aggregations
    .map((row: (typeof aggregations)[number]) => {
      const value = toNumber(row._sum.value);
      return {
        scope: row.scope,
        value,
        percentage: total > 0 ? Math.round((value / total) * 10000) / 100 : 0,
      };
    })
    .sort((a: BreakdownItem, b: BreakdownItem) => b.value - a.value);
}

// ─── Top Sources ─────────────────────────────────────────────────────────────

export async function getTopSources(
  orgId: string,
  limit = 10,
  dateFrom?: string,
  dateTo?: string,
): Promise<TopSourceItem[]> {
  const periodFilter = buildDateFilter(dateFrom, dateTo);

  const aggregations = await prisma.emissionsRecord.groupBy({
    by: ['source', 'category'],
    where: {
      orgId,
      status: 'VERIFIED',
      ...(periodFilter ? { periodStart: periodFilter } : {}),
    },
    _sum: { value: true },
    orderBy: { _sum: { value: 'desc' } },
    take: limit,
  });

  return aggregations.map((row: (typeof aggregations)[number]) => ({
    source: row.source,
    category: row.category,
    value: toNumber(row._sum.value),
  }));
}

// ─── By Category ─────────────────────────────────────────────────────────────

export async function getByCategory(
  orgId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<CategoryItem[]> {
  const periodFilter = buildDateFilter(dateFrom, dateTo);

  const aggregations = await prisma.emissionsRecord.groupBy({
    by: ['category', 'scope'],
    where: {
      orgId,
      status: 'VERIFIED',
      ...(periodFilter ? { periodStart: periodFilter } : {}),
    },
    _sum: { value: true },
  });

  // Pivot: group by category, split by scope
  const categoryMap = new Map<string, { scope1: number; scope2: number; scope3: number }>();

  for (const row of aggregations) {
    if (!categoryMap.has(row.category)) {
      categoryMap.set(row.category, { scope1: 0, scope2: 0, scope3: 0 });
    }
    const entry = categoryMap.get(row.category)!;
    const val = toNumber(row._sum.value);

    if (row.scope === 'SCOPE_1') entry.scope1 += val;
    else if (row.scope === 'SCOPE_2') entry.scope2 += val;
    else if (row.scope === 'SCOPE_3') entry.scope3 += val;
  }

  const result: CategoryItem[] = [];
  for (const [category, data] of categoryMap) {
    result.push({
      category,
      scope1: data.scope1,
      scope2: data.scope2,
      scope3: data.scope3,
      total: data.scope1 + data.scope2 + data.scope3,
    });
  }

  return result.sort((a, b) => b.total - a.total);
}

// ─── Year-over-Year Comparison ───────────────────────────────────────────────

export async function getYoYComparison(orgId: string): Promise<YoYPoint[]> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const previousYear = currentYear - 1;

  const startOfPrev = new Date(previousYear, 0, 1);
  const endOfCurrent = new Date(currentYear, 11, 31, 23, 59, 59, 999);

  const records = await prisma.emissionsRecord.findMany({
    where: {
      orgId,
      status: 'VERIFIED',
      periodStart: { gte: startOfPrev, lte: endOfCurrent },
    },
    select: {
      value: true,
      periodStart: true,
    },
  });

  // Build month buckets for both years
  const currentBuckets = new Map<number, number>();
  const prevBuckets = new Map<number, number>();
  for (let m = 0; m < 12; m++) {
    currentBuckets.set(m, 0);
    prevBuckets.set(m, 0);
  }

  for (const rec of records) {
    const year = rec.periodStart.getFullYear();
    const month = rec.periodStart.getMonth();
    const val = toNumber(rec.value);

    if (year === currentYear) {
      currentBuckets.set(month, (currentBuckets.get(month) ?? 0) + val);
    } else if (year === previousYear) {
      prevBuckets.set(month, (prevBuckets.get(month) ?? 0) + val);
    }
  }

  const result: YoYPoint[] = [];
  for (let m = 0; m < 12; m++) {
    const monthStr = `${String(m + 1).padStart(2, '0')}`;
    result.push({
      month: monthStr,
      currentYear: Math.round((currentBuckets.get(m) ?? 0) * 10000) / 10000,
      previousYear: Math.round((prevBuckets.get(m) ?? 0) * 10000) / 10000,
    });
  }

  return result;
}
