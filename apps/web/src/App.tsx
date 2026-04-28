import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setOnboardingIncompleteHandler } from './lib/api';
import { useToast } from './contexts/ToastContext';

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
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { EmissionsPage } from './pages/dashboard/EmissionsPage';
import { EmissionsDataEntry } from './pages/dashboard/emissions/EmissionsDataEntry';
import { EmissionDetailPage } from './pages/dashboard/emissions/EmissionDetailPage';
import { EmissionEditPage } from './pages/dashboard/emissions/EmissionEditPage';
import { BaselinesPage } from './pages/dashboard/emissions/BaselinesPage';
import { TargetsPage } from './pages/dashboard/emissions/TargetsPage';
import { AnalyticsPage } from './pages/dashboard/AnalyticsPage';
import { ReportsPage } from './pages/dashboard/ReportsPage';
import { ReportBuilderPage } from './pages/dashboard/reports/ReportBuilderPage';
import { SettingsPage } from './pages/dashboard/SettingsPage';
import { FinancialsPage } from './pages/dashboard/FinancialsPage';
import { TeamsPage } from './pages/dashboard/TeamsPage';
import { IntegrationsPage } from './pages/dashboard/IntegrationsPage';
import { CompliancePage } from './pages/dashboard/CompliancePage';
import { AuditLogsPage } from './pages/dashboard/AuditLogsPage';
// AAT-10B / Wave 10b: billing manage + invoice + renewal payment pages.
// The legacy `/billing` route at apps/web/src/pages/dashboard/BillingPage.tsx
// is superseded by the new manage page; the route is preserved as a redirect
// so any bookmarks keep working.
import { BillingPage } from './pages/dashboard/billing/BillingPage';
import { InvoicesPage as BillingInvoicesPage } from './pages/dashboard/billing/InvoicesPage';
import { RenewPaymentPage } from './pages/billing/RenewPaymentPage';
import { SupportPage } from './pages/dashboard/SupportPage';
import { UsersPage } from './pages/dashboard/admin/UsersPage';
import { OrganizationPage } from './pages/dashboard/admin/OrganizationPage';
import { CouponsPage } from './pages/dashboard/admin/CouponsPage';
import { OrganizationsPage } from './pages/dashboard/admin/OrganizationsPage';
import { OrgApprovalsPage } from './pages/dashboard/admin/OrgApprovalsPage';
import { QuotasPage } from './pages/dashboard/admin/QuotasPage';
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

/**
 * AAT-WORKFLOW (Wave 9a): registers the api.ts onboarding-incomplete handler
 * with toast + react-router navigation. Mounted inside <BrowserRouter> so
 * `useNavigate` works; rendered as a sibling to <Routes> so it has no DOM
 * footprint.
 */
function OnboardingInterceptorBridge() {
  const navigate = useNavigate();
  const toast = useToast();
  useEffect(() => {
    setOnboardingIncompleteHandler(({ detail, nextStep }) => {
      toast.warning(detail || 'Please complete onboarding first');
      navigate(nextStep || '/onboarding');
    });
    return () => {
      setOnboardingIncompleteHandler(null);
    };
  }, [navigate, toast]);
  return null;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <OnboardingInterceptorBridge />
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
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* Protected dashboard routes */}
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/emissions" element={<EmissionsPage />} />
            <Route path="/emissions/new" element={<EmissionsDataEntry />} />
            <Route path="/emissions/import" element={<BulkUploadPage />} />
            <Route path="/emissions/baselines" element={<BaselinesPage />} />
            <Route path="/emissions/targets" element={<TargetsPage />} />
            {/* AAT-WORKFLOW (Wave 9a): detail + edit views — previously
                404'd from the EmissionsPage View/Edit buttons. */}
            <Route path="/emissions/:id" element={<EmissionDetailPage />} />
            <Route path="/emissions/:id/edit" element={<EmissionEditPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/build/:type" element={<ReportBuilderPage />} />
            <Route path="/teams" element={<RoleGuard allowedRoles={['administrator', 'manager', 'org_admin', 'super_admin']}><TeamsPage /></RoleGuard>} />
            <Route path="/integrations" element={<RoleGuard allowedRoles={['administrator', 'manager', 'editor']}><IntegrationsPage /></RoleGuard>} />
            <Route path="/compliance" element={<RoleGuard allowedRoles={['administrator', 'manager', 'editor']}><CompliancePage /></RoleGuard>} />
            <Route path="/audit-logs" element={<RoleGuard allowedRoles={['administrator', 'manager']}><AuditLogsPage /></RoleGuard>} />
            {/* AAT-10B / Wave 10b: legacy /billing → /billing/manage redirect. */}
            <Route path="/billing" element={<Navigate to="/billing/manage" replace />} />
            <Route path="/billing/manage" element={<RoleGuard allowedRoles={['administrator']}><BillingPage /></RoleGuard>} />
            <Route path="/billing/invoices" element={<RoleGuard allowedRoles={['administrator']}><BillingInvoicesPage /></RoleGuard>} />
            {/* AAT-10B / Wave 10b: renewal email deep-link (auth-gated, any active org member can pay). */}
            <Route path="/billing/renew/:renewalAttemptId" element={<RenewPaymentPage />} />
            <Route path="/support" element={<RoleGuard allowedRoles={['administrator', 'manager', 'editor', 'viewer']}><SupportPage /></RoleGuard>} />
            <Route path="/admin/users" element={<RoleGuard allowedRoles={['administrator', 'super_admin', 'org_admin']}><UsersPage /></RoleGuard>} />
            <Route path="/admin/organization" element={<RoleGuard allowedRoles={['administrator', 'super_admin', 'org_admin']}><OrganizationPage /></RoleGuard>} />
            <Route path="/admin/organizations" element={<RoleGuard allowedRoles={['administrator', 'super_admin', 'org_admin']}><OrganizationsPage /></RoleGuard>} />
            <Route path="/admin/org-approvals" element={<RoleGuard allowedRoles={['super_admin']}><OrgApprovalsPage /></RoleGuard>} />
            <Route path="/admin/coupons" element={<RoleGuard allowedRoles={['administrator', 'super_admin', 'org_admin']}><CouponsPage /></RoleGuard>} />
            <Route path="/admin/quotas" element={<RoleGuard allowedRoles={['administrator', 'super_admin']}><QuotasPage /></RoleGuard>} />
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
            <Route path="/dashboard/settings/financials" element={<FinancialsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
