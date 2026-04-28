import { useState, useMemo, useCallback } from 'react';
import { useResolvedMapping } from '../../../hooks/useCategoryMapping';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { useCreateEmission } from '../../../hooks/useEmissions';
import type { Scope } from '../../../hooks/useBaselines';
import { useToast } from '../../../contexts/ToastContext';

/* ─── Scope / Category Mappings ─── */

const SCOPE_OPTIONS = [
  { value: 'SCOPE_1', label: 'Scope 1 - Direct' },
  { value: 'SCOPE_2', label: 'Scope 2 - Energy' },
  { value: 'SCOPE_3', label: 'Scope 3 - Value Chain' },
];

const CATEGORY_MAP: Record<string, { value: string; label: string }[]> = {
  SCOPE_1: [
    { value: 'stationary_combustion', label: 'Stationary Combustion' },
    { value: 'mobile_combustion', label: 'Mobile Combustion' },
    { value: 'process_emissions', label: 'Process Emissions' },
    { value: 'fugitive_emissions', label: 'Fugitive Emissions' },
  ],
  SCOPE_2: [
    { value: 'purchased_electricity', label: 'Purchased Electricity' },
    { value: 'purchased_steam', label: 'Purchased Steam' },
    { value: 'purchased_heating', label: 'Purchased Heating' },
    { value: 'purchased_cooling', label: 'Purchased Cooling' },
  ],
  SCOPE_3: [
    { value: 'purchased_goods', label: 'Purchased Goods' },
    { value: 'capital_goods', label: 'Capital Goods' },
    { value: 'fuel_energy', label: 'Fuel & Energy' },
    { value: 'transportation', label: 'Transportation' },
    { value: 'waste', label: 'Waste' },
    { value: 'business_travel', label: 'Business Travel' },
    { value: 'employee_commuting', label: 'Employee Commuting' },
    { value: 'leased_assets', label: 'Leased Assets' },
  ],
};

const UNIT_OPTIONS = [
  { value: 'tCO2e', label: 'tCO2e' },
  { value: 'kgCO2e', label: 'kgCO2e' },
  { value: 'MWh', label: 'MWh' },
  { value: 'litres', label: 'Litres' },
  { value: 'km', label: 'km' },
];

const QUALITY_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

/* Predefined emission factors (normally from API) */
const EMISSION_FACTORS = [
  { value: '2.68', label: 'Natural Gas - 2.68 kgCO2e/m3' },
  { value: '2.31', label: 'Diesel - 2.31 kgCO2e/litre' },
  { value: '2.10', label: 'Petrol/Gasoline - 2.10 kgCO2e/litre' },
  { value: '0.42', label: 'Grid Electricity (Global Avg) - 0.42 kgCO2e/kWh' },
  { value: '0.23', label: 'Grid Electricity (EU Avg) - 0.23 kgCO2e/kWh' },
  { value: '0.91', label: 'Grid Electricity (US Avg) - 0.91 kgCO2e/kWh' },
  { value: '0.18', label: 'Short-haul Flight - 0.18 kgCO2e/pkm' },
  { value: '0.11', label: 'Long-haul Flight - 0.11 kgCO2e/pkm' },
  { value: '0.17', label: 'Employee Commuting (Car) - 0.17 kgCO2e/km' },
  { value: '1.54', label: 'Refrigerant R-410A - 1,540 kgCO2e/kg' },
];

/* ─── Styles ─── */

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '1.25rem',
};

const fullWidthStyle: React.CSSProperties = {
  gridColumn: '1 / -1',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.75rem',
  paddingTop: '1.5rem',
  borderTop: '1px solid var(--border-primary)',
  marginTop: '1.5rem',
};

const computedBoxStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.375rem',
};

const computedLabelStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: 'var(--text-primary)',
};

const computedValueStyle: React.CSSProperties = {
  padding: '0.625rem 0.875rem',
  fontSize: '0.9375rem',
  fontWeight: 700,
  color: '#1a5d3d',
  backgroundColor: 'rgba(26, 93, 61, 0.06)',
  border: '1.5px solid var(--border-input)',
  borderRadius: '0.5rem',
  fontVariantNumeric: 'tabular-nums',
};

/* ─── Component ─── */

interface FormErrors {
  scope?: string;
  category?: string;
  source?: string;
  emissionFactor?: string;
  activityValue?: string;
  unit?: string;
  periodStart?: string;
  periodEnd?: string;
  dataQuality?: string;
}

export function EmissionsDataEntry() {
  const navigate = useNavigate();
  const toast = useToast();
  const createEmission = useCreateEmission();

  /* Form state */
  const [scope, setScope] = useState('');
  const [category, setCategory] = useState('');
  const [source, setSource] = useState('');
  const [emissionFactor, setEmissionFactor] = useState('');
  const [activityValue, setActivityValue] = useState('');
  const [unit, setUnit] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [dataQuality, setDataQuality] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  /* Derived */
  const categoryOptions = useMemo(
    () => (scope ? CATEGORY_MAP[scope] || [] : []),
    [scope],
  );

  const calculatedCO2e = useMemo(() => {
    const val = parseFloat(activityValue);
    const factor = parseFloat(emissionFactor);
    if (!isNaN(val) && !isNaN(factor) && val > 0 && factor > 0) {
      return (val * factor).toFixed(4);
    }
    return '';
  }, [activityValue, emissionFactor]);

  /* When scope changes, reset category */
  const handleScopeChange = useCallback((val: string) => {
    setScope(val);
    setCategory('');
  }, []);

  /* Validation */
  const validate = useCallback((): boolean => {
    const errs: FormErrors = {};
    if (!scope) errs.scope = 'Scope is required';
    if (!category) errs.category = 'Category is required';
    if (!source.trim()) errs.source = 'Source name is required';
    if (!emissionFactor) errs.emissionFactor = 'Emission factor is required';
    const val = parseFloat(activityValue);
    if (!activityValue || isNaN(val) || val <= 0) errs.activityValue = 'Value must be greater than 0';
    if (!unit) errs.unit = 'Unit is required';
    if (!periodStart) errs.periodStart = 'Start date is required';
    if (!periodEnd) errs.periodEnd = 'End date is required';
    if (periodStart && periodEnd && periodEnd <= periodStart) errs.periodEnd = 'End date must be after start date';
    if (!dataQuality) errs.dataQuality = 'Data quality is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [scope, category, source, emissionFactor, activityValue, unit, periodStart, periodEnd, dataQuality]);

  /* Submit — backend stores the computed CO2e as `value` (tCO2e).
     Form-only fields (emission factor, raw activity, unit, data quality, notes)
     go into `metadata` so the schema doesn't need to change. */
  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    try {
      await createEmission.mutateAsync({
        scope: scope as Scope,
        category,
        source: source.trim(),
        value: parseFloat(calculatedCO2e || '0'),
        unit: 'tCO2e',
        periodStart,
        periodEnd,
        metadata: {
          emissionFactor,
          activityValue: parseFloat(activityValue),
          activityUnit: unit,
          dataQuality,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      });
      toast.success('Emission entry saved successfully');
      navigate('/emissions');
    } catch (err) {
      const e = err as { message?: string; status?: number } | null;
      if (e?.status === 412) {
        toast.error(
          'Your organisation is awaiting Aurex-admin approval. Emission writes resume the moment your registration is approved.',
        );
      } else if (e?.status === 403) {
        toast.error(
          'You don\'t have permission to log emissions. Need MAKER, CHECKER, APPROVER, MANAGER, ORG_ADMIN, or SUPER_ADMIN org role.',
        );
      } else if (e?.status === 429) {
        toast.error('Monthly emission entry quota reached. Upgrade your plan in Billing.');
      } else if (e?.message) {
        toast.error(e.message);
      } else {
        toast.error('Failed to save emission entry. Please try again.');
      }
    }
  }, [validate, createEmission, scope, category, source, emissionFactor, activityValue, unit, calculatedCO2e, periodStart, periodEnd, dataQuality, notes, toast, navigate]);

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          Record Emission
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          Add a new greenhouse gas emission entry to your inventory.
        </p>
      </div>

      <Card padding="lg">
        <div style={gridStyle}>
          {/* Row 1: Scope + Category */}
          <Select
            label="Scope"
            value={scope}
            onChange={handleScopeChange}
            options={SCOPE_OPTIONS}
            placeholder="Select scope..."
            error={errors.scope}
          />
          <Select
            label="Category"
            value={category}
            onChange={setCategory}
            options={categoryOptions}
            placeholder={scope ? 'Select category...' : 'Select scope first'}
            disabled={!scope}
            error={errors.category}
          />

          {/* Framework indicator mapping — resolved from category */}
          <MappingBadge scope={scope} category={category} />

          {/* Row 2: Source + Emission Factor */}
          <Input
            label="Source Name"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="e.g. Fleet Vehicles - Diesel"
            error={errors.source}
          />
          <Select
            label="Emission Factor"
            value={emissionFactor}
            onChange={setEmissionFactor}
            options={EMISSION_FACTORS}
            placeholder="Select emission factor..."
            error={errors.emissionFactor}
          />

          {/* Row 3: Activity Value + Unit + Calculated CO2e */}
          <Input
            label="Activity Value"
            type="number"
            value={activityValue}
            onChange={(e) => setActivityValue(e.target.value)}
            placeholder="0.00"
            min="0"
            step="any"
            error={errors.activityValue}
          />
          <Select
            label="Unit"
            value={unit}
            onChange={setUnit}
            options={UNIT_OPTIONS}
            placeholder="Select unit..."
            error={errors.unit}
          />
          <div style={{ ...fullWidthStyle, ...computedBoxStyle }}>
            <span style={computedLabelStyle}>Calculated CO2e</span>
            <div style={computedValueStyle}>
              {calculatedCO2e ? `${calculatedCO2e} tCO2e` : 'Enter activity value and select emission factor'}
            </div>
          </div>

          {/* Row 4: Period Start + End */}
          <Input
            label="Period Start"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            error={errors.periodStart}
          />
          <Input
            label="Period End"
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            error={errors.periodEnd}
          />

          {/* Row 5: Data Quality + Notes */}
          <Select
            label="Data Quality"
            value={dataQuality}
            onChange={setDataQuality}
            options={QUALITY_OPTIONS}
            placeholder="Select quality..."
            error={errors.dataQuality}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label
              htmlFor="notes"
              style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}
            >
              Notes (optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                fontSize: '0.9375rem',
                fontFamily: 'inherit',
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-input)',
                border: '1.5px solid var(--border-input)',
                borderRadius: '0.5rem',
                resize: 'vertical',
                transition: 'all 150ms ease',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <Button
            variant="outline"
            onClick={() => navigate('/emissions')}
          >
            Cancel
          </Button>
          <Button
            loading={createEmission.isPending}
            onClick={handleSubmit}
          >
            Save Entry
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ─── Category → Framework indicator badge ──────────────────────────────

function MappingBadge({ scope, category }: { scope: string; category: string }) {
  const { data, isLoading } = useResolvedMapping(scope || null, category || null);
  if (!scope || !category) return null;

  const mapping = data?.data;

  if (isLoading) {
    return (
      <div style={mappingBadgeStyle}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Resolving indicators…</span>
      </div>
    );
  }

  if (!mapping) {
    return (
      <div style={{ ...mappingBadgeStyle, borderColor: 'rgba(245,158,11,0.3)', backgroundColor: 'rgba(245,158,11,0.04)' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f59e0b' }}>No mapping configured</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
          This entry won't roll up into any framework report. Ask your admin to configure a mapping under Reference Data.
        </span>
      </div>
    );
  }

  return (
    <div style={mappingBadgeStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Rolls up to {mapping.esgIndicatorCodes.length + mapping.brsrIndicatorCodes.length} indicator{mapping.esgIndicatorCodes.length + mapping.brsrIndicatorCodes.length === 1 ? '' : 's'}
        </span>
        {!mapping.isDefault && (
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '0.1rem 0.4rem', borderRadius: '0.25rem', backgroundColor: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>
            Org override
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
        {mapping.esgIndicatorCodes.map((code) => (
          <span key={`esg-${code}`} style={codeChipStyle('#1a5d3d')}>{code}</span>
        ))}
        {mapping.brsrIndicatorCodes.map((code) => (
          <span key={`brsr-${code}`} style={codeChipStyle('#0ea5e9')}>{code}</span>
        ))}
      </div>
    </div>
  );
}

const mappingBadgeStyle: React.CSSProperties = {
  gridColumn: '1 / -1',
  padding: '0.625rem 0.875rem',
  backgroundColor: 'rgba(16,185,129,0.04)',
  border: '1px solid rgba(16,185,129,0.2)',
  borderRadius: '0.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
};

function codeChipStyle(color: string): React.CSSProperties {
  return {
    fontSize: '0.6875rem',
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
    fontWeight: 600,
    padding: '0.1rem 0.45rem',
    borderRadius: '0.25rem',
    backgroundColor: `${color}15`,
    color,
    border: `1px solid ${color}30`,
  };
}
