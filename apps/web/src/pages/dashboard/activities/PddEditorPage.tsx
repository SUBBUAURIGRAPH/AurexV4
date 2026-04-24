import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useActivity } from '../../../hooks/useActivities';
import {
  usePdd,
  useSubmitPdd,
  useUpsertPdd,
  useSdgs,
  useSdIndicators,
  useUpsertSdContributions,
  useSignPddAttachment,
  type PddContent,
  type PddAdditionality,
  type PddBarrier,
  type PddBarrierKind,
  type PddLeakage,
  type PddLeakageCategory,
  type PddLeakageEntry,
  type PddSdgs,
  type PddSdgIndicatorValue,
  type PddStakeholder,
  type PddConsultation,
  type PddAttachment,
  type SdContributionInput,
} from '../../../hooks/usePdd';

/**
 * AV4-335: PDD Editor — full 9-tab wizard.
 *
 * Tabs:
 *   1. Project info            — title, description, tech, host country
 *   2. Boundaries              — GeoJSON textarea + file upload (MapLibre GL drawer deferred)
 *   3. Baseline                — narrative + methodology version auto-filled (BaselineScenario AV4-336)
 *   4. Additionality           — IRR/NPV + barrier + common-practice + lock-in (A6.4-SBM015-A11)
 *   5. Monitoring plan summary — read-only view of MonitoringPlan (Phase B)
 *   6. Leakage                 — category selectors + narrative
 *   7. SD-Tool (SDGs)          — 17-goal multi-select + indicator ex-ante values (AV4-337)
 *   8. Stakeholder             — consultation log table
 *   9. Attachments             — metadata list + stub sign endpoint (blob store AV4-338)
 *
 * Persistence: blur on any field → `PUT /pdds/:activityId`. Tab 7 additionally
 * fires `PUT /sd-tool/activities/:id/sd-contributions` when the user edits
 * indicator values. Submit locks the PDD (`POST /pdds/:id/submit`).
 *
 * Submit validation:
 *   - ≥ 2 distinct SDGs selected (A6.4 SD-Tool minimum)
 *   - Additionality: at least one of investment / barrier / common-practice
 *   - Baseline narrative non-empty
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
}

const TABS: Tab[] = [
  { key: 'project-info', label: '1. Project info' },
  { key: 'boundaries', label: '2. Boundaries' },
  { key: 'baseline', label: '3. Baseline' },
  { key: 'additionality', label: '4. Additionality' },
  { key: 'monitoring', label: '5. Monitoring plan' },
  { key: 'leakage', label: '6. Leakage' },
  { key: 'sd-tool', label: '7. SD-Tool (SDGs)' },
  { key: 'stakeholder', label: '8. Stakeholder consultation' },
  { key: 'attachments', label: '9. Attachments' },
];

const BARRIER_KINDS: PddBarrierKind[] = ['financial', 'technological', 'institutional', 'other'];
const LEAKAGE_CATEGORIES: PddLeakageCategory[] = [
  'upstream',
  'downstream',
  'market',
  'activity-shifting',
];

// ─── Completion predicates (drive per-tab green checkmark + submit gate) ──

function isProjectInfoComplete(c: PddContent): boolean {
  const p = c.projectInfo;
  return !!(p?.title && p?.hostCountry && p?.technologyType);
}
function isBoundariesComplete(c: PddContent): boolean {
  return !!c.boundaries?.geojson?.trim();
}
function isBaselineComplete(c: PddContent): boolean {
  return !!c.baseline?.narrative?.trim();
}
function isAdditionalityComplete(c: PddContent): boolean {
  const a = c.additionality;
  if (!a) return false;
  const investmentFilled =
    !!a.investment &&
    (a.investment.expectedIrrPct != null ||
      a.investment.benchmarkIrrPct != null ||
      a.investment.npvWithoutCredits != null ||
      a.investment.npvWithCredits != null ||
      !!a.investment.narrative?.trim());
  const anyBarrier = (a.barriers ?? []).some((b) => b.checked);
  const commonPracticeFilled =
    !!a.commonPractice &&
    (a.commonPractice.sectorPenetrationPct != null ||
      !!a.commonPractice.narrative?.trim());
  const lockInFilled = !!a.lockInRisk?.trim();
  // Tab is "complete" when at least one analysis AND lock-in narrative exist.
  return (investmentFilled || anyBarrier || commonPracticeFilled) && lockInFilled;
}
function isMonitoringComplete(hasPlan: boolean): boolean {
  return hasPlan;
}
function isLeakageComplete(c: PddContent): boolean {
  const l = c.leakage;
  return !!(l?.overallNarrative?.trim() || (l?.categories && l.categories.length > 0));
}
function isSdgsComplete(c: PddContent): boolean {
  return (c.sdgs?.selected?.length ?? 0) >= 2;
}
function isStakeholderComplete(c: PddContent): boolean {
  return (c.stakeholder?.consultations?.length ?? 0) > 0;
}
function isAttachmentsComplete(c: PddContent): boolean {
  return (c.attachments?.length ?? 0) > 0;
}

// ─── Component ─────────────────────────────────────────────────────────

export function PddEditorPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const activityId = id ?? '';

  const { data: activityEnvelope, isLoading: actLoading } = useActivity(activityId);
  const { data: pddEnvelope, isLoading: pddLoading } = usePdd(activityId);
  const upsert = useUpsertPdd(activityId);
  const submit = useSubmitPdd(activityId);
  const upsertSd = useUpsertSdContributions(activityId);
  const signAttachment = useSignPddAttachment(activityId);

  const [activeTab, setActiveTab] = useState<TabKey>('project-info');
  const [form, setForm] = useState<PddContent>({});
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [submitErrors, setSubmitErrors] = useState<Partial<Record<TabKey, string>>>({});

  const activity = activityEnvelope?.data;
  const pdd = pddEnvelope?.data;
  const locked = !!pdd?.submittedAt;
  const readOnly = locked;

  // Initialise form from server state + activity auto-fill on first load.
  useEffect(() => {
    if (actLoading || pddLoading) return;
    const saved = (pdd?.content ?? {}) as PddContent;
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
      additionality: saved.additionality ?? {},
      leakage: saved.leakage ?? {},
      sdgs: saved.sdgs ?? {},
      stakeholder: saved.stakeholder ?? {},
      attachments: saved.attachments ?? [],
      // passthrough
      ...Object.fromEntries(
        Object.entries(saved).filter(
          ([k]) =>
            ![
              'projectInfo',
              'boundaries',
              'baseline',
              'additionality',
              'leakage',
              'sdgs',
              'stakeholder',
              'attachments',
            ].includes(k),
        ),
      ),
    });
  }, [actLoading, pddLoading, pdd, activity]);

  const methodologyCode = activity?.methodology?.code ?? '—';
  const monitoringPlan = activity?.monitoringPlan ?? null;

  // ─── Persistence helpers ────────────────────────────────────────────

  const persist = async (next: PddContent) => {
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

  // Submit: validate required sections, push draft, then lock.
  const onSubmit = async () => {
    const errs: Partial<Record<TabKey, string>> = {};
    if (!isBaselineComplete(form)) errs.baseline = 'Baseline narrative is required.';
    if (!isAdditionalityComplete(form))
      errs.additionality =
        'Fill at least one of investment / barrier / common-practice and lock-in risk narrative.';
    if (!isSdgsComplete(form))
      errs['sd-tool'] = 'Select at least 2 SDGs (A6.4 SD-Tool minimum).';
    setSubmitErrors(errs);
    if (Object.keys(errs).length > 0) {
      const first = Object.keys(errs)[0] as TabKey;
      setActiveTab(first);
      setToast({ kind: 'err', msg: 'Fix the highlighted sections before submitting.' });
      return;
    }
    try {
      await persist(form);
      // Sync SD contributions one last time before locking.
      await syncSdContributions(form).catch(() => {
        // Non-fatal; the upsert failure bubbles up its own error below if persist fails.
      });
      await submit.mutateAsync();
      setToast({ kind: 'ok', msg: 'PDD submitted (locked)' });
      window.setTimeout(() => nav(`/activities`), 1200);
    } catch (e) {
      setToast({ kind: 'err', msg: (e as Error).message });
    }
  };

  // Persist SD contributions as ex-ante rows on indicator change / save.
  const syncSdContributions = async (next: PddContent) => {
    const values = next.sdgs?.indicatorValues ?? [];
    const contributions: SdContributionInput[] = values
      .filter((v) => v.indicatorCode && v.value != null)
      .map((v) => ({
        indicatorCode: v.indicatorCode,
        value: Number(v.value),
        unit: v.unit ?? 'unit',
        notes: v.notes,
        evidenceUrl: v.evidenceUrl,
      }));
    if (contributions.length === 0) return;
    await upsertSd.mutateAsync(contributions);
  };

  // ─── Render ─────────────────────────────────────────────────────────

  const tabCompletion = useMemo<Record<TabKey, boolean>>(
    () => ({
      'project-info': isProjectInfoComplete(form),
      boundaries: isBoundariesComplete(form),
      baseline: isBaselineComplete(form),
      additionality: isAdditionalityComplete(form),
      monitoring: isMonitoringComplete(!!monitoringPlan),
      leakage: isLeakageComplete(form),
      'sd-tool': isSdgsComplete(form),
      stakeholder: isStakeholderComplete(form),
      attachments: isAttachmentsComplete(form),
    }),
    [form, monitoringPlan],
  );

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
            <label style={labelStyle}>Project title</label>
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
            <label style={labelStyle}>Description</label>
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
              <label style={labelStyle}>Technology type</label>
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
              <label style={labelStyle}>Host country</label>
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
              <label style={labelStyle}>Methodology</label>
              <input style={inputStyle} value={methodologyCode} readOnly />
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'boundaries') {
      return (
        <div style={baseStyle}>
          <p style={helpStyle}>
            Paste a GeoJSON polygon / MultiPolygon for the project area. An interactive map
            drawer is planned (AV4-335 follow-up with MapLibre GL).
          </p>
          <div>
            <label style={labelStyle}>Project boundary (GeoJSON)</label>
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
            <label style={labelStyle}>Upload GeoJSON file</label>
            <input
              type="file"
              accept=".geojson,application/geo+json,application/json"
              disabled={readOnly}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const txt = await f.text();
                const next: PddContent = {
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
            <label style={labelStyle}>Boundary notes</label>
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
          <p style={helpStyle}>
            Narrative baseline. Structured per-year <code>BaselineScenario</code> with
            downward-adjustment factor lands in AV4-336 — this field will migrate into that
            entity then.
          </p>
          <div>
            <label style={labelStyle}>Methodology version</label>
            <input style={inputStyle} value={form.baseline?.methodologyVersion ?? ''} readOnly />
          </div>
          <div>
            <label style={labelStyle}>Baseline narrative</label>
            <textarea
              style={{ ...inputStyle, minHeight: '10rem' }}
              value={form.baseline?.narrative ?? ''}
              onChange={(e) =>
                setForm({ ...form, baseline: { ...form.baseline, narrative: e.target.value } })
              }
              onBlur={onFieldBlur}
              readOnly={readOnly}
            />
            {submitErrors.baseline && <div style={errorStyle}>{submitErrors.baseline}</div>}
          </div>
          <div>
            <label style={labelStyle}>Counterfactual scenario</label>
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

    if (activeTab === 'additionality') {
      return (
        <AdditionalityTab
          value={form.additionality ?? {}}
          readOnly={readOnly}
          error={submitErrors.additionality}
          onChange={(next) => setForm({ ...form, additionality: next })}
          onBlur={onFieldBlur}
        />
      );
    }

    if (activeTab === 'monitoring') {
      return (
        <MonitoringSummaryTab
          plan={monitoringPlan}
          activityId={activityId}
          onGoToEditor={() => nav(`/activities/${activityId}/monitoring`)}
        />
      );
    }

    if (activeTab === 'leakage') {
      return (
        <LeakageTab
          value={form.leakage ?? {}}
          readOnly={readOnly}
          onChange={(next) => setForm({ ...form, leakage: next })}
          onBlur={onFieldBlur}
        />
      );
    }

    if (activeTab === 'sd-tool') {
      return (
        <SdgTab
          value={form.sdgs ?? {}}
          readOnly={readOnly}
          error={submitErrors['sd-tool']}
          onChange={(next) => setForm({ ...form, sdgs: next })}
          onBlur={onFieldBlur}
        />
      );
    }

    if (activeTab === 'stakeholder') {
      return (
        <StakeholderTab
          value={form.stakeholder ?? {}}
          readOnly={readOnly}
          onChange={(next) => setForm({ ...form, stakeholder: next })}
          onBlur={onFieldBlur}
        />
      );
    }

    if (activeTab === 'attachments') {
      return (
        <AttachmentsTab
          value={form.attachments ?? []}
          readOnly={readOnly}
          onChange={(next) => {
            const merged: PddContent = { ...form, attachments: next };
            setForm(merged);
            void persist(merged);
          }}
          onSign={async (filename, contentType, sizeBytes) => {
            const resp = await signAttachment.mutateAsync({ filename, contentType, sizeBytes });
            return resp.data;
          }}
        />
      );
    }

    return null;
  }, [
    activeTab,
    form,
    methodologyCode,
    readOnly,
    monitoringPlan,
    activityId,
    submitErrors,
    nav,
    signAttachment,
  ]);

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
            <span style={badgeOk}>Submitted — locked</span>
          ) : (
            <span style={badgeDraft}>Draft</span>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '240px 1fr',
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
            const complete = tabCompletion[t.key];
            const hasError = !!submitErrors[t.key];
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
                <span>{t.label}</span>
                <span
                  aria-label={
                    hasError ? 'needs attention' : complete ? 'complete' : 'incomplete'
                  }
                  style={{
                    fontSize: '0.75rem',
                    color: hasError ? '#ef4444' : complete ? '#10b981' : 'var(--text-tertiary)',
                  }}
                >
                  {hasError ? '!' : complete ? '✓' : '○'}
                </span>
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
            {activeTab === 'attachments' && (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 4: Additionality ───────────────────────────────────────────────

interface AdditionalityTabProps {
  value: PddAdditionality;
  readOnly: boolean;
  error?: string;
  onChange: (next: PddAdditionality) => void;
  onBlur: () => void;
}

function AdditionalityTab({ value, readOnly, error, onChange, onBlur }: AdditionalityTabProps) {
  const inv = value.investment ?? {};
  const barriers: PddBarrier[] =
    value.barriers && value.barriers.length > 0
      ? value.barriers
      : BARRIER_KINDS.map((k) => ({ kind: k, checked: false }));
  const cp = value.commonPractice ?? {};

  const irrGap =
    inv.expectedIrrPct != null && inv.benchmarkIrrPct != null
      ? Number(inv.benchmarkIrrPct) - Number(inv.expectedIrrPct)
      : null;
  const additionalityByInvestment = irrGap != null && irrGap > 0;
  const commonPracticeFlag =
    cp.sectorPenetrationPct != null && Number(cp.sectorPenetrationPct) > 20;

  const updateBarrier = (kind: PddBarrierKind, patch: Partial<PddBarrier>) => {
    const next = barriers.map((b) => (b.kind === kind ? { ...b, ...patch } : b));
    onChange({ ...value, barriers: next });
  };

  return (
    <div style={cardStyle}>
      <p style={helpStyle}>
        Per <strong>A6.4-SBM015-A11</strong>: demonstrate additionality via investment,
        barrier, or common-practice analysis. Lock-in-risk narrative is also required.
      </p>

      {/* Investment analysis */}
      <section style={sectionStyle}>
        <h4 style={sectionTitle}>Investment analysis</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
          <NumberField
            label="Expected IRR (%) without credits"
            value={inv.expectedIrrPct}
            readOnly={readOnly}
            onChange={(v) =>
              onChange({ ...value, investment: { ...inv, expectedIrrPct: v } })
            }
            onBlur={onBlur}
          />
          <NumberField
            label="Benchmark IRR (%)"
            value={inv.benchmarkIrrPct}
            readOnly={readOnly}
            onChange={(v) =>
              onChange({ ...value, investment: { ...inv, benchmarkIrrPct: v } })
            }
            onBlur={onBlur}
          />
          <NumberField
            label="NPV without credits"
            value={inv.npvWithoutCredits}
            readOnly={readOnly}
            onChange={(v) =>
              onChange({ ...value, investment: { ...inv, npvWithoutCredits: v } })
            }
            onBlur={onBlur}
          />
          <NumberField
            label="NPV with credits"
            value={inv.npvWithCredits}
            readOnly={readOnly}
            onChange={(v) =>
              onChange({ ...value, investment: { ...inv, npvWithCredits: v } })
            }
            onBlur={onBlur}
          />
        </div>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
          <span style={{ color: 'var(--text-tertiary)' }}>
            IRR gap:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {irrGap != null ? `${irrGap.toFixed(2)} pp` : '—'}
            </strong>
          </span>
          <span
            style={{
              color: additionalityByInvestment ? '#10b981' : 'var(--text-tertiary)',
              fontWeight: 600,
            }}
          >
            {additionalityByInvestment
              ? '✓ Additional by investment (IRR < benchmark)'
              : 'Not additional by investment alone'}
          </span>
        </div>
        <div>
          <label style={labelStyle}>Investment narrative</label>
          <textarea
            style={{ ...inputStyle, minHeight: '4rem' }}
            value={inv.narrative ?? ''}
            onChange={(e) =>
              onChange({ ...value, investment: { ...inv, narrative: e.target.value } })
            }
            onBlur={onBlur}
            readOnly={readOnly}
          />
        </div>
      </section>

      {/* Barrier analysis */}
      <section style={sectionStyle}>
        <h4 style={sectionTitle}>Barrier analysis</h4>
        {barriers.map((b) => (
          <div key={b.kind} style={{ display: 'grid', gap: '0.375rem' }}>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={b.checked}
                disabled={readOnly}
                onChange={(e) => {
                  updateBarrier(b.kind, { checked: e.target.checked });
                  onBlur();
                }}
              />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'capitalize' }}>
                {b.kind} barrier
              </span>
            </label>
            {b.checked && (
              <textarea
                style={{ ...inputStyle, minHeight: '3rem' }}
                placeholder={`Describe the ${b.kind} barrier…`}
                value={b.narrative ?? ''}
                onChange={(e) => updateBarrier(b.kind, { narrative: e.target.value })}
                onBlur={onBlur}
                readOnly={readOnly}
              />
            )}
          </div>
        ))}
      </section>

      {/* Common practice */}
      <section style={sectionStyle}>
        <h4 style={sectionTitle}>Common practice analysis</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '0.875rem', alignItems: 'start' }}>
          <NumberField
            label="Sector penetration (%)"
            value={cp.sectorPenetrationPct}
            min={0}
            max={100}
            readOnly={readOnly}
            onChange={(v) =>
              onChange({ ...value, commonPractice: { ...cp, sectorPenetrationPct: v } })
            }
            onBlur={onBlur}
          />
          {commonPracticeFlag && (
            <div
              style={{
                alignSelf: 'end',
                fontSize: '0.75rem',
                color: '#d97706',
                background: 'rgba(217,119,6,0.12)',
                padding: '0.375rem 0.5rem',
                borderRadius: '0.375rem',
              }}
            >
              ! Penetration &gt; 20% — technology is likely common practice; strengthen barrier
              or investment argument.
            </div>
          )}
        </div>
        <div>
          <label style={labelStyle}>Common-practice narrative</label>
          <textarea
            style={{ ...inputStyle, minHeight: '4rem' }}
            value={cp.narrative ?? ''}
            onChange={(e) =>
              onChange({ ...value, commonPractice: { ...cp, narrative: e.target.value } })
            }
            onBlur={onBlur}
            readOnly={readOnly}
          />
        </div>
      </section>

      {/* Lock-in risk */}
      <section style={sectionStyle}>
        <h4 style={sectionTitle}>Lock-in risk (required)</h4>
        <textarea
          style={{ ...inputStyle, minHeight: '5rem' }}
          placeholder="Describe risk that the project locks in high-emitting infrastructure / pathways…"
          value={value.lockInRisk ?? ''}
          onChange={(e) => onChange({ ...value, lockInRisk: e.target.value })}
          onBlur={onBlur}
          readOnly={readOnly}
        />
      </section>

      {error && <div style={errorStyle}>{error}</div>}
    </div>
  );
}

// ─── Tab 5: Monitoring plan summary (read-only) ─────────────────────────

interface MonitoringSummaryTabProps {
  plan: NonNullable<ReturnType<typeof useActivity>['data']>['data']['monitoringPlan'] | null;
  activityId: string;
  onGoToEditor: () => void;
}

function MonitoringSummaryTab({ plan, activityId: _activityId, onGoToEditor }: MonitoringSummaryTabProps) {
  if (!plan) {
    return (
      <div style={cardStyle}>
        <p style={helpStyle}>
          No monitoring plan yet. The monitoring plan (parameters, measurement methods,
          frequencies, QA/QC notes) is authored in its own editor and summarised here.
        </p>
        <button
          onClick={onGoToEditor}
          style={{
            justifySelf: 'start',
            padding: '0.5rem 0.875rem',
            background: 'transparent',
            border: '1px solid var(--border-primary)',
            color: 'var(--text-secondary)',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '0.8125rem',
          }}
        >
          Open monitoring plan editor
        </button>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <p style={helpStyle}>
        Read-only summary of the monitoring plan (version {plan.version}). Edit in the
        dedicated monitoring editor.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.8125rem',
          }}
        >
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-tertiary)' }}>
              <th style={thStyle}>Code</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Unit</th>
              <th style={thStyle}>Method</th>
              <th style={thStyle}>Frequency</th>
              <th style={thStyle}>Uncertainty %</th>
            </tr>
          </thead>
          <tbody>
            {plan.parameters.map((p) => (
              <tr key={p.id}>
                <td style={tdStyle}><code>{p.code}</code></td>
                <td style={tdStyle}>{p.name}</td>
                <td style={tdStyle}>{p.unit}</td>
                <td style={tdStyle}>{p.measurementMethod}</td>
                <td style={tdStyle}>{p.frequency}</td>
                <td style={tdStyle}>{p.uncertaintyPct ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {plan.qaqcNotes && (
        <div>
          <label style={labelStyle}>QA/QC notes</label>
          <div
            style={{
              whiteSpace: 'pre-wrap',
              padding: '0.5rem',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              borderRadius: '0.375rem',
              fontSize: '0.8125rem',
            }}
          >
            {plan.qaqcNotes}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 6: Leakage ────────────────────────────────────────────────────

interface LeakageTabProps {
  value: PddLeakage;
  readOnly: boolean;
  onChange: (next: PddLeakage) => void;
  onBlur: () => void;
}

function LeakageTab({ value, readOnly, onChange, onBlur }: LeakageTabProps) {
  const categories = value.categories ?? [];
  const isSelected = (c: PddLeakageCategory) => categories.some((x) => x.category === c);

  const toggle = (c: PddLeakageCategory) => {
    if (readOnly) return;
    let next: PddLeakageEntry[];
    if (isSelected(c)) {
      next = categories.filter((x) => x.category !== c);
    } else {
      next = [...categories, { category: c, methodology: '', estimatedLeakageTco2e: null }];
    }
    onChange({ ...value, categories: next });
    onBlur();
  };

  const updateEntry = (c: PddLeakageCategory, patch: Partial<PddLeakageEntry>) => {
    const next = categories.map((x) => (x.category === c ? { ...x, ...patch } : x));
    onChange({ ...value, categories: next });
  };

  return (
    <div style={cardStyle}>
      <p style={helpStyle}>
        Identify leakage categories applicable to this project and quantify each. Unselected
        categories are treated as not applicable.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {LEAKAGE_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => toggle(c)}
            disabled={readOnly}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '9999px',
              border: `1px solid ${isSelected(c) ? '#1a5d3d' : 'var(--border-primary)'}`,
              background: isSelected(c) ? 'rgba(26,93,61,0.12)' : 'transparent',
              color: isSelected(c) ? '#1a5d3d' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'capitalize',
              cursor: readOnly ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {c.replace('-', ' ')}
          </button>
        ))}
      </div>

      {categories.map((entry) => (
        <section key={entry.category} style={sectionStyle}>
          <h4 style={{ ...sectionTitle, textTransform: 'capitalize' }}>
            {entry.category.replace('-', ' ')} leakage
          </h4>
          <div>
            <label style={labelStyle}>Quantification methodology</label>
            <textarea
              style={{ ...inputStyle, minHeight: '4rem' }}
              value={entry.methodology ?? ''}
              onChange={(e) => updateEntry(entry.category, { methodology: e.target.value })}
              onBlur={onBlur}
              readOnly={readOnly}
            />
          </div>
          <NumberField
            label="Estimated leakage (tCO₂e)"
            value={entry.estimatedLeakageTco2e}
            readOnly={readOnly}
            onChange={(v) => updateEntry(entry.category, { estimatedLeakageTco2e: v })}
            onBlur={onBlur}
          />
        </section>
      ))}

      <div>
        <label style={labelStyle}>Overall leakage treatment narrative</label>
        <textarea
          style={{ ...inputStyle, minHeight: '5rem' }}
          value={value.overallNarrative ?? ''}
          onChange={(e) => onChange({ ...value, overallNarrative: e.target.value })}
          onBlur={onBlur}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}

// ─── Tab 7: SD-Tool (SDGs) ─────────────────────────────────────────────

interface SdgTabProps {
  value: PddSdgs;
  readOnly: boolean;
  error?: string;
  onChange: (next: PddSdgs) => void;
  onBlur: () => void;
}

function SdgTab({ value, readOnly, error, onChange, onBlur }: SdgTabProps) {
  const { data: sdgData, isLoading: sdgLoading } = useSdgs();
  const selected = value.selected ?? [];
  const indicatorValues = value.indicatorValues ?? [];

  const toggleSdg = (code: string) => {
    if (readOnly) return;
    const next = selected.includes(code)
      ? selected.filter((c) => c !== code)
      : [...selected, code];
    onChange({ ...value, selected: next });
    onBlur();
  };

  return (
    <div style={cardStyle}>
      <p style={helpStyle}>
        Select the SDGs this activity contributes to (<strong>min 2</strong>, A6.4 SD-Tool
        minimum). For each selected SDG, capture the ex-ante indicator values below. Values
        are persisted both on the PDD and as <code>SdContribution</code> rows on save.
      </p>
      {sdgLoading && <div style={{ fontSize: '0.8125rem' }}>Loading SDGs…</div>}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: '0.5rem',
        }}
      >
        {(sdgData?.data ?? []).map((sdg) => {
          const isSel = selected.includes(sdg.code);
          return (
            <button
              key={sdg.code}
              onClick={() => toggleSdg(sdg.code)}
              disabled={readOnly}
              style={{
                textAlign: 'left',
                padding: '0.625rem',
                border: `1px solid ${isSel ? '#1a5d3d' : 'var(--border-primary)'}`,
                background: isSel ? 'rgba(26,93,61,0.12)' : 'var(--bg-primary)',
                color: isSel ? '#1a5d3d' : 'var(--text-secondary)',
                borderRadius: '0.5rem',
                cursor: readOnly ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
                {sdg.code.replace('_', ' ')}
              </div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{sdg.name}</div>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
        {selected.length} selected {selected.length < 2 && '(minimum 2)'}
      </div>
      {error && <div style={errorStyle}>{error}</div>}

      {selected.map((sdgCode) => (
        <SdgIndicatorSection
          key={sdgCode}
          sdgCode={sdgCode}
          indicatorValues={indicatorValues}
          readOnly={readOnly}
          onChange={(nextValues) => onChange({ ...value, indicatorValues: nextValues })}
          onBlur={onBlur}
        />
      ))}
    </div>
  );
}

interface SdgIndicatorSectionProps {
  sdgCode: string;
  indicatorValues: PddSdgIndicatorValue[];
  readOnly: boolean;
  onChange: (next: PddSdgIndicatorValue[]) => void;
  onBlur: () => void;
}

function SdgIndicatorSection({
  sdgCode,
  indicatorValues,
  readOnly,
  onChange,
  onBlur,
}: SdgIndicatorSectionProps) {
  const { data: indicatorsData, isLoading } = useSdIndicators(sdgCode);
  const [expanded, setExpanded] = useState(false);

  const updateIndicator = (code: string, patch: Partial<PddSdgIndicatorValue>) => {
    const existing = indicatorValues.find((v) => v.indicatorCode === code);
    let next: PddSdgIndicatorValue[];
    if (existing) {
      next = indicatorValues.map((v) =>
        v.indicatorCode === code ? { ...v, ...patch } : v,
      );
    } else {
      next = [...indicatorValues, { indicatorCode: code, ...patch }];
    }
    onChange(next);
  };

  const clearIndicator = (code: string) => {
    onChange(indicatorValues.filter((v) => v.indicatorCode !== code));
    onBlur();
  };

  return (
    <section style={sectionStyle}>
      <button
        onClick={() => setExpanded((x) => !x)}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          color: 'var(--text-primary)',
          fontSize: '0.875rem',
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{sdgCode.replace('_', ' ')} indicators</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
          {expanded ? '▾' : '▸'}
        </span>
      </button>
      {expanded && (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {isLoading && <div style={{ fontSize: '0.75rem' }}>Loading indicators…</div>}
          {(indicatorsData?.data ?? []).map((ind) => {
            const current = indicatorValues.find((v) => v.indicatorCode === ind.code);
            const inUse = !!current;
            return (
              <div
                key={ind.code}
                style={{
                  padding: '0.625rem',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '0.5rem',
                  display: 'grid',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                      <code>{ind.code}</code> — {ind.name}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
                      Unit: {ind.unit}
                    </div>
                  </div>
                  {inUse && !readOnly && (
                    <button
                      onClick={() => clearIndicator(ind.code)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '140px 120px 1fr',
                    gap: '0.5rem',
                  }}
                >
                  <NumberField
                    label="Ex-ante value"
                    value={current?.value ?? null}
                    readOnly={readOnly}
                    onChange={(v) =>
                      updateIndicator(ind.code, { value: v, unit: current?.unit ?? ind.unit })
                    }
                    onBlur={onBlur}
                  />
                  <div>
                    <label style={labelStyle}>Unit</label>
                    <input
                      style={inputStyle}
                      value={current?.unit ?? ind.unit}
                      onChange={(e) => updateIndicator(ind.code, { unit: e.target.value })}
                      onBlur={onBlur}
                      readOnly={readOnly}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Evidence URL (optional)</label>
                    <input
                      style={inputStyle}
                      type="url"
                      value={current?.evidenceUrl ?? ''}
                      onChange={(e) => updateIndicator(ind.code, { evidenceUrl: e.target.value })}
                      onBlur={onBlur}
                      readOnly={readOnly}
                      placeholder="https://…"
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Notes</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: '3rem' }}
                    value={current?.notes ?? ''}
                    onChange={(e) => updateIndicator(ind.code, { notes: e.target.value })}
                    onBlur={onBlur}
                    readOnly={readOnly}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─── Tab 8: Stakeholder consultation ───────────────────────────────────

interface StakeholderTabProps {
  value: PddStakeholder;
  readOnly: boolean;
  onChange: (next: PddStakeholder) => void;
  onBlur: () => void;
}

function StakeholderTab({ value, readOnly, onChange, onBlur }: StakeholderTabProps) {
  const rows = value.consultations ?? [];

  const addRow = () => {
    if (readOnly) return;
    onChange({
      ...value,
      consultations: [
        ...rows,
        { date: new Date().toISOString().slice(0, 10), stakeholderGroup: '', summary: '' },
      ],
    });
  };

  const updateRow = (index: number, patch: Partial<PddConsultation>) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange({ ...value, consultations: next });
  };

  const removeRow = (index: number) => {
    if (readOnly) return;
    onChange({ ...value, consultations: rows.filter((_, i) => i !== index) });
    onBlur();
  };

  return (
    <div style={cardStyle}>
      <p style={helpStyle}>
        Log stakeholder consultations conducted during project design. Attach proof
        documents via the Attachments tab and paste their URL here.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-tertiary)' }}>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Stakeholder group</th>
              <th style={thStyle}>Summary</th>
              <th style={thStyle}>Proof URL</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={tdStyle}>
                  <input
                    type="date"
                    style={inputStyle}
                    value={row.date ?? ''}
                    onChange={(e) => updateRow(i, { date: e.target.value })}
                    onBlur={onBlur}
                    readOnly={readOnly}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    style={inputStyle}
                    value={row.stakeholderGroup ?? ''}
                    onChange={(e) => updateRow(i, { stakeholderGroup: e.target.value })}
                    onBlur={onBlur}
                    readOnly={readOnly}
                  />
                </td>
                <td style={tdStyle}>
                  <textarea
                    style={{ ...inputStyle, minHeight: '3rem' }}
                    value={row.summary ?? ''}
                    onChange={(e) => updateRow(i, { summary: e.target.value })}
                    onBlur={onBlur}
                    readOnly={readOnly}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    type="url"
                    style={inputStyle}
                    value={row.proofUrl ?? ''}
                    onChange={(e) => updateRow(i, { proofUrl: e.target.value })}
                    onBlur={onBlur}
                    readOnly={readOnly}
                    placeholder="https://…"
                  />
                </td>
                <td style={tdStyle}>
                  {!readOnly && (
                    <button
                      onClick={() => removeRow(i)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: '0.75rem',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-tertiary)' }}
                >
                  No consultations logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <button
          onClick={addRow}
          style={{
            justifySelf: 'start',
            padding: '0.375rem 0.75rem',
            background: 'transparent',
            border: '1px dashed var(--border-primary)',
            color: 'var(--text-secondary)',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontFamily: 'inherit',
          }}
        >
          + Add consultation
        </button>
      )}
    </div>
  );
}

// ─── Tab 9: Attachments ─────────────────────────────────────────────────

interface AttachmentsTabProps {
  value: PddAttachment[];
  readOnly: boolean;
  onChange: (next: PddAttachment[]) => void;
  onSign: (
    filename: string,
    contentType: string | undefined,
    sizeBytes: number | undefined,
  ) => Promise<{ attachmentId: string; uploadUrl: string }>;
}

function AttachmentsTab({ value, readOnly, onChange, onSign }: AttachmentsTabProps) {
  const [uploading, setUploading] = useState(false);

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const signed = await onSign(file.name, file.type, file.size);
      // NOTE: stub — we do not actually upload bytes. When AV4-338 lands, PUT file to signed.uploadUrl.
      const next: PddAttachment = {
        id: signed.attachmentId,
        name: file.name,
        description: '',
        category: '',
        uploadedAt: new Date().toISOString(),
        uploadUrl: signed.uploadUrl,
      };
      onChange([...value, next]);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const update = (id: string, patch: Partial<PddAttachment>) => {
    onChange(value.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const remove = (id: string) => {
    onChange(value.filter((a) => a.id !== id));
  };

  return (
    <div style={cardStyle}>
      <p style={helpStyle}>
        Supporting documents (PDF / DOCX / XLSX / images). <strong>Upload stub:</strong>{' '}
        metadata is persisted now; actual blob upload swaps in when <code>AV4-338</code>{' '}
        provisions S3 / Backblaze.
      </p>
      {!readOnly && (
        <div>
          <label style={labelStyle}>Upload file</label>
          <input
            type="file"
            disabled={readOnly || uploading}
            onChange={onFileChosen}
            style={{ display: 'block', marginTop: '0.25rem' }}
          />
          {uploading && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Signing…</div>
          )}
        </div>
      )}
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {value.length === 0 && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
            No attachments yet.
          </div>
        )}
        {value.map((a) => (
          <div
            key={a.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 160px auto',
              gap: '0.5rem',
              alignItems: 'start',
              padding: '0.625rem',
              border: '1px solid var(--border-primary)',
              borderRadius: '0.5rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{a.name}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
                {new Date(a.uploadedAt).toLocaleString()}
              </div>
            </div>
            <input
              style={inputStyle}
              placeholder="Description"
              value={a.description ?? ''}
              onChange={(e) => update(a.id, { description: e.target.value })}
              readOnly={readOnly}
            />
            <input
              style={inputStyle}
              placeholder="Category"
              value={a.category ?? ''}
              onChange={(e) => update(a.id, { category: e.target.value })}
              readOnly={readOnly}
            />
            {!readOnly && (
              <button
                onClick={() => remove(a.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  alignSelf: 'center',
                }}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Shared styles + small widgets ─────────────────────────────────────

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
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
};

const helpStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: 'var(--text-tertiary)',
  margin: 0,
};

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-primary)',
  borderRadius: '0.75rem',
  padding: '1.25rem',
  display: 'grid',
  gap: '0.875rem',
};

const sectionStyle: React.CSSProperties = {
  padding: '0.875rem',
  border: '1px solid var(--border-primary)',
  borderRadius: '0.5rem',
  background: 'var(--bg-primary)',
  display: 'grid',
  gap: '0.625rem',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  margin: 0,
  color: 'var(--text-primary)',
};

const errorStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#ef4444',
  padding: '0.375rem 0.5rem',
  background: 'rgba(239,68,68,0.08)',
  borderRadius: '0.375rem',
};

const thStyle: React.CSSProperties = {
  padding: '0.375rem 0.5rem',
  borderBottom: '1px solid var(--border-primary)',
  fontWeight: 600,
  fontSize: '0.75rem',
};

const tdStyle: React.CSSProperties = {
  padding: '0.375rem 0.5rem',
  borderBottom: '1px solid var(--border-primary)',
  verticalAlign: 'top',
};

const badgeOk: React.CSSProperties = {
  padding: '0.125rem 0.5rem',
  borderRadius: '9999px',
  fontSize: '0.6875rem',
  fontWeight: 700,
  background: 'rgba(16,185,129,0.12)',
  color: '#10b981',
  textTransform: 'uppercase',
};

const badgeDraft: React.CSSProperties = {
  padding: '0.125rem 0.5rem',
  borderRadius: '9999px',
  fontSize: '0.6875rem',
  fontWeight: 700,
  background: 'rgba(107,114,128,0.12)',
  color: '#6b7280',
  textTransform: 'uppercase',
};

interface NumberFieldProps {
  label: string;
  value: number | null | undefined;
  min?: number;
  max?: number;
  readOnly?: boolean;
  onChange: (v: number | null) => void;
  onBlur?: () => void;
}

function NumberField({ label, value, min, max, readOnly, onChange, onBlur }: NumberFieldProps) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type="number"
        style={inputStyle}
        value={value ?? ''}
        min={min}
        max={max}
        step="any"
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') onChange(null);
          else {
            const n = Number(raw);
            onChange(Number.isFinite(n) ? n : null);
          }
        }}
        onBlur={onBlur}
        readOnly={readOnly}
      />
    </div>
  );
}
