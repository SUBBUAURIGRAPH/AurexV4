import { useEffect, useState } from 'react';
import type { BrsrIndicator, BrsrResponse } from '../../hooks/useBrsr';

interface IndicatorFieldProps {
  indicator: BrsrIndicator;
  response: BrsrResponse | undefined;
  onSave: (data: { value: string; notes: string }) => Promise<void>;
  isSaving: boolean;
}

export function IndicatorField({ indicator, response, onSave, isSaving }: IndicatorFieldProps) {
  const initialValue =
    typeof response?.value === 'string'
      ? response.value
      : response?.value !== undefined && response?.value !== null
      ? JSON.stringify(response.value, null, 2)
      : '';

  const [value, setValue] = useState(initialValue);
  const [notes, setNotes] = useState(response?.notes ?? '');
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Reset state when the response row changes (e.g., fiscal year switch)
  useEffect(() => {
    setValue(initialValue);
    setNotes(response?.notes ?? '');
    setDirty(false);
  }, [response?.id, response?.fiscalYear, response?.notes, initialValue]);

  const handleSave = async () => {
    await onSave({ value, notes });
    setDirty(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const isAnswered = !!response && value.trim().length > 0;

  return (
    <div
      style={{
        padding: '1rem 1.25rem',
        borderTop: '1px solid var(--border-primary)',
        backgroundColor: isAnswered && !dirty ? 'rgba(16,185,129,0.03)' : 'transparent',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.625rem', marginBottom: '0.5rem' }}>
        <span
          style={{
            fontSize: '0.6875rem', fontWeight: 700,
            padding: '0.125rem 0.4375rem', borderRadius: '0.25rem',
            backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            whiteSpace: 'nowrap',
          }}
        >
          {indicator.code}
        </span>
        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
          {indicator.title}
        </span>
        {isAnswered && !dirty && (
          <span
            style={{
              marginLeft: 'auto', fontSize: '0.6875rem', fontWeight: 600,
              color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Answered
          </span>
        )}
      </div>

      {indicator.description && (
        <p style={{
          fontSize: '0.8125rem', color: 'var(--text-secondary)',
          margin: '0 0 0.75rem', lineHeight: 1.5,
        }}>
          {indicator.description}
        </p>
      )}

      {/* Value */}
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Response
      </label>
      <textarea
        value={value}
        onChange={(e) => { setValue(e.target.value); setDirty(true); }}
        rows={3}
        placeholder="Enter value, number, or structured JSON…"
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '0.5625rem 0.75rem',
          border: '1px solid var(--border-primary)',
          borderRadius: '0.5rem',
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          fontSize: '0.875rem', fontFamily: 'inherit',
          resize: 'vertical',
        }}
      />

      {/* Notes */}
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', margin: '0.625rem 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Notes (optional)
      </label>
      <textarea
        value={notes}
        onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
        rows={2}
        placeholder="Commentary, sources, or qualifications…"
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '0.5625rem 0.75rem',
          border: '1px solid var(--border-primary)',
          borderRadius: '0.5rem',
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          fontSize: '0.8125rem', fontFamily: 'inherit',
          resize: 'vertical',
        }}
      />

      {/* Save row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.625rem' }}>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
          {response?.updatedAt
            ? `Last saved ${new Date(response.updatedAt).toLocaleDateString()}`
            : 'Not saved yet'}
        </span>
        <button
          onClick={handleSave}
          disabled={!dirty || !value.trim() || isSaving}
          style={{
            padding: '0.375rem 0.875rem', borderRadius: '0.5rem',
            border: 'none', cursor: 'pointer',
            backgroundColor: justSaved ? '#10b981' : '#1a5d3d',
            color: '#fff', fontWeight: 600,
            fontSize: '0.8125rem', fontFamily: 'inherit',
            opacity: (!dirty || !value.trim() || isSaving) ? 0.45 : 1,
            transition: 'background 150ms',
          }}
        >
          {isSaving ? 'Saving…' : justSaved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </div>
  );
}
