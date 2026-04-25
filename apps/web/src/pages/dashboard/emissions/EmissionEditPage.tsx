import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import {
  useEmission,
  useUpdateEmission,
  type EmissionEntry,
} from '../../../hooks/useEmissions';
import { useToast } from '../../../contexts/ToastContext';

/**
 * AAT-WORKFLOW (Wave 9a): edit form for an existing emission record.
 *
 * Backend gate: emissions are only mutable while status ∈ {DRAFT, REJECTED}.
 * The frontend mirrors that — if the record is PENDING or VERIFIED we render
 * a read-only banner pointing the user back to the detail view.
 *
 * Form shape mirrors EmissionsDataEntry (the create form): scope/category/
 * source/period are top-level columns, while emissionFactor / activityValue
 * / activityUnit / dataQuality / notes live in `metadata` so we don't need
 * a schema migration. The computed CO2e is recomputed on every save so the
 * `value` column stays consistent.
 */

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

function readMetaString(meta: EmissionEntry['metadata'], key: string): string {
  if (!meta) return '';
  const v = (meta as Record<string, unknown>)[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return '';
}

function toIsoDate(value: string): string {
  // The API returns full ISO timestamps; <input type="date"> wants YYYY-MM-DD.
  if (!value) return '';
  return value.length >= 10 ? value.slice(0, 10) : value;
}

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

export function EmissionEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const { data, isLoading, isError, error } = useEmission(id);
  const updateEmission = useUpdateEmission();

  const record = data?.data;

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

  // Prefill once the record loads.
  useEffect(() => {
    if (!record) return;
    setScope(record.scope);
    setCategory(record.category);
    setSource(record.source);
    setEmissionFactor(readMetaString(record.metadata, 'emissionFactor'));
    setActivityValue(readMetaString(record.metadata, 'activityValue'));
    setUnit(readMetaString(record.metadata, 'activityUnit') || record.unit);
    setPeriodStart(toIsoDate(record.periodStart));
    setPeriodEnd(toIsoDate(record.periodEnd));
    setDataQuality(readMetaString(record.metadata, 'dataQuality'));
    setNotes(readMetaString(record.metadata, 'notes'));
  }, [record]);

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
    if (periodStart && periodEnd && periodEnd <= periodStart)
      errs.periodEnd = 'End date must be after start date';
    if (!dataQuality) errs.dataQuality = 'Data quality is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [scope, category, source, emissionFactor, activityValue, unit, periodStart, periodEnd, dataQuality]);

  const handleSubmit = useCallback(async () => {
    if (!id || !validate()) return;
    try {
      await updateEmission.mutateAsync({
        id,
        scope: scope as EmissionEntry['scope'],
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
      toast.success('Emission entry updated');
      navigate(`/emissions/${id}`);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to update entry. Please try again.');
    }
  }, [id, validate, updateEmission, scope, category, source, emissionFactor, activityValue, unit, calculatedCO2e, periodStart, periodEnd, dataQuality, notes, toast, navigate]);

  const isLocked = record && record.status !== 'DRAFT' && record.status !== 'REJECTED';

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate(`/emissions/${id}`)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: '0.8125rem',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            marginBottom: '0.5rem',
          }}
        >
          ← Back to detail
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          Edit Emission
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          Updates are only allowed while the record is Draft or Rejected.
        </p>
      </div>

      {isLoading && (
        <Card padding="lg">
          <p style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</p>
        </Card>
      )}

      {isError && (
        <Card padding="lg">
          <div style={{ textAlign: 'center', color: '#dc2626' }}>
            <p style={{ fontWeight: 600 }}>Failed to load this entry</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
              {(error as Error)?.message ?? 'Please try again.'}
            </p>
          </div>
        </Card>
      )}

      {isLocked && (
        <Card padding="lg">
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              This entry is locked
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginBottom: '1rem' }}>
              Status is <strong>{record!.status}</strong>. Edits are only allowed while a record is Draft or Rejected.
            </p>
            <Button variant="outline" onClick={() => navigate(`/emissions/${id}`)}>
              View Detail
            </Button>
          </div>
        </Card>
      )}

      {record && !isLocked && (
        <Card padding="lg">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <Select
              label="Scope"
              value={scope}
              onChange={(val) => {
                setScope(val);
                setCategory('');
              }}
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

            <Input
              label="Source Name"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. Fleet Vehicles - Diesel"
              error={errors.source}
            />
            <Input
              label="Emission Factor"
              value={emissionFactor}
              onChange={(e) => setEmissionFactor(e.target.value)}
              placeholder="kgCO2e per unit"
              error={errors.emissionFactor}
            />

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
              label="Activity Unit"
              value={unit}
              onChange={setUnit}
              options={UNIT_OPTIONS}
              placeholder="Select unit..."
              error={errors.unit}
            />

            <div style={{ gridColumn: '1 / -1' }}>
              <span
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  marginBottom: '0.375rem',
                }}
              >
                Calculated CO2e
              </span>
              <div
                style={{
                  padding: '0.625rem 0.875rem',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  color: '#1a5d3d',
                  backgroundColor: 'rgba(26, 93, 61, 0.06)',
                  border: '1.5px solid var(--border-input)',
                  borderRadius: '0.5rem',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {calculatedCO2e ? `${calculatedCO2e} tCO2e` : 'Enter activity value and emission factor'}
              </div>
            </div>

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
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              paddingTop: '1.5rem',
              marginTop: '1.5rem',
              borderTop: '1px solid var(--border-primary)',
            }}
          >
            <Button variant="outline" onClick={() => navigate(`/emissions/${id}`)}>
              Cancel
            </Button>
            <Button loading={updateEmission.isPending} onClick={handleSubmit}>
              Save Changes
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
