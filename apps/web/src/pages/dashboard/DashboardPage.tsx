import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard } from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

const recentActivity = [
  { id: 1, type: 'emission', desc: 'Scope 1 emission recorded - Fleet Diesel (245 tCO2e)', time: '2 hours ago', status: 'success' as const },
  { id: 2, type: 'report', desc: 'Q4 2025 GHG Report generated and submitted', time: '5 hours ago', status: 'success' as const },
  { id: 3, type: 'alert', desc: 'Scope 2 emissions exceeded monthly target by 3.2%', time: '1 day ago', status: 'warning' as const },
  { id: 4, type: 'credit', desc: '500 VCS carbon credits retired for FY2025 offset', time: '2 days ago', status: 'info' as const },
  { id: 5, type: 'emission', desc: 'Scope 3 Category 4 - Upstream Transport data updated', time: '3 days ago', status: 'success' as const },
];

export function DashboardPage() {
  const { user } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Welcome */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
          {getGreeting()}, {user?.name?.split(' ')[0] || 'there'}
        </h2>
        <p style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)' }}>
          Here's your sustainability performance overview.
        </p>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <StatCard
          label="Total Emissions"
          value="12,847 tCO2e"
          trend={{ value: '8.3%', positive: false }}
          color="#1a5d3d"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M2 12h20" />
            </svg>
          }
        />
        <StatCard
          label="Scope 1 - Direct"
          value="3,214 tCO2e"
          trend={{ value: '12.1%', positive: false }}
          color="#10b981"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          }
        />
        <StatCard
          label="Scope 2 - Indirect"
          value="5,891 tCO2e"
          trend={{ value: '3.7%', positive: true }}
          color="#14b8a6"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          }
        />
        <StatCard
          label="Scope 3 - Value Chain"
          value="3,742 tCO2e"
          trend={{ value: '5.9%', positive: false }}
          color="#22755a"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          }
        />
      </div>

      {/* Quick Actions + Recent Activity */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
      }}>
        {/* Quick Actions */}
        <Card padding="lg">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
            Quick Actions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link to="/emissions" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.875rem',
                  padding: '0.875rem 1rem', borderRadius: '0.5rem',
                  border: '1px solid var(--border-primary)',
                  transition: 'all 150ms', cursor: 'pointer',
                  backgroundColor: 'var(--bg-primary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#1a5d3d';
                  e.currentTarget.style.backgroundColor = 'rgba(26, 93, 61, 0.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                }}
              >
                <div style={{
                  width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem',
                  backgroundColor: 'rgba(26, 93, 61, 0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#1a5d3d', flexShrink: 0,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Record Emission</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Log a new emissions data point</p>
                </div>
              </div>
            </Link>

            <Link to="/reports" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.875rem',
                  padding: '0.875rem 1rem', borderRadius: '0.5rem',
                  border: '1px solid var(--border-primary)',
                  transition: 'all 150ms', cursor: 'pointer',
                  backgroundColor: 'var(--bg-primary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#10b981';
                  e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                }}
              >
                <div style={{
                  width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#10b981', flexShrink: 0,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Generate Report</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Create a compliance or analytics report</p>
                </div>
              </div>
            </Link>

            <Link to="/emissions" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.875rem',
                  padding: '0.875rem 1rem', borderRadius: '0.5rem',
                  border: '1px solid var(--border-primary)',
                  transition: 'all 150ms', cursor: 'pointer',
                  backgroundColor: 'var(--bg-primary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#14b8a6';
                  e.currentTarget.style.backgroundColor = 'rgba(20, 184, 166, 0.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                }}
              >
                <div style={{
                  width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem',
                  backgroundColor: 'rgba(20, 184, 166, 0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#14b8a6', flexShrink: 0,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>View Targets</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Check progress against reduction targets</p>
                </div>
              </div>
            </Link>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card padding="lg">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Recent Activity</h3>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#10b981', fontWeight: 600, fontFamily: 'inherit' }}>
              View All
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.75rem 0',
                  borderBottom: '1px solid var(--border-primary)',
                }}
              >
                <div style={{
                  width: '0.5rem', height: '0.5rem', borderRadius: '50%', marginTop: '0.5rem', flexShrink: 0,
                  backgroundColor: activity.status === 'success' ? '#22c55e' : activity.status === 'warning' ? '#f59e0b' : '#3b82f6',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {activity.desc}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.125rem' }}>
                    {activity.time}
                  </p>
                </div>
                <Badge variant={activity.status}>
                  {activity.status === 'success' ? 'Done' : activity.status === 'warning' ? 'Alert' : 'Info'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <Card padding="lg">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.875rem', color: 'var(--text-primary)' }}>
            Enterprise Control Center
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            {[
              { label: 'Teams', path: '/teams' },
              { label: 'Integrations', path: '/integrations' },
              { label: 'Compliance', path: '/compliance' },
              { label: 'Audit Logs', path: '/audit-logs' },
              { label: 'Billing', path: '/billing' },
              { label: 'Support', path: '/support' },
            ].map((item) => (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  textDecoration: 'none',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--bg-primary)',
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
