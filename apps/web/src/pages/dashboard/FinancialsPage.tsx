import { useState, useEffect, FormEvent } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useFinancials, useUpsertFinancials } from '../../hooks/useFinancials';

/**
 * FLOW-REWORK / Sprint 5 — organisational financials page.
 * Step 4 in the dashboard NextStepsWidget journey.
 *
 * Captures:
 *   - Fiscal year + start month + currency
 *   - Annual revenue, total assets
 *   - Employee + contractor counts
 *   - Industry sector + reporting scope (standalone | consolidated)
 *
 * Drives BRSR P9, CSRD ESRS-2 entity-level disclosures, and the
 * emissions-intensity dashboard KPI (tCO2e per ₹revenue).
 */

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'SGD', 'JPY'] as const;
const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April (default — India FY)' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export function FinancialsPage() {
  const { data, isLoading } = useFinancials();
  const upsert = useUpsertFinancials();

  const initial = data?.data;
  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());
  const [fiscalYearStartMonth, setStartMonth] = useState<number>(4);
  const [currency, setCurrency] = useState<string>('INR');
  const [annualRevenue, setAnnualRevenue] = useState<string>('');
  const [totalAssets, setTotalAssets] = useState<string>('');
  const [employeeCount, setEmployeeCount] = useState<string>('');
  const [contractorCount, setContractorCount] = useState<string>('');
  const [industrySector, setIndustrySector] = useState<string>('');
  const [reportingScope, setReportingScope] = useState<'standalone' | 'consolidated'>(
    'standalone',
  );
  const [notes, setNotes] = useState<string>('');
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!initial) return;
    setFiscalYear(initial.fiscalYear);
    setStartMonth(initial.fiscalYearStartMonth);
    setCurrency(initial.currency);
    setAnnualRevenue(initial.annualRevenue ?? '');
    setTotalAssets(initial.totalAssets ?? '');
    setEmployeeCount(initial.employeeCount?.toString() ?? '');
    setContractorCount(initial.contractorCount?.toString() ?? '');
    setIndustrySector(initial.industrySector ?? '');
    setReportingScope(initial.reportingScope);
    setNotes(initial.notes ?? '');
  }, [initial]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await upsert.mutateAsync({
      fiscalYear,
      fiscalYearStartMonth,
      currency,
      annualRevenue: annualRevenue ? Number(annualRevenue) : undefined,
      totalAssets: totalAssets ? Number(totalAssets) : undefined,
      employeeCount: employeeCount ? Number(employeeCount) : undefined,
      contractorCount: contractorCount ? Number(contractorCount) : undefined,
      industrySector: industrySector || undefined,
      reportingScope,
      notes: notes || undefined,
    });
    setSavedAt(new Date());
  };

  if (isLoading) return <div style={{ padding: '2rem' }}>Loading…</div>;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '900px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Organisational financials
      </h1>
      <p style={{ color: 'var(--text-tertiary)', marginBottom: '1.5rem' }}>
        Step 4 of the setup journey. These dimensions drive intensity-based emission KPIs and feed
        BRSR P9 + CSRD ESRS-2 entity-level disclosures. Editable any time.
      </p>

      <Card padding="lg">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Row>
            <Field label="Fiscal year">
              <input
                type="number"
                min={2000}
                max={2100}
                value={fiscalYear}
                onChange={(e) => setFiscalYear(Number(e.target.value))}
                required
                style={inputStyle}
              />
            </Field>
            <Field label="Fiscal year starts">
              <select
                value={fiscalYearStartMonth}
                onChange={(e) => setStartMonth(Number(e.target.value))}
                style={inputStyle}
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reporting currency">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={inputStyle}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </Row>

          <Row>
            <Field label={`Annual revenue (${currency})`}>
              <input
                type="number"
                step="0.01"
                min="0"
                value={annualRevenue}
                onChange={(e) => setAnnualRevenue(e.target.value)}
                placeholder="e.g. 50000000"
                style={inputStyle}
              />
            </Field>
            <Field label={`Total assets (${currency})`}>
              <input
                type="number"
                step="0.01"
                min="0"
                value={totalAssets}
                onChange={(e) => setTotalAssets(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </Row>

          <Row>
            <Field label="Employee count (FTE)">
              <input
                type="number"
                min="0"
                value={employeeCount}
                onChange={(e) => setEmployeeCount(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Contractor count">
              <input
                type="number"
                min="0"
                value={contractorCount}
                onChange={(e) => setContractorCount(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </Row>

          <Field label="Industry sector (optional override)">
            <input
              type="text"
              maxLength={100}
              value={industrySector}
              onChange={(e) => setIndustrySector(e.target.value)}
              placeholder="e.g. Manufacturing — Cement"
              style={inputStyle}
            />
          </Field>

          <Field label="Reporting scope">
            <select
              value={reportingScope}
              onChange={(e) => setReportingScope(e.target.value as 'standalone' | 'consolidated')}
              style={inputStyle}
            >
              <option value="standalone">Standalone (this entity only)</option>
              <option value="consolidated">Consolidated (this entity + subsidiaries)</option>
            </select>
          </Field>

          <Field label="Notes (optional)">
            <textarea
              maxLength={1000}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. revenue figure unaudited; updated post Q4 close"
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Button type="submit" disabled={upsert.isPending}>
              {upsert.isPending ? 'Saving…' : initial ? 'Update financials' : 'Save financials'}
            </Button>
            {savedAt && (
              <span style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: 600 }}>
                ✓ Saved at {savedAt.toLocaleTimeString()}
              </span>
            )}
            {upsert.isError && (
              <span style={{ fontSize: '0.875rem', color: '#dc2626' }}>
                {(() => {
                  const e = upsert.error as { message?: string; status?: number } | null;
                  if (e?.status === 412) return 'Your organisation is awaiting Aurex-admin approval. Reads and settings are unrestricted; this gate clears the moment your registration is approved.';
                  if (e?.status === 403) return 'You don\'t have permission to update financials. Need to be ORG_ADMIN+. If you just registered, log out and back in to refresh your role.';
                  return e?.message ?? 'Save failed — check the form values above.';
                })()}
              </span>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderRadius: '0.375rem',
  border: '1px solid var(--border-primary)',
  fontSize: '0.875rem',
  backgroundColor: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  width: '100%',
};
