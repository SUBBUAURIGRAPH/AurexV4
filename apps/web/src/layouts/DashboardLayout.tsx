import { Outlet, Navigate } from 'react-router-dom';
import { DashboardSidebar } from '../components/layout/DashboardSidebar';
import { DashboardTopbar } from '../components/layout/DashboardTopbar';
import { VerifyEmailBanner } from '../components/layout/VerifyEmailBanner';
import { useAuth } from '../contexts/AuthContext';

export function DashboardLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '3rem', height: '3rem', borderRadius: '0.75rem',
            background: 'linear-gradient(135deg, #1a5d3d, #10b981)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: '1.25rem',
            margin: '0 auto 1rem',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}>
            A
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-secondary)' }}>
      <DashboardTopbar />
      <DashboardSidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <VerifyEmailBanner />
        <main style={{ flex: 1, padding: '1.5rem' }}>
          <div className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
