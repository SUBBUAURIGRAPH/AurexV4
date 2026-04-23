import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { PublicLayout } from './layouts/PublicLayout';
import { DashboardLayout } from './layouts/DashboardLayout';

import { HomePage } from './pages/public/HomePage';
import { AboutPage } from './pages/public/AboutPage';
import { LegalPage } from './pages/public/LegalPage';
import { TermsPage } from './pages/public/TermsPage';
import { PrivacyPage } from './pages/public/PrivacyPage';
import { EulaPage } from './pages/public/EulaPage';
import { DisclaimerPage } from './pages/public/DisclaimerPage';
import { NeutralisPage } from './pages/products/NeutralisPage';
import { CarbonTracePage } from './pages/products/CarbonTracePage';
import { HydroPulsePage } from './pages/products/HydroPulsePage';
import { SylvagraphPage } from './pages/products/SylvagraphPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { EmissionsPage } from './pages/dashboard/EmissionsPage';
import { ReportsPage } from './pages/dashboard/ReportsPage';
import { SettingsPage } from './pages/dashboard/SettingsPage';
import { TeamsPage } from './pages/dashboard/TeamsPage';
import { IntegrationsPage } from './pages/dashboard/IntegrationsPage';
import { CompliancePage } from './pages/dashboard/CompliancePage';
import { AuditLogsPage } from './pages/dashboard/AuditLogsPage';
import { BillingPage } from './pages/dashboard/BillingPage';
import { SupportPage } from './pages/dashboard/SupportPage';
import { RoleGuard } from './components/auth/RoleGuard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/legal/terms" element={<TermsPage />} />
            <Route path="/legal/privacy" element={<PrivacyPage />} />
            <Route path="/legal/eula" element={<EulaPage />} />
            <Route path="/legal/disclaimer" element={<DisclaimerPage />} />
            <Route path="/products/neutralis" element={<NeutralisPage />} />
            <Route path="/products/carbontrace" element={<CarbonTracePage />} />
            <Route path="/products/hydropulse" element={<HydroPulsePage />} />
            <Route path="/products/sylvagraph" element={<SylvagraphPage />} />
          </Route>

          {/* Auth routes (no layout wrapper) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected dashboard routes */}
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/emissions" element={<EmissionsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/teams" element={<RoleGuard allowedRoles={['administrator', 'manager']}><TeamsPage /></RoleGuard>} />
            <Route path="/integrations" element={<RoleGuard allowedRoles={['administrator', 'manager', 'editor']}><IntegrationsPage /></RoleGuard>} />
            <Route path="/compliance" element={<RoleGuard allowedRoles={['administrator', 'manager', 'editor']}><CompliancePage /></RoleGuard>} />
            <Route path="/audit-logs" element={<RoleGuard allowedRoles={['administrator', 'manager']}><AuditLogsPage /></RoleGuard>} />
            <Route path="/billing" element={<RoleGuard allowedRoles={['administrator']}><BillingPage /></RoleGuard>} />
            <Route path="/support" element={<RoleGuard allowedRoles={['administrator', 'manager', 'editor', 'viewer']}><SupportPage /></RoleGuard>} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
