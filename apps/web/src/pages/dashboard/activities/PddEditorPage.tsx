import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useActivity } from '../../../hooks/useActivities';
import {
  usePdd,
  useSubmitPdd,
  useUpsertPdd,
} from '../../../hooks/usePdd';

/**
 * AV4-335: PDD Editor skeleton.
 *
 * Ships tabs 1-3 functional today:
 *   1. Project info      — title, description, tech, host country (auto-filled from Activity)
 *   2. Boundaries        — GeoJSON textarea + file upload (no map library yet)
 *   3. Baseline          — narrative + methodology version auto-filled
 *
 * Tabs 4-9 rendered as "coming soon" placeholders with ticket links:
 *   4. Additionality              — AV4-335 (tab build-out)
 *   5. Monitoring plan summary    — AV4-335 (tab build-out)
 *   6. Leakage                    — AV4-335 (tab build-out)
 *   7. SD-Tool / SDGs             — AV4-337
 *   8. Stakeholder consultation   — AV4-335 (tab build-out)
 *   9. Attachments                — AV4-335 (tab build-out)
 *
 * Baseline tab has a forward pointer to AV4-336 for when the structured
 * `BaselineScenario` entity lands.
 *
 * Persistence: on blur of any tab 1-3 field we `PUT /pdds/:activityId` with
 * the full merged content. Once `submittedAt` is non-null, the form is
 * read-only (server returns 409 on write; we also disable locally to give
 * the correct UX).
 */

type TabKey =
  | 'project-info'
  | 'boundaries'
  | 'baseline'
  | 'additionality'
  | 'monitoring'
  | 'leakage'
  | 'sd-tool'
  | 'stakeholder'
  | 'attachments';

interface Tab {
  key: TabKey;
  label: string;
  ticket?: string;
  comingSoon?: boolean;
}

const TABS: Tab[] = [
  { key: 'project-info', label: '1. Project info' },
  { key: 'boundaries', label: '2. Boundaries' },
  { key: 'baseline', label: '3. Baseline' },
  { key: 'additionality', label: '4. Additionality', comingSoon: true, ticket: 'AV4-335' },
  { key: 'monitoring', label: '5. Monitoring plan', comingSoon: true, ticket: 'AV4-335' },
  { key: 'leakage', label: '6. Leakage', comingSoon: true, ticket: 'AV4-335' },
  { key: 'sd-tool', label: '7. SD-Tool (SDGs)', comingSoon: true, ticket: 'AV4-337' },
  { key: 'stakeholder', label: '8. Stakeholder consultation', comingSoon: true, ticket: 'AV4-335' },
  { key: 'attachments', label: '9. Attachments', comingSoon: true, ticket: 'AV4-335' },
];

interface PddShape {
  projectInfo?: {
    title?: string;
    description?: string;
    technologyType?: string;
    hostCountry?: string;
    creditingPeriodStart?: string | null;
    creditingPeriodEnd?: string | null;
  };
  boundaries?: {
    geojson?: string;
    notes?: string;
  };
  baseline?: {
    narrative?: string;
    methodologyVersion?: string;
    counterfactual?: string;
  };
  [k: string]: unknown;
}

export function PddEditorPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const activityId = id ?? '';

  const { data: activityEnvelope, isLoading: actLoading } = useActivity(activityId);
  const { data: pddEnvelope, isLoading: pddLoading } = usePdd(activityId);
  const upsert = useUpsertPdd(activityId);
  const submit = useSubmitPdd(activityId);

  const [activeTab, setActiveTab] = useState<TabKey>('project-info');
  const [form, setForm] = useState<PddShape>({});
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const activity = activityEnvelope?.data;
  const pdd = pddEnvelope?.data;
  const locked = !!pdd?.submittedAt;

  // Initialise the form from server state + activity auto-fill on first load.
  useEffect(() => {
    if (actLoading || pddLoading) return;
    const saved = (pdd?.content ?? {}) as PddShape;
    setForm({
      projectInfo: {
        title: saved.projectInfo?.title ?? activity?.title ?? '',
        description: saved.projectInfo?.description ?? activity?.description ?? '',
        technologyType: saved.projectInfo?.technologyType ?? activity?.technologyType ?? '',
        hostCountry: saved.projectInfo?.hostCountry ?? activity?.hostCountry ?? '',
        creditingPeriodStart:
          saved.projectInfo?.creditingPeriodStart ?? activity?.creditingPeriodStart ?? null,
        creditingPeriodEnd:
          saved.projectInfo?.creditingPeriodEnd ?? activity?.creditingPeriodEnd ?? null,
      },
      boundaries: saved.boundaries ?? { geojson: '', notes: '' },
      baseline: {
        narrative: saved.baseline?.narrative ?? '',
        methodologyVersion:
          saved.baseline?.methodologyVersion ?? activity?.methodology?.code ?? '',
        counterfactual: saved.baseline?.counterfactual ?? '',
      },
      // Preserve any passthrough keys (tabs 4-9 future data).
      ...Object.fromEntries(
        Object.entries(saved).filter(
          ([k]) => !['projectInfo', 'boundaries', 'baseline'].includes(k),
        ),
      ),
    });
  }, [actLoading, pddLoading, pdd, activity]);

  const methodologyCode = activity?.methodology?.code ?? '—';

  const persist = async (next: PddShape) => {
    if (locked) return;
    try {
      await upsert.mutateAsync(next as Record<string, unknown>);
      setToast({ kind: 'ok', msg: 'Draft saved' });
      window.setTimeout(() => setToast(null), 1500);
    } catch (e) {
      setToast({ kind: 'err', msg: (e as Error).message });
    }
  };

  const onFieldBlur = () => {
    void persist(form);
  };

  const onSubmit = async () => {
    if (!pdd) {
      await persist(form);
    }
    try {
      await submit.mutateAsync();
      setToast({ kind: 'ok', msg: 'PDD submitted (locked)' });
      window.setTimeout(() => nav(`/activities`), 1200);
    } catch (e) {
      setToast({ kind: 'err', msg: (e as Error).message });
    }
  };

  const readOnly = locked;

  const tabContent = useMemo(() => {
    const baseStyle: React.CSSProperties = {
      background: 'var(--bg-card)',
      border: '1px solid var(--border-primary)',
      borderRadius: '0.75rem',
      padding: '1.25rem',
      display: 'grid',
      gap: '0.875rem',
    };

    if (activeTab === 'project-info') {
      return (
        <div style={baseStyle}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Project title</label>
            <input
              style={inputStyle}
              value={form.projectInfo?.title ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  projectInfo: { ...form.projectInfo, title: e.target.value },
                })
              }
              onBlur={onFieldBlur}
              readOnly={readOnly}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Description</label>
            <textarea
              style={{ ...inputStyle, minHeight: '5rem' }}
              value={form.projectInfo?.description ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  projectInfo: { ...form.projectInfo, description: e.target.value },
                })
              }
              onBlur={onFieldBlur}
              readOnly={readOnly}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.875rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Technology type</label>
              <input
                style={inputStyle}
                value={form.projectInfo?.technologyType ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    projectInfo: { ...form.projectInfo, technologyType: e.target.value },
                  })
                }
                onBlur={onFieldBlur}
                readOnly={readOnly}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Host country</label>
              <input
                style={inputStyle}
                maxLength={2}
                value={form.projectInfo?.hostCountry ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    projectInfo: {
                      ...form.projectInfo,
                      hostCountry: e.target.value.toUpperCase(),
                    },
                  })
                }
                onBlur={onFieldBlur}
                readOnly={readOnly}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Methodology</label>
              <input style={inputStyle} value={methodologyCode} readOnly />
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'boundaries') {
      return (
        <div style={baseStyle}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', margin: 0 }}>
            Paste a GeoJSON polygon / MultiPolygon for the project area. An interactive
            map drawer is planned (AV4-335 follow-up with MapLibre GL).
          </p>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Project boundary (GeoJSON)</label>
            <textarea
              style={{ ...inputStyle, minHeight: '10rem', fontFamily: 'monospace' }}
              value={form.boundaries?.geojson ?? ''}
              placeholder='{"type":"Polygon","coordinates":[[[lng,lat], …]]}'
              onChange={(e) =>
                setForm({ ...form, boundaries: { ...form.boundaries, geojson: e.target.value } })
              }
              onBlur={onFieldBlur}
              readOnly={readOnly}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Upload GeoJSON file</label>
            <input
              type="file"
              accept=".geojson,application/geo+json,application/json"
              disabled={readOnly}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const txt = await f.text();
                const next = {
                  ...form,
                  boundaries: { ...form.boundaries, geojson: txt },
                };
                setForm(next);
                void persist(next);
              }}
              style={{ marginTop: '0.25rem' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Boundary notes</label>
            <textarea
              style={{ ...inputStyle, minHeight: '4rem' }}
              value={form.boundaries?.notes ?? ''}
              onChange={(e) =>
                setForm({ ...form, boundaries: { ...form.boundaries, notes: e.target.value } })
              }
              onBlur={onFieldBlur}
              readOnly={readOnly}
            />
          </div>
        </div>
      );
    }

    if (activeTab === 'baseline') {
      return (
        <div style={baseStyle}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', margin: 0 }}>
            Narrative baseline. Structured per-year `BaselineScenario` with downward-adjustment
            factor lands in AV4-336 — this field will migrate into that entity then.
          </p>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Methodology version</label>
            <input style={inputStyle} value={form.baseline?.methodologyVersion ?? ''} readOnly />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Baseline narrative</label>
            <textarea
              style={{ ...inputStyle, minHeight: '10rem' }}
              value={form.baseline?.narrative ?? ''}
              onChange={(e) =>
                setForm({ ...form, baseline: { ...form.baseline, narrative: e.target.value } })
              }
              onBlur={onFieldBlur}
              readOnly={readOnly}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Counterfactual scenario</label>
            <textarea
              style={{ ...inputStyle, minHeight: '6rem' }}
              value={form.baseline?.counterfactual ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  baseline: { ...form.baseline, counterfactual: e.target.value },
                })
              }
              onBlur={onFieldBlur}
              readOnly={readOnly}
            />
          </div>
        </div>
      );
    }

    // Placeholders for tabs 4-9.
    const tab = TABS.find((t) => t.key === activeTab);
    return (
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px dashed var(--border-primary)',
          borderRadius: '0.75rem',
          padding: '3rem 1.25rem',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
        }}
      >
        <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
          {tab?.label} — coming soon
        </h3>
        <p style={{ margin: 0, fontSize: '0.875rem' }}>
          This tab ships in ticket{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{tab?.ticket}</strong>.
        </p>
      </div>
    );
  }, [activeTab, form, methodologyCode, readOnly]);

  if (actLoading || pddLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
        Loading PDD editor…
      </div>
    );
  }

  if (!activity) {
    return (
      <div style={{ padding: '2rem', color: '#ef4444' }}>
        Activity not found or you do not have access.
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <button
          onClick={() => nav(`/activities`)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            padding: 0,
            fontSize: '0.8125rem',
          }}
        >
          ← Back to activities
        </button>
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            margin: '0.5rem 0 0.25rem 0',
            color: 'var(--text-primary)',
          }}
        >
          PDD Editor — {activity.title}
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            Version {pdd?.version ?? 1}
          </span>
          {locked ? (
            <span
              style={{
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.6875rem',
                fontWeight: 700,
                background: 'rgba(16,185,129,0.12)',
                color: '#10b981',
                textTransform: 'uppercase',
              }}
            >
              Submitted — locked
            </span>
          ) : (
            <span
              style={{
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.6875rem',
                fontWeight: 700,
                background: 'rgba(107,114,128,0.12)',
                color: '#6b7280',
                textTransform: 'uppercase',
              }}
            >
              Draft
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr',
          gap: '1rem',
          alignItems: 'start',
        }}
      >
        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: '0.75rem',
            padding: '0.5rem',
          }}
        >
          {TABS.map((t) => {
            const isActive = t.key === activeTab;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  textAlign: 'left',
                  padding: '0.5rem 0.625rem',
                  background: isActive ? 'rgba(26,93,61,0.1)' : 'transparent',
                  color: isActive ? '#1a5d3d' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: isActive ? 600 : 500,
                  fontFamily: 'inherit',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                {t.label}
                {t.comingSoon && (
                  <span
                    style={{
                      fontSize: '0.625rem',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    soon
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div>
          {tabContent}

          <div
            style={{
              marginTop: '1rem',
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'flex-end',
              alignItems: 'center',
            }}
          >
            {toast && (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: toast.kind === 'ok' ? '#10b981' : '#ef4444',
                }}
              >
                {toast.msg}
              </span>
            )}
            <button
              onClick={() => void persist(form)}
              disabled={readOnly || upsert.isPending}
              style={{
                padding: '0.5rem 0.875rem',
                background: 'transparent',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-secondary)',
                borderRadius: '0.5rem',
                cursor: readOnly ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                fontSize: '0.8125rem',
              }}
            >
              Save draft
            </button>
            <button
              onClick={() => void onSubmit()}
              disabled={readOnly || submit.isPending}
              style={{
                padding: '0.5rem 0.875rem',
                background: readOnly ? '#9ca3af' : '#1a5d3d',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: readOnly ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                fontSize: '0.8125rem',
                fontWeight: 600,
              }}
            >
              {submit.isPending ? 'Submitting…' : 'Submit for validation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  borderRadius: '0.375rem',
  border: '1px solid var(--border-primary)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
  fontFamily: 'inherit',
  marginTop: '0.25rem',
};
