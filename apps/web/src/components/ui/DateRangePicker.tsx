import { useState, type CSSProperties } from 'react';

interface DateRange {
  from: string;
  to: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

type PresetKey = '30d' | '90d' | '1y' | 'all';

const presets: { key: PresetKey; label: string }[] = [
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: '1y', label: 'Last year' },
  { key: 'all', label: 'All time' },
];

function getPresetRange(key: PresetKey): DateRange {
  const to = new Date().toISOString().split('T')[0] || '';
  const from = new Date();
  switch (key) {
    case '30d':
      from.setDate(from.getDate() - 30);
      break;
    case '90d':
      from.setDate(from.getDate() - 90);
      break;
    case '1y':
      from.setFullYear(from.getFullYear() - 1);
      break;
    case 'all':
      return { from: '', to: '' };
  }
  return { from: from.toISOString().split('T')[0]!, to };
}

function detectActivePreset(value: DateRange): PresetKey | null {
  if (!value.from && !value.to) return 'all';
  for (const p of presets) {
    const range = getPresetRange(p.key);
    if (range.from === value.from && range.to === value.to) return p.key;
  }
  return null;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const activePreset = detectActivePreset(value);

  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  };

  const presetButtonStyle = (isActive: boolean): CSSProperties => ({
    padding: '0.375rem 0.75rem',
    fontSize: '0.8125rem',
    fontWeight: isActive ? 600 : 500,
    fontFamily: 'inherit',
    border: isActive ? '1.5px solid #1a5d3d' : '1.5px solid var(--border-secondary)',
    borderRadius: '0.375rem',
    backgroundColor: isActive ? 'rgba(26, 93, 61, 0.08)' : 'transparent',
    color: isActive ? '#1a5d3d' : 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    whiteSpace: 'nowrap',
  });

  const dateInputStyle: CSSProperties = {
    padding: '0.375rem 0.5rem',
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
    border: '1.5px solid var(--border-input)',
    borderRadius: '0.375rem',
    backgroundColor: 'var(--bg-input)',
    color: 'var(--text-primary)',
  };

  const handlePreset = (key: PresetKey) => {
    setShowCustom(false);
    onChange(getPresetRange(key));
  };

  return (
    <div style={containerStyle}>
      {presets.map((p) => (
        <button
          key={p.key}
          type="button"
          style={presetButtonStyle(activePreset === p.key && !showCustom)}
          onClick={() => handlePreset(p.key)}
        >
          {p.label}
        </button>
      ))}
      <button
        type="button"
        style={presetButtonStyle(showCustom)}
        onClick={() => setShowCustom(true)}
      >
        Custom
      </button>
      {showCustom && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <input
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            style={dateInputStyle}
          />
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>to</span>
          <input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            style={dateInputStyle}
          />
        </div>
      )}
    </div>
  );
}
