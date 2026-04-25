import { useEffect, useMemo, useState } from 'react';
import {
  usePrinciples,
  useBrsrIndicators,
  useBrsrResponses,
  useUpsertBrsrResponse,
  type BrsrIndicator,
} from '../../../hooks/useBrsr';
import { IndicatorField } from '../../../components/brsr/IndicatorField';
import { useToast } from '../../../contexts/ToastContext';

// Default BRSR fiscal year options (India: Apr-Mar).
function getFiscalYears(): string[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const inCurrentFy = now.getMonth() >= 3; // April onward
  const startYear = inCurrentFy ? currentYear : currentYear - 1;
  return [0, -1, -2].map((offset) => {
    const y = startYear + offset;
    return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  });
}

type Section = 'SECTION_A' | 'SECTION_B' | 'SECTION_C';

const SECTION_LABELS: Record<Section, string> = {
  SECTION_A: 'A · General Disclosures',
  SECTION_B: 'B · Management & Process',
  SECTION_C: 'C · Principle-wise Performance',
};

export function BRSRBuilderPage() {
  const fiscalYears = useMemo(getFiscalYears, []);
  const [fiscalYear, setFiscalYear] = useState(fiscalYears[0] ?? '');
  const [activeView, setActiveView] = useState<'SECTION_A' | 'SECTION_B' | string>('SECTION_A');
  // activeView is either a section code OR a principle id

  const { data: principlesData, isLoading: loadingPrinciples } = usePrinciples();
  const principles = principlesData?.data ?? [];

  // Select a default view once principles arrive
  useEffect(() => {
    if (principles.length > 0 && activeView === 'SECTION_A') {
      // keep on SECTION_A by default
    }
  }, [principles.length, activeView]);

  // Fetch indicators for the active view
  const indicatorsQuery = useMemo(() => {
    if (activeView === 'SECTION_A') return { section: 'SECTION_A' as Section };
    if (activeView === 'SECTION_B') return { section: 'SECTION_B' as Section };
    // otherwise treat it as a principle id → Section C indicators for that principle
    return { principleId: activeView };
  }, [activeView]);

  const { data: indicatorsData, isLoading: loadingIndicators } = useBrsrIndicators(indicatorsQuery);
  const indicators = indicatorsData?.data ?? [];

  // Responses for the fiscal year
  const { data: responsesData } = useBrsrResponses({ fiscalYear });
  const responseMap = useMemo(() => {
    const rows = responsesData?.data ?? [];
    const m = new Map<string, (typeof rows)[number]>();
    for (const r of rows) m.set(r.indicatorId, r);
    return m;
  }, [responsesData]);

  const upsert = useUpsertBrsrResponse();
  const { success: toastSuccess, error: toastError } = useToast();

  // Completion % across indicators currently visible
  const completion = useMemo(() => {
    if (indicators.length === 0) return 0;
    const answered = indicators.filter((i) => {
      const r = responseMap.get(i.id);
      return r && typeof r.value !== 'undefined' && r.value !== null && String(r.value).trim().length > 0;
    }).length;
    return Math.round((answered / indicators.length) * 100);
  }, [indicators, responseMap]);

  const handleSave = async (indicatorId: string, data: { value: string; notes: string }) => {
    // Try to parse JSON; if parse fails, send as plain string.
    let parsed: unknown = data.value;
    const trimmed = data.value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try { parsed = JSON.parse(trimmed); } catch { /* keep string */ }
    } else if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      parsed = Number(trimmed);
    }

    try {
      await upsert.mutateAsync({
        indicatorId,
        fiscalYear,
        value: parsed,
        notes: data.notes.trim() || undefined,
      });
      toastSuccess('Saved');
    } catch (e) {
      toastError((e as Error).message);
      throw e;
    }
  };

  // Group visible indicators by type (Essential/Leadership) for Section C
  const grouped = useMemo(() => {
    const essential: BrsrIndicator[] = [];
    const leadership: BrsrIndicator[] = [];
    for (const i of indicators) {
      (i.indicatorType === 'LEADERSHIP' ? leadership : essential).push(i);
    }
    return { essential, leadership };
  }, [indicators]);

  const visibleTitle = activeView === 'SECTION_A' || activeView === 'SECTION_B'
    ? SECTION_LABELS[activeView as Section]
    : (() => {
        const p = principles.find((x) => x.id === activeView);
        return p ? `Principle ${p.number} · ${p.title}` : 'Principle';
      })();

  return (
    <div style={{ display: 'flex', gap: '1.5rem', padding: '1.5rem', maxWidth: '1300px', margin: '0 auto' }}>
      {/* ── Left rail: navigation ─────────────────────────────────── */}
      <aside style={{
        width: '260px', flexShrink: 0,
        position: 'sticky', top: '5rem', alignSelf: 'flex-start',
        maxHeight: 'calc(100vh - 6rem)', overflowY: 'auto',
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Fiscal Year
          </label>
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            style={{
              width: '100%', padding: '0.4375rem 0.625rem',
              borderRadius: '0.5rem', border: '1px solid var(--border-primary)',
              backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)',
              fontSize: '0.875rem', fontFamily: 'inherit',
            }}
          >
            {fiscalYears.map((fy) => (
              <option key={fy} value={fy}>{fy}</option>
            ))}
          </select>
        </div>

        {/* Sections A & B */}
        <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Sections
        </p>
        {(['SECTION_A', 'SECTION_B'] as Section[]).map((s) => (
          <NavButton key={s} active={activeView === s} onClick={() => setActiveView(s)}>
            {SECTION_LABELS[s]}
          </NavButton>
        ))}

        {/* Principles (Section C) */}
        <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-tertiary)', margin: '1rem 0 0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          C · Principles
        </p>
        {loadingPrinciples ? (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', padding: '0.5rem' }}>Loading…</p>
        ) : principles.length === 0 ? (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', padding: '0.5rem' }}>
            No principles seeded yet.
          </p>
        ) : principles
            .slice()
            .sort((a, b) => a.number - b.number)
            .map((p) => (
              <NavButton key={p.id} active={activeView === p.id} onClick={() => setActiveView(p.id)}>
                <span style={{ fontWeight: 700, marginRight: '0.5rem' }}>P{p.number}</span>
                <span style={{ fontSize: '0.8125rem' }}>{p.title}</span>
              </NavButton>
            ))}
      </aside>

      {/* ── Main: indicators ──────────────────────────────────────── */}
      <main style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
            marginBottom: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              BRSR Builder
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Respond to BRSR indicators for your organisation. Answers are saved per fiscal year.
            </p>
          </div>
          {/*
            AAT-WORKFLOW (Wave 9a): explicit Generate PDF affordance with
            disabled state + tooltip. PDF / XBRL output isn't wired yet
            (Wave 10) — but rendering the button as disabled tells the user
            the path exists rather than leaving them hunting for it.
          */}
          <button
            type="button"
            disabled
            title="Coming soon — PDF / XBRL export wired in Wave 10"
            style={{
              fontFamily: 'inherit',
              fontSize: '0.8125rem',
              fontWeight: 600,
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1.5px solid var(--border-primary)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-tertiary)',
              cursor: 'not-allowed',
              opacity: 0.7,
            }}
          >
            Generate PDF
          </button>
        </div>

        {/* Section header + progress */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.875rem 1.25rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
          borderRadius: '0.75rem 0.75rem 0 0',
          borderBottom: 'none',
        }}>
          <div>
            <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {visibleTitle}
            </span>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: '0.125rem 0 0' }}>
              FY {fiscalYear} · {indicators.length} indicator{indicators.length === 1 ? '' : 's'}
            </p>
          </div>
          <div style={{ minWidth: '160px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
              <span>Completion</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{completion}%</span>
            </div>
            <div style={{ height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${completion}%`, backgroundColor: '#10b981', transition: 'width 300ms' }} />
            </div>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
          borderRadius: '0 0 0.75rem 0.75rem',
        }}>
          {loadingIndicators ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              Loading indicators…
            </p>
          ) : indicators.length === 0 ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
              No indicators defined for this section yet.
            </p>
          ) : (
            <>
              {grouped.essential.length > 0 && (
                <>
                  <GroupHeader label="Essential" color="#3b82f6" count={grouped.essential.length} />
                  {grouped.essential.map((ind) => (
                    <IndicatorField
                      key={ind.id}
                      indicator={ind}
                      response={responseMap.get(ind.id)}
                      onSave={(d) => handleSave(ind.id, d)}
                      isSaving={upsert.isPending}
                    />
                  ))}
                </>
              )}
              {grouped.leadership.length > 0 && (
                <>
                  <GroupHeader label="Leadership" color="#8b5cf6" count={grouped.leadership.length} />
                  {grouped.leadership.map((ind) => (
                    <IndicatorField
                      key={ind.id}
                      indicator={ind}
                      response={responseMap.get(ind.id)}
                      onSave={(d) => handleSave(ind.id, d)}
                      isSaving={upsert.isPending}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '0.5rem 0.625rem', borderRadius: '0.375rem',
        border: 'none', cursor: 'pointer',
        background: active ? 'rgba(26,93,61,0.1)' : 'none',
        color: active ? '#1a5d3d' : 'var(--text-secondary)',
        fontWeight: active ? 600 : 500,
        fontFamily: 'inherit', fontSize: '0.8125rem',
        marginBottom: '0.25rem',
      }}
    >
      {children}
    </button>
  );
}

function GroupHeader({ label, color, count }: { label: string; color: string; count: number }) {
  return (
    <div style={{
      padding: '0.625rem 1.25rem',
      backgroundColor: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-primary)',
      fontSize: '0.75rem', fontWeight: 700,
      color: 'var(--text-secondary)',
      textTransform: 'uppercase', letterSpacing: '0.05em',
      display: 'flex', alignItems: 'center', gap: '0.5rem',
    }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
      {label}
      <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--text-tertiary)' }}>{count}</span>
    </div>
  );
}
