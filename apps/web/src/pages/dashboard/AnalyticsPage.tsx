import { useState, useMemo } from 'react';
import { StatCard } from '../../components/ui/StatCard';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { EmissionsTrendChart } from '../../components/charts/EmissionsTrendChart';
import { ScopeBreakdownChart } from '../../components/charts/ScopeBreakdownChart';
import { CategoryStackedBar } from '../../components/charts/CategoryStackedBar';
import { TopSourcesChart } from '../../components/charts/TopSourcesChart';
import { YoYComparisonChart } from '../../components/charts/YoYComparisonChart';
import {
  useAnalyticsSummary,
  useAnalyticsTrend,
  useAnalyticsBreakdown,
  useAnalyticsTopSources,
  useAnalyticsByCategory,
  useAnalyticsYoY,
} from '../../hooks/useAnalytics';

function formatValue(val: number | undefined): string {
  if (val === undefined || val === null) return '—';
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return val.toLocaleString();
}

export function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });

  const dateFrom = dateRange.from || undefined;
  const dateTo = dateRange.to || undefined;

  // Compute trend months from date range
  const trendMonths = useMemo(() => {
    if (!dateFrom || !dateTo) return 12;
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const diff = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    return Math.max(diff, 3);
  }, [dateFrom, dateTo]);

  const { data: summaryData, isLoading: summaryLoading } = useAnalyticsSummary(dateFrom, dateTo);
  const { data: trendData, isLoading: trendLoading } = useAnalyticsTrend(trendMonths);
  const { data: breakdownData, isLoading: breakdownLoading } = useAnalyticsBreakdown(dateFrom, dateTo);
  const { data: topSourcesData, isLoading: topSourcesLoading } = useAnalyticsTopSources(10, dateFrom, dateTo);
  const { data: categoryData, isLoading: categoryLoading } = useAnalyticsByCategory(dateFrom, dateTo);
  const { data: yoyData, isLoading: yoyLoading } = useAnalyticsYoY();

  const summary = summaryData?.data;
  const trend = trendData?.data ?? [];
  const breakdown = breakdownData?.data ?? [];
  const topSources = topSourcesData?.data ?? [];
  const categories = categoryData?.data ?? [];
  const yoy = yoyData?.data ?? [];

  const changePercent = summary?.changePercent;
  const changeTrend = changePercent !== undefined && changePercent !== null
    ? { value: `${Math.abs(changePercent).toFixed(1)}%`, positive: changePercent <= 0 }
    : undefined;

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Emissions Analytics
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Comprehensive view of your organization's carbon footprint.
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Row 1: Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <StatCard
          label="Total Emissions"
          value={summaryLoading ? '...' : `${formatValue(summary?.total)} tCO₂e`}
          trend={changeTrend}
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M2 12h20" />
            </svg>
          }
        />
        <StatCard
          label="Scope 1"
          value={summaryLoading ? '...' : `${formatValue(summary?.scope1)} tCO₂e`}
          color="#ef4444"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          }
        />
        <StatCard
          label="Scope 2"
          value={summaryLoading ? '...' : `${formatValue(summary?.scope2)} tCO₂e`}
          color="#8b5cf6"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
          }
        />
        <StatCard
          label="Scope 3"
          value={summaryLoading ? '...' : `${formatValue(summary?.scope3)} tCO₂e`}
          color="#14b8a6"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6" /><path d="M23 11h-6" />
            </svg>
          }
        />
      </div>

      {/* Row 2: Emissions Trend (full width) */}
      <div style={{ marginBottom: '1.5rem' }}>
        <EmissionsTrendChart data={trend} loading={trendLoading} title="Emissions Trend" />
      </div>

      {/* Row 3: Scope Breakdown + Category Stacked Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <ScopeBreakdownChart data={breakdown} loading={breakdownLoading} />
        <CategoryStackedBar data={categories} loading={categoryLoading} />
      </div>

      {/* Row 4: Top Sources + YoY Comparison */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '1.5rem',
        }}
      >
        <TopSourcesChart data={topSources} loading={topSourcesLoading} />
        <YoYComparisonChart data={yoy} loading={yoyLoading} />
      </div>
    </div>
  );
}
