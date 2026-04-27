import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard } from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';
import { NextStepsWidget } from '../../components/dashboard/NextStepsWidget';
import { ApprovalStatusBanner } from '../../components/dashboard/ApprovalStatusBanner';
import { QuotaWidget } from '../../components/dashboard/QuotaWidget';
import { useAnalyticsSummary, useAnalyticsTrend, useAnalyticsBreakdown, useAnalyticsTopSources } from '../../hooks/useAnalytics';

/* ============================================
   Lazy-loaded chart components
   ============================================ */

import { EmissionsTrendChart } from '../../components/charts/EmissionsTrendChart';
import { ScopeBreakdownChart } from '../../components/charts/ScopeBreakdownChart';
import { TopSourcesChart } from '../../components/charts/TopSourcesChart';

/* ============================================
   Helpers
   ============================================ */

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/* ============================================
   Skeleton placeholder
   ============================================ */

function ChartSkeleton() {
  return (
    <div
      style={{
        height: '280px',
        borderRadius: '0.5rem',
        backgroundColor: 'var(--bg-secondary, #f3f4f6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-tertiary)',
        fontSize: '0.875rem',
      }}
    >
      Loading chart...
    </div>
  );
}

/* ============================================
   Quick Action Button
   ============================================ */

function QuickActionButton({
  to,
  color,
  icon,
  title,
  subtitle,
}: {
  to: string;
  color: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.875rem',
          padding: '0.875rem 1rem',
          borderRadius: '0.5rem',
          border: '1px solid var(--border-primary)',
          transition: 'all 150ms',
          cursor: 'pointer',
          backgroundColor: 'var(--bg-primary)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = color;
          e.currentTarget.style.backgroundColor = `${color}0a`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-primary)';
          e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
        }}
      >
        <div
          style={{
            width: '2.25rem',
            height: '2.25rem',
            borderRadius: '0.5rem',
            backgroundColor: `${color}14`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {title}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{subtitle}</p>
        </div>
      </div>
    </Link>
  );
}

/* ============================================
   Scope Icons
   ============================================ */

const icons = {
  total: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v20M2 12h20" />
    </svg>
  ),
  scope1: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  scope2: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  scope3: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
};

/* ============================================
   Dashboard Page
   ============================================ */

export function DashboardPage() {
  const { user } = useAuth();

  const { data: summaryRes, isLoading: summaryLoading } = useAnalyticsSummary();
  const { data: trendRes, isLoading: trendLoading } = useAnalyticsTrend(12);
  const { data: breakdownRes, isLoading: breakdownLoading } = useAnalyticsBreakdown();
  const { data: topSourcesRes, isLoading: topSourcesLoading } = useAnalyticsTopSources(10);

  const summary = summaryRes?.data;

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Welcome Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            marginBottom: '0.25rem',
            color: 'var(--text-primary)',
          }}
        >
          Welcome back, {user?.name?.split(' ')[0] || 'there'}
        </h2>
        <p style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)' }}>{formatDate()}</p>
      </div>

      {/* FLOW-REWORK / Sprint 5: pending-approval banner — top of dashboard. */}
      <ApprovalStatusBanner />

      {/* AAT-WORKFLOW (Wave 9a): linear setup checklist surfaces what's next. */}
      <NextStepsWidget />

      {/* AAT-378 / AV4-378: top-3 quota utilisation snapshot. */}
      <div style={{ marginBottom: '1.5rem' }}>
        <QuotaWidget />
      </div>

      {/* Row 1: Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <StatCard
          label="Total Emissions"
          value={summaryLoading || !summary ? '\u2014' : `${formatNumber(summary.total)} tCO2e`}
          trend={
            summary && summary.changePercent !== null
              ? {
                  value: `${Math.abs(summary.changePercent).toFixed(1)}%`,
                  positive: summary.changePercent > 0,
                }
              : undefined
          }
          color="#1a5d3d"
          icon={icons.total}
        />
        <StatCard
          label="Scope 1 - Direct"
          value={summaryLoading || !summary ? '\u2014' : `${formatNumber(summary.scope1)} tCO2e`}
          color="#ef4444"
          icon={icons.scope1}
        />
        <StatCard
          label="Scope 2 - Indirect"
          value={summaryLoading || !summary ? '\u2014' : `${formatNumber(summary.scope2)} tCO2e`}
          color="#8b5cf6"
          icon={icons.scope2}
        />
        <StatCard
          label="Scope 3 - Value Chain"
          value={summaryLoading || !summary ? '\u2014' : `${formatNumber(summary.scope3)} tCO2e`}
          color="#14b8a6"
          icon={icons.scope3}
        />
      </div>

      {/* Row 2: Trend + Breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        <Card padding="lg">
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              marginBottom: '1.25rem',
              color: 'var(--text-primary)',
            }}
          >
            Emissions Trend (12 Months)
          </h3>
          {trendLoading ? (
            <ChartSkeleton />
          ) : (
            <EmissionsTrendChart data={trendRes?.data ?? []} />
          )}
        </Card>

        <Card padding="lg">
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              marginBottom: '1.25rem',
              color: 'var(--text-primary)',
            }}
          >
            Scope Breakdown
          </h3>
          {breakdownLoading ? (
            <ChartSkeleton />
          ) : (
            <ScopeBreakdownChart data={breakdownRes?.data ?? []} />
          )}
        </Card>
      </div>

      {/* Row 3: Top Sources + Quick Actions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
        }}
      >
        <Card padding="lg">
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              marginBottom: '1.25rem',
              color: 'var(--text-primary)',
            }}
          >
            Top Emission Sources
          </h3>
          {topSourcesLoading ? (
            <ChartSkeleton />
          ) : (
            <TopSourcesChart data={topSourcesRes?.data ?? []} />
          )}
        </Card>

        <Card padding="lg">
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              marginBottom: '1.25rem',
              color: 'var(--text-primary)',
            }}
          >
            Quick Actions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <QuickActionButton
              to="/emissions/new"
              color="#1a5d3d"
              title="Record Emission"
              subtitle="Log a new emissions data point"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              }
            />
            <QuickActionButton
              to="/reports"
              color="#10b981"
              title="View Reports"
              subtitle="Browse and generate compliance reports"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              }
            />
            <QuickActionButton
              to="/emissions/targets"
              color="#8b5cf6"
              title="Set Targets"
              subtitle="Define and track reduction targets"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              }
            />
            <QuickActionButton
              to="/admin/users"
              color="#14b8a6"
              title="Manage Team"
              subtitle="Invite members and manage roles"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
