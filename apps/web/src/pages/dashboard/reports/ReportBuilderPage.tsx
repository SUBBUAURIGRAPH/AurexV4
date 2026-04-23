import { useState, type CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import {
  useGenerateReport,
  useReportStatus,
  downloadReportUrl,
  ReportType,
} from '../../../hooks/useReports';
import { useToast } from '../../../contexts/ToastContext';
import type { Scope } from '../../../hooks/useBaselines';

/* ============================================
   Report type metadata
   ============================================ */

const VALID_TYPES: ReportType[] = ['ghg', 'tcfd', 'cdp', 'custom'];

const typeLabels: Record<ReportType, string> = {
  ghg: 'GHG Protocol',
  tcfd: 'TCFD',
  cdp: 'CDP',
  custom: 'Custom',
};

const CURRENT_YEAR = new Date().getFullYear();

/* ============================================
   Component
   ============================================ */

export function ReportBuilderPage() {
  const { type: rawType = 'ghg' } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const generateReport = useGenerateReport();

  const type: ReportType = VALID_TYPES.includes(rawType as ReportType)
    ? (rawType as ReportType)
    : 'custom';
  const label = typeLabels[type];

  /* ----- Form state ----- */
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [scopes, setScopes] = useState<Record<Scope, boolean>>({
    SCOPE_1: true,
    SCOPE_2: true,
    SCOPE_3: false,
  });
  const [includeSubs, setIncludeSubs] = useState(false);

  /* ----- Generation tracking ----- */
  const [generatedId, setGeneratedId] = useState('');
  const { data: statusData } = useReportStatus(generatedId);
  const reportStatus = statusData?.data?.status;
  const isTerminal = reportStatus === 'COMPLETED' || reportStatus === 'FAILED';
  const isPolling = !!generatedId && !isTerminal;

  /* ----- Submit ----- */
  async function handleSubmit() {
    const selectedScopes = (Object.keys(scopes) as Scope[]).filter((s) => scopes[s]);

    if (selectedScopes.length === 0) {
      toast.warning('Please select at least one scope.');
      return;
    }

    try {
      const result = await generateReport.mutateAsync({
        type,
        year: parseInt(year, 10),
        scopes: selectedScopes,
        includeSubsidiaries: includeSubs,
      });

      const id = result?.data?.id ?? '';
      if (id) {
        setGeneratedId(id);
      }
      toast.success('Report generation started.');
    } catch {
      toast.error('Failed to generate report. Please try again.');
    }
  }

  /* ----- Styles ----- */
  const checkboxStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
  };

  const inputCheckboxStyle: CSSProperties = {
    width: '1rem',
    height: '1rem',
    accentColor: '#1a5d3d',
    cursor: 'pointer',
  };

  const scopeItems: { key: Scope; label: string }[] = [
    { key: 'SCOPE_1', label: 'Scope 1' },
    { key: 'SCOPE_2', label: 'Scope 2' },
    { key: 'SCOPE_3', label: 'Scope 3' },
  ];

  return (
    <div style={{ maxWidth: '720px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate('/reports')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            background: 'none',
            border: 'none',
            color: 'var(--text-tertiary)',
            fontSize: '0.8125rem',
            cursor: 'pointer',
            padding: 0,
            marginBottom: '0.75rem',
            fontFamily: 'inherit',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Reports
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          Generate {label} Report
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          Configure and generate your {label} report.
        </p>
      </div>

      {/* Generation progress banner */}
      {generatedId && (
        <Card padding="md" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isPolling && (
              <div style={{
                width: '1rem',
                height: '1rem',
                border: '2px solid var(--border-primary)',
                borderTop: '2px solid #1a5d3d',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
            )}
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {reportStatus === 'COMPLETED'
                  ? 'Report ready'
                  : reportStatus === 'FAILED'
                    ? 'Generation failed'
                    : 'Generating report...'}
              </span>
            </div>
            <Badge variant={
              reportStatus === 'COMPLETED' ? 'success' :
              reportStatus === 'FAILED' ? 'error' : 'warning'
            }>
              {reportStatus === 'COMPLETED' ? 'Completed' :
               reportStatus === 'FAILED' ? 'Failed' :
               reportStatus === 'GENERATING' ? 'Generating' : 'Queued'}
            </Badge>
            {reportStatus === 'COMPLETED' && (
              <Button
                size="sm"
                onClick={() => window.open(downloadReportUrl(generatedId), '_blank')}
              >
                Download
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Form */}
      <Card padding="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Reporting Year */}
          <Select
            label="Reporting Year"
            value={year}
            onChange={setYear}
            options={[
              { value: String(CURRENT_YEAR - 2), label: String(CURRENT_YEAR - 2) },
              { value: String(CURRENT_YEAR - 1), label: String(CURRENT_YEAR - 1) },
              { value: String(CURRENT_YEAR), label: String(CURRENT_YEAR) },
            ]}
          />

          {/* Scopes */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
            }}>
              Scopes to Include
            </label>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              {scopeItems.map((s) => (
                <label key={s.key} style={checkboxStyle}>
                  <input
                    type="checkbox"
                    checked={scopes[s.key]}
                    onChange={(e) => setScopes((prev) => ({ ...prev, [s.key]: e.target.checked }))}
                    style={inputCheckboxStyle}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          {/* Subsidiaries rollup */}
          <label style={checkboxStyle}>
            <input
              type="checkbox"
              checked={includeSubs}
              onChange={(e) => setIncludeSubs(e.target.checked)}
              style={inputCheckboxStyle}
            />
            Include subsidiaries (roll up emissions, baselines, and targets from child orgs)
          </label>

          {/* Submit */}
          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
            <Button
              onClick={handleSubmit}
              disabled={generateReport.isPending || isPolling}
            >
              {generateReport.isPending ? 'Starting...' : isPolling ? 'Generating...' : 'Generate Report'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/reports')}>
              Cancel
            </Button>
          </div>
        </div>
      </Card>

      {/* Spinner keyframes */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
