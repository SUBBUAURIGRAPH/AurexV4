# AurexV4 Frontend Portal — Sprint WBS

**Source**: SPARC Sprint Plan (4 sprints × 2 weeks)
**Board**: [AV4](https://aurigraphdlt.atlassian.net/jira/software/projects/AV4/boards/1450)
**Conventions**: Epic → Story → Task → Subtask

---

## Sprint 1: Foundation & Core Data (Weeks 1-2)

| WBS | Type | Name | Notes |
| --- | --- | --- | --- |
| S1 | Epic | Foundation & Core Data | API CRUD, org/user mgmt, emissions entry |
| S1.1 | Story | Organization CRUD API | POST/GET/PATCH /organizations, member mgmt |
| S1.1.1 | Task | Organization routes + service | routes/organizations.ts, services/organization.service.ts |
| S1.1.2 | Task | Org member endpoints | GET/POST/PATCH/DELETE /organizations/:id/members |
| S1.1.3 | Task | Org Zod schemas | packages/shared/src/schemas/organization.ts |
| S1.1.4 | Task | Org API tests | tests/unit/api/organizations.test.ts (6 cases) |
| S1.2 | Story | User Management API | GET/PATCH/DELETE /users with pagination + RBAC |
| S1.2.1 | Task | User routes + service | routes/users.ts, services/user.service.ts |
| S1.2.2 | Task | User filter/search/pagination | query params: search, role, isActive, page, pageSize |
| S1.2.3 | Task | User API tests | tests/unit/api/users.test.ts (4 cases) |
| S1.3 | Story | Emissions CRUD API | Full emissions lifecycle with status workflow |
| S1.3.1 | Task | Emissions routes + service | routes/emissions.ts, services/emissions.service.ts |
| S1.3.2 | Task | Emissions status workflow | DRAFT→PENDING→VERIFIED/REJECTED, bulk-status |
| S1.3.3 | Task | Prisma schema: status + createdBy | Add status enum, createdBy FK to EmissionsRecord |
| S1.3.4 | Task | Emission sources + factors ref data | GET /emission-sources, GET /emission-factors |
| S1.3.5 | Task | Prisma schema: EmissionSource + EmissionFactor | New models for reference data |
| S1.3.6 | Task | Emissions API tests | tests/unit/api/emissions.test.ts (8 cases) |
| S1.4 | Story | Org-scope middleware | Extract orgId from JWT, scope all queries |
| S1.4.1 | Task | Org-scope middleware | middleware/org-scope.ts |
| S1.5 | Story | Frontend: API client + hooks | Centralized fetch wrapper, React Query hooks |
| S1.5.1 | Task | API client (src/lib/api.ts) | Auth header injection, token refresh, error normalization |
| S1.5.2 | Task | useEmissions hook | CRUD + filter + pagination |
| S1.5.3 | Task | useUsers hook | CRUD + search + filter |
| S1.5.4 | Task | useOrganization hook | Org + members |
| S1.6 | Story | Frontend: UI components batch 1 | Modal, Select, Table, Pagination, SearchInput, Toast, Tabs, EmptyState |
| S1.6.1 | Task | Modal component | Overlay, close, focus trap |
| S1.6.2 | Task | Select component | Dropdown with search |
| S1.6.3 | Task | Table component | Sortable columns, pagination controls |
| S1.6.4 | Task | Pagination component | Page nav, page size selector |
| S1.6.5 | Task | SearchInput component | Debounced search |
| S1.6.6 | Task | Toast component | Success/error/info notifications |
| S1.6.7 | Task | Tabs component | Extract from EmissionsPage inline |
| S1.6.8 | Task | EmptyState component | Icon + message + CTA |
| S1.6.9 | Task | Component tests | tests/unit/components/{Table,Modal}.test.tsx |
| S1.7 | Story | Frontend: Users page | Admin user management table |
| S1.7.1 | Task | UsersPage with table | Search, filter, paginate, CRUD |
| S1.7.2 | Task | UserForm dialog | Create/edit user with role selector |
| S1.7.3 | Task | UserForm tests | tests/unit/components/UserForm.test.tsx |
| S1.8 | Story | Frontend: Organization page | Org profile + member list + invite |
| S1.8.1 | Task | OrganizationPage | Org details form + member table |
| S1.8.2 | Task | OrgForm + invite form | Create/edit org, invite by email |
| S1.9 | Story | Frontend: Emissions data entry | Scope→Category→Source→Factor cascading form |
| S1.9.1 | Task | ScopeDataEntry form | Cascading dropdowns, auto-calc CO2e |
| S1.9.2 | Task | EmissionsPage wired to API | Replace hardcoded data with React Query |
| S1.9.3 | Task | EmissionsDataEntry page | Full entry page at /emissions/new |
| S1.9.4 | Task | ScopeDataEntry tests | tests/unit/components/ScopeDataEntry.test.tsx |
| S1.10 | Story | Route + sidebar updates | New routes + nav items in DashboardSidebar |

---

## Sprint 2: Analytics & Reporting (Weeks 3-4)

| WBS | Type | Name | Notes |
| --- | --- | --- | --- |
| S2 | Epic | Analytics & Reporting | Charts, baselines, targets, reports |
| S2.1 | Story | Analytics API | Aggregation endpoints for dashboard |
| S2.1.1 | Task | Analytics routes + service | 6 endpoints: summary, trend, breakdown, top-sources, by-category, yoy |
| S2.1.2 | Task | Efficient SQL aggregation | GROUP BY scope/category/month, avoid N+1 |
| S2.1.3 | Task | Analytics API tests | tests/unit/api/analytics.test.ts |
| S2.2 | Story | Baselines CRUD API | POST/GET/PATCH/DELETE /baselines |
| S2.2.1 | Task | Baseline routes + service | Full CRUD with org scoping |
| S2.2.2 | Task | Baseline API tests | tests/unit/api/baselines.test.ts |
| S2.3 | Story | Targets CRUD + progress API | Targets with SBTi pathway, approval, progress |
| S2.3.1 | Task | Target routes + service | CRUD + approve + progress |
| S2.3.2 | Task | Target progress calculation | actual vs projected vs target trajectory |
| S2.3.3 | Task | Target API tests | tests/unit/api/targets.test.ts |
| S2.4 | Story | Reports API | Async generation with status polling |
| S2.4.1 | Task | Report routes + service | Generate, status, download, list |
| S2.4.2 | Task | Prisma schema: Report model | id, type, status, parameters, filePath |
| S2.4.3 | Task | PDF generation utility | lib/pdf-generator.ts |
| S2.5 | Story | Frontend: Recharts integration | Install recharts, build 6 chart components |
| S2.5.1 | Task | EmissionsTrendChart (area) | Monthly emissions over 12 months |
| S2.5.2 | Task | ScopeBreakdownChart (pie) | Scope 1/2/3 distribution |
| S2.5.3 | Task | TopSourcesChart (bar) | Top 10 emission sources |
| S2.5.4 | Task | YoYComparisonChart (line) | Year-over-year comparison |
| S2.5.5 | Task | TargetProgressChart (composed) | Actual vs projected vs target |
| S2.5.6 | Task | CategoryStackedBar | Stacked bar by category |
| S2.5.7 | Task | Chart component tests | tests/unit/components/charts.test.tsx |
| S2.6 | Story | Frontend: Dashboard with live data | Replace hardcoded stats with API |
| S2.6.1 | Task | DashboardPage wired to analytics API | Stat cards + charts from /analytics/* |
| S2.6.2 | Task | useAnalytics hooks | summary, trend, breakdown, topSources |
| S2.7 | Story | Frontend: Baselines page | Baseline CRUD UI |
| S2.7.1 | Task | BaselinesPage + BaselineForm | List + create/edit form |
| S2.8 | Story | Frontend: Targets wizard | 4-step target creation |
| S2.8.1 | Task | TargetsPage + TargetWizard | List + 4-step stepper wizard |
| S2.8.2 | Task | Stepper + DateRangePicker UI components | Multi-step stepper, date range picker |
| S2.8.3 | Task | TargetWizard tests | tests/unit/components/TargetWizard.test.tsx |
| S2.9 | Story | Frontend: Analytics page | Full analytics dashboard |
| S2.9.1 | Task | AnalyticsPage | Date range, all 6 chart types |
| S2.10 | Story | Frontend: Report builder | Report config + generation + download |
| S2.10.1 | Task | ReportBuilderPage | Type selector, params, generate, poll, download |
| S2.11 | Story | Integration tests | Target creation full flow |
| S2.11.1 | Task | Target creation workflow test | tests/integration/workflows/target-creation.test.ts |

---

## Sprint 3: Compliance & Workflows (Weeks 5-6)

| WBS | Type | Name | Notes |
| --- | --- | --- | --- |
| S3 | Epic | Compliance & Workflows | ESG frameworks, BRSR, approvals, onboarding, audit |
| S3.1 | Story | ESG Frameworks API | Framework + principle + indicator endpoints |
| S3.1.1 | Task | Framework routes + service | GET /frameworks, /:id, /:id/indicators, /:id/progress |
| S3.1.2 | Task | Prisma: ESGFramework, Principle, Indicator models | Framework hierarchy + indicator values |
| S3.1.3 | Task | Seed 7 frameworks with principles | BRSR, GRI, SBTi, CDP, TCFD, SASB, CSRD |
| S3.1.4 | Task | Framework API tests | tests/unit/api/frameworks.test.ts |
| S3.2 | Story | BRSR Indicators API | BRSR-specific indicator CRUD + submit + PDF |
| S3.2.1 | Task | BRSR routes + service | Principles, indicator update, evidence upload, submit, PDF |
| S3.2.2 | Task | BRSR API tests | tests/unit/api/brsr.test.ts |
| S3.3 | Story | Approval Workflow API | Generic approval system |
| S3.3.1 | Task | Approval routes + service | List, counts, approve, reject with comments |
| S3.3.2 | Task | Prisma: Approval model | Type, resourceId, status, comment, requestedBy, reviewedBy |
| S3.3.3 | Task | Approval API tests | tests/unit/api/approvals.test.ts |
| S3.4 | Story | Audit Log API | Query + export audit trail |
| S3.4.1 | Task | Audit log routes + service | List, detail, CSV export |
| S3.4.2 | Task | Audit middleware | Auto-log all mutations to AuditLog |
| S3.4.3 | Task | Audit API tests | tests/unit/api/audit-logs.test.ts |
| S3.5 | Story | Onboarding API | 5-step progress tracking |
| S3.5.1 | Task | Onboarding routes + service | Status, complete step, complete all |
| S3.5.2 | Task | Prisma: OnboardingProgress model | userId, step, completedAt |
| S3.5.3 | Task | Onboarding API tests | tests/unit/api/onboarding.test.ts |
| S3.6 | Story | Frontend: Frameworks hub | Framework cards with progress rings |
| S3.6.1 | Task | FrameworksHubPage | 7 framework cards with completion % |
| S3.6.2 | Task | FrameworkDetailPage | Single framework with principles/indicators |
| S3.6.3 | Task | FrameworkCard + Accordion components | Card with progress ring, collapsible principles |
| S3.7 | Story | Frontend: BRSR builder | 9-principle report builder |
| S3.7.1 | Task | BRSRBuilderPage | Principle tabs, indicator forms, evidence upload |
| S3.7.2 | Task | IndicatorField component | Renders correct input per data type |
| S3.7.3 | Task | FileUpload + TextArea components | Drag-drop upload, multi-line text |
| S3.7.4 | Task | BRSR builder tests | tests/unit/components/BRSRBuilder.test.tsx |
| S3.8 | Story | Frontend: Approvals inbox | Tabbed approval management |
| S3.8.1 | Task | ApprovalsPage | Tabs with count badges, approve/reject |
| S3.8.2 | Task | ConfirmDialog component | Approve/reject with comment |
| S3.8.3 | Task | Approvals tests | tests/unit/components/Approvals.test.tsx |
| S3.9 | Story | Frontend: Onboarding wizard | 5-step guided setup |
| S3.9.1 | Task | OnboardingWizard page | Org setup, frameworks, baseline, invite, complete |
| S3.9.2 | Task | Onboarding wizard tests | tests/unit/components/OnboardingWizard.test.tsx |
| S3.10 | Story | Frontend: Audit log viewer | Timeline + diff viewer |
| S3.10.1 | Task | AuditLogPage | Filterable timeline, JSON diff viewer |
| S3.10.2 | Task | Timeline + DiffViewer + FilterBar components | Vertical timeline, old/new diff, filter bar |
| S3.11 | Story | E2E + integration tests | Auth flows, BRSR submission, approval flow |
| S3.11.1 | Task | E2E auth tests | tests/e2e/auth.spec.ts |
| S3.11.2 | Task | BRSR submission workflow test | tests/integration/workflows/brsr-submission.test.ts |
| S3.11.3 | Task | Approval flow test | tests/integration/workflows/approval-flow.test.ts |

---

## Sprint 4: Advanced Features & Polish (Weeks 7-8)

| WBS | Type | Name | Notes |
| --- | --- | --- | --- |
| S4 | Epic | Advanced Features & Polish | Bulk upload, export, notifications, suppliers, marketplace, settings |
| S4.1 | Story | Bulk Upload API | CSV upload, validate, import |
| S4.1.1 | Task | Bulk upload routes + service | Upload, validate, import, status, template |
| S4.1.2 | Task | CSV parser utility | lib/csv-parser.ts with validation |
| S4.1.3 | Task | Prisma: ImportJob model | Tracking import progress |
| S4.1.4 | Task | Bulk upload API tests | tests/unit/api/bulk-upload.test.ts |
| S4.1.5 | Task | CSV parser tests | tests/unit/services/csv-parser.test.ts |
| S4.2 | Story | Export API | CSV/PDF export for emissions, audit, analytics |
| S4.2.1 | Task | Export routes + service | POST /export/{emissions,audit-logs,analytics} |
| S4.2.2 | Task | Export API tests | tests/unit/api/export.test.ts |
| S4.3 | Story | Notifications API | CRUD + preferences |
| S4.3.1 | Task | Notification routes + service | List, unread count, mark read, preferences |
| S4.3.2 | Task | Prisma: Notification + NotificationPreference models | |
| S4.3.3 | Task | Notification API tests | tests/unit/api/notifications.test.ts |
| S4.4 | Story | Supplier Portal API | Supplier mgmt + data collection |
| S4.4.1 | Task | Supplier routes + service | CRUD suppliers, send data requests |
| S4.4.2 | Task | Supplier portal routes | Supplier-facing: list requests, submit data |
| S4.4.3 | Task | Prisma: Supplier + SupplierDataRequest models | |
| S4.4.4 | Task | Supplier API tests | tests/unit/api/suppliers.test.ts |
| S4.5 | Story | Security API enhancements | Password change, MFA, sessions |
| S4.5.1 | Task | Password change + MFA endpoints | POST /auth/change-password, mfa/enable, mfa/verify, mfa/disable |
| S4.5.2 | Task | Session management endpoints | GET/DELETE /auth/sessions |
| S4.5.3 | Task | Security API tests | tests/unit/api/security.test.ts |
| S4.6 | Story | Frontend: Bulk upload wizard | Multi-step CSV import |
| S4.6.1 | Task | BulkUploadPage | Dropzone → preview → validate → dedup → import → summary |
| S4.6.2 | Task | Dropzone + DataPreviewTable components | File drop, validation markers |
| S4.6.3 | Task | Bulk upload tests | tests/unit/components/BulkUpload.test.tsx |
| S4.7 | Story | Frontend: Notifications | Bell icon + dropdown + full page |
| S4.7.1 | Task | NotificationBell + NotificationDropdown | Topbar bell with unread badge, dropdown list |
| S4.7.2 | Task | NotificationsPage | Full notification list with mark-all-read |
| S4.7.3 | Task | Notification tests | tests/unit/components/NotificationBell.test.tsx |
| S4.8 | Story | Frontend: Supplier portal | Supplier management + simplified entry |
| S4.8.1 | Task | SuppliersPage | Supplier list, add, send data request |
| S4.8.2 | Task | SupplierPortalPage | Simplified supplier data entry |
| S4.9 | Story | Frontend: Carbon marketplace | Offset project browsing (placeholder) |
| S4.9.1 | Task | MarketplacePage | Project cards with filters |
| S4.10 | Story | Frontend: Settings completion | Profile, security, notifications tabs |
| S4.10.1 | Task | Settings tab refactor | ProfileTab, OrgTab, SecurityTab, NotificationsTab |
| S4.10.2 | Task | PasswordChangeForm + MFASetup + SessionList | Security components |
| S4.10.3 | Task | ExportMenu component | CSV/PDF/Excel dropdown |
| S4.10.4 | Task | Settings tests | tests/unit/components/PasswordChangeForm.test.tsx |
| S4.11 | Story | E2E + performance + OWASP tests | Full suite |
| S4.11.1 | Task | E2E emissions tests | tests/e2e/emissions.spec.ts |
| S4.11.2 | Task | E2E reports tests | tests/e2e/reports.spec.ts |
| S4.11.3 | Task | E2E admin tests | tests/e2e/admin.spec.ts |
| S4.11.4 | Task | OWASP bulk upload tests | tests/security/owasp-bulk-upload.test.ts |
| S4.11.5 | Task | Performance tests | tests/performance/emissions-load.test.ts |
