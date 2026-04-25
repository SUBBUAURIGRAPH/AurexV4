import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { PublicLayout } from './layouts/PublicLayout';
import { PublicLayout as BiocarbonPublicLayout } from './components/layout/PublicLayout';
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
import { EmissionsDataEntry } from './pages/dashboard/emissions/EmissionsDataEntry';
import { BaselinesPage } from './pages/dashboard/emissions/BaselinesPage';
import { TargetsPage } from './pages/dashboard/emissions/TargetsPage';
import { AnalyticsPage } from './pages/dashboard/AnalyticsPage';
import { ReportsPage } from './pages/dashboard/ReportsPage';
import { ReportBuilderPage } from './pages/dashboard/reports/ReportBuilderPage';
import { SettingsPage } from './pages/dashboard/SettingsPage';
import { TeamsPage } from './pages/dashboard/TeamsPage';
import { IntegrationsPage } from './pages/dashboard/IntegrationsPage';
import { CompliancePage } from './pages/dashboard/CompliancePage';
import { AuditLogsPage } from './pages/dashboard/AuditLogsPage';
import { BillingPage } from './pages/dashboard/BillingPage';
import { SupportPage } from './pages/dashboard/SupportPage';
import { UsersPage } from './pages/dashboard/admin/UsersPage';
import { OrganizationPage } from './pages/dashboard/admin/OrganizationPage';
import { OrganizationsPage } from './pages/dashboard/admin/OrganizationsPage';
import { ApprovalsPage } from './pages/dashboard/ApprovalsPage';
import { BulkUploadPage } from './pages/dashboard/emissions/BulkUploadPage';
import { OnboardingPage } from './pages/dashboard/OnboardingPage';
import { FrameworksHubPage } from './pages/dashboard/frameworks/FrameworksHubPage';
import { FrameworkDetailPage } from './pages/dashboard/frameworks/FrameworkDetailPage';
import { BRSRBuilderPage } from './pages/dashboard/brsr/BRSRBuilderPage';
import { SuppliersPage } from './pages/dashboard/suppliers/SuppliersPage';
// Article 6.4 / PACM pages
import { ActivitiesPage } from './pages/dashboard/activities/ActivitiesPage';
import { PddEditorPage } from './pages/dashboard/activities/PddEditorPage';
import { CreditsPage } from './pages/dashboard/credits/CreditsPage';
// BioCarbon public marketplace (AAT-ν / AV4-356)
import { MarketplacePage } from './pages/biocarbon/MarketplacePage';
import { TokenDetailPage } from './pages/biocarbon/TokenDetailPage';
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

          {/* Public BioCarbon marketplace (no auth) */}
          <Route element={<BiocarbonPublicLayout />}>
            <Route path="/biocarbon/marketplace" element={<MarketplacePage />} />
            <Route path="/biocarbon/tokens/:bcrSerialId" element={<TokenDetailPage />} />
          </Route>

          {/* Auth routes (no layout wrapper) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected dashboard routes */}
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/emissions" element={<EmissionsPage />} />
            <Route path="/emissions/new" element={<EmissionsDataEntry />} />
            <Route path="/emissions/import" element={<BulkUploadPage />} />
            <Route path="/emissions/baselines" element={<BaselinesPage />} />
            <Route path="/emissions/targets" element={<TargetsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/build/:type" element={<ReportBuilderPage />} />
            <Route path="/teams" element={<RoleGuard allowedRoles={['administrator', 'manager']}><TeamsPage /></RoleGuard>} />
            <Route path="/integrations" element={<RoleGuard allowedRoles={['administrator', 'manager', 'editor']}><IntegrationsPage /></RoleGuard>} />
            <Route path="/compliance" element={<RoleGuard allowedRoles={['administrator', 'manager', 'editor']}><CompliancePage /></RoleGuard>} />
            <Route path="/audit-logs" element={<RoleGuard allowedRoles={['administrator', 'manager']}><AuditLogsPage /></RoleGuard>} />
            <Route path="/billing" element={<RoleGuard allowedRoles={['administrator']}><BillingPage /></RoleGuard>} />
            <Route path="/support" element={<RoleGuard allowedRoles={['administrator', 'manager', 'editor', 'viewer']}><SupportPage /></RoleGuard>} />
            <Route path="/admin/users" element={<RoleGuard allowedRoles={['administrator', 'super_admin', 'org_admin']}><UsersPage /></RoleGuard>} />
            <Route path="/admin/organization" element={<RoleGuard allowedRoles={['administrator', 'super_admin', 'org_admin']}><OrganizationPage /></RoleGuard>} />
            <Route path="/admin/organizations" element={<RoleGuard allowedRoles={['administrator', 'super_admin', 'org_admin']}><OrganizationsPage /></RoleGuard>} />
            <Route path="/approvals" element={<ApprovalsPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/frameworks" element={<FrameworksHubPage />} />
            <Route path="/frameworks/:id" element={<FrameworkDetailPage />} />
            <Route path="/brsr" element={<BRSRBuilderPage />} />
            <Route path="/suppliers" element={<RoleGuard allowedRoles={['administrator', 'org_admin', 'super_admin', 'manager']}><SuppliersPage /></RoleGuard>} />
            {/* Article 6.4 / PACM */}
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/activities/:id/pdd" element={<PddEditorPage />} />
            <Route path="/credits" element={<CreditsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
