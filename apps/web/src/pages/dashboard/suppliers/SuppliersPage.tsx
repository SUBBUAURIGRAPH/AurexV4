import { useState } from 'react';
import {
  useSuppliers,
  useCreateSupplier,
  useDeleteSupplier,
  useSupplierRequests,
  useCreateDataRequest,
  useDecideSupplierRequest,
  type Supplier,
  type SupplierStatus,
  type SupplierRequestStatus,
} from '../../../hooks/useSuppliers';
import { useToast } from '../../../contexts/ToastContext';

const STATUS_STYLES: Record<SupplierStatus | SupplierRequestStatus, { bg: string; color: string }> = {
  INVITED: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
  ACTIVE: { bg: 'rgba(16,185,129,0.1)', color: '#10b981' },
  SUSPENDED: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' },
  PENDING: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
  SUBMITTED: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
  ACCEPTED: { bg: 'rgba(16,185,129,0.1)', color: '#10b981' },
  REJECTED: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
  CANCELLED: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' },
};

function Badge({ label }: { label: string }) {
  const s = STATUS_STYLES[label as keyof typeof STATUS_STYLES] ?? { bg: 'var(--bg-secondary)', color: 'var(--text-tertiary)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '0.2rem 0.625rem', borderRadius: '9999px',
      fontSize: '0.6875rem', fontWeight: 700,
      backgroundColor: s.bg, color: s.color,
      textTransform: 'uppercase', letterSpacing: '0.03em',
    }}>
      {label}
    </span>
  );
}

// ─── Add Supplier Modal ────────────────────────────────────────────────

function AddSupplierModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [category, setCategory] = useState('');
  const create = useCreateSupplier();
  const { success: toastSuccess, error: toastError } = useToast();

  const submit = () => {
    create.mutate(
      { name, email, contactPerson: contactPerson || undefined, category: category || undefined },
      {
        onSuccess: () => {
          toastSuccess('Supplier invited');
          onClose();
        },
        onError: (e: Error) => toastError(e.message),
      },
    );
  };

  return (
    <Modal onClose={onClose} title="Invite Supplier">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <Field label="Name" required>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Steel Co." />
        </Field>
        <Field label="Contact email" required>
          <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sustainability@acmesteel.com" />
        </Field>
        <Field label="Contact person">
          <input style={inputStyle} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Category">
          <input style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Materials, Transport" />
        </Field>
      </div>
      <ModalActions>
        <button style={secondaryBtn} onClick={onClose} disabled={create.isPending}>Cancel</button>
        <button style={primaryBtn} onClick={submit} disabled={create.isPending || !name.trim() || !email.trim()}>
          {create.isPending ? 'Inviting…' : 'Invite'}
        </button>
      </ModalActions>
    </Modal>
  );
}

// ─── Request Data Modal ────────────────────────────────────────────────

function RequestDataModal({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [dataScope, setDataScope] = useState('scope_3_emissions');
  const [description, setDescription] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [dueBy, setDueBy] = useState('');
  const create = useCreateDataRequest();
  const { success: toastSuccess, error: toastError } = useToast();

  const submit = () => {
    create.mutate(
      {
        supplierId: supplier.id,
        data: {
          title,
          description: description || undefined,
          dataScope,
          periodStart,
          periodEnd,
          dueBy: dueBy || undefined,
        },
      },
      {
        onSuccess: () => {
          toastSuccess(`Data request sent to ${supplier.name}`);
          onClose();
        },
        onError: (e: Error) => toastError(e.message),
      },
    );
  };

  return (
    <Modal onClose={onClose} title={`Request Data — ${supplier.name}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <Field label="Request title" required>
          <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q1 2026 Scope 3 emissions" />
        </Field>
        <Field label="Data scope" required>
          <select style={inputStyle} value={dataScope} onChange={(e) => setDataScope(e.target.value)}>
            <option value="scope_3_emissions">Scope 3 emissions</option>
            <option value="energy_consumption">Energy consumption</option>
            <option value="water_withdrawal">Water withdrawal</option>
            <option value="waste_generation">Waste generation</option>
            <option value="human_rights_attestation">Human rights attestation</option>
            <option value="diversity_metrics">Diversity metrics</option>
            <option value="custom">Custom</option>
          </select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <Field label="Period start" required>
            <input style={inputStyle} type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </Field>
          <Field label="Period end" required>
            <input style={inputStyle} type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="Due by (optional)">
          <input style={inputStyle} type="date" value={dueBy} onChange={(e) => setDueBy(e.target.value)} />
        </Field>
        <Field label="Description">
          <textarea
            style={{ ...inputStyle, resize: 'vertical' }}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What you're asking for and why…"
          />
        </Field>
      </div>
      <ModalActions>
        <button style={secondaryBtn} onClick={onClose} disabled={create.isPending}>Cancel</button>
        <button
          style={primaryBtn}
          onClick={submit}
          disabled={create.isPending || !title.trim() || !periodStart || !periodEnd}
        >
          {create.isPending ? 'Sending…' : 'Send Request'}
        </button>
      </ModalActions>
    </Modal>
  );
}

// ─── Requests tab ──────────────────────────────────────────────────────

function RequestsTab() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data, isLoading } = useSupplierRequests({ status: statusFilter || undefined });
  const decide = useDecideSupplierRequest();
  const { success: toastSuccess, error: toastError } = useToast();

  const requests = data?.data ?? [];

  const handleDecide = (id: string, status: 'ACCEPTED' | 'REJECTED' | 'CANCELLED') => {
    decide.mutate(
      { id, status },
      {
        onSuccess: () => toastSuccess(`Request ${status.toLowerCase()}`),
        onError: (e: Error) => toastError(e.message),
      },
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1rem' }}>
        {['', 'PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '0.375rem 0.75rem', borderRadius: '0.375rem',
              border: '1px solid var(--border-primary)',
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '0.75rem', fontWeight: 500,
              backgroundColor: statusFilter === s ? '#1a5d3d' : 'var(--bg-card)',
              color: statusFilter === s ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '0.75rem', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
              {['Supplier', 'Title', 'Scope', 'Period', 'Status', ''].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                No data requests{statusFilter ? ` in ${statusFilter.toLowerCase()} state` : ''}.
              </td></tr>
            ) : requests.map((r, i) => (
              <tr key={r.id} style={{ borderTop: i > 0 ? '1px solid var(--border-primary)' : 'none' }}>
                <td style={tdStyle}>{r.supplier?.name ?? '—'}</td>
                <td style={tdStyle}>{r.title}</td>
                <td style={{ ...tdStyle, fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{r.dataScope}</td>
                <td style={{ ...tdStyle, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  {new Date(r.periodStart).toLocaleDateString()} → {new Date(r.periodEnd).toLocaleDateString()}
                </td>
                <td style={tdStyle}><Badge label={r.status} /></td>
                <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {r.status === 'SUBMITTED' && (
                    <>
                      <button onClick={() => handleDecide(r.id, 'ACCEPTED')} style={{ ...miniBtn, color: '#10b981', borderColor: '#10b981' }}>Accept</button>
                      <button onClick={() => handleDecide(r.id, 'REJECTED')} style={{ ...miniBtn, color: '#ef4444', borderColor: '#ef4444', marginLeft: '0.375rem' }}>Reject</button>
                    </>
                  )}
                  {r.status === 'PENDING' && (
                    <button onClick={() => handleDecide(r.id, 'CANCELLED')} style={{ ...miniBtn, color: 'var(--text-tertiary)' }}>Cancel</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────

export function SuppliersPage() {
  const [tab, setTab] = useState<'suppliers' | 'requests'>('suppliers');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SupplierStatus | ''>('');
  const [showAdd, setShowAdd] = useState(false);
  const [requestFor, setRequestFor] = useState<Supplier | null>(null);

  const { data, isLoading } = useSuppliers({
    search: search || undefined,
    status: statusFilter || undefined,
  });
  const del = useDeleteSupplier();
  const { success: toastSuccess, error: toastError } = useToast();

  const suppliers = data?.data ?? [];

  const handleDelete = (s: Supplier) => {
    if (!confirm(`Remove ${s.name}?`)) return;
    del.mutate(s.id, {
      onSuccess: () => toastSuccess('Supplier removed'),
      onError: (e: Error) => toastError(e.message),
    });
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {showAdd && <AddSupplierModal onClose={() => setShowAdd(false)} />}
      {requestFor && <RequestDataModal supplier={requestFor} onClose={() => setRequestFor(null)} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Supplier Portal</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Manage your supplier network and request Scope 3 data.
          </p>
        </div>
        {tab === 'suppliers' && (
          <button style={primaryBtn} onClick={() => setShowAdd(true)}>+ Invite Supplier</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-primary)' }}>
        {(['suppliers', 'requests'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '0.5625rem 1rem',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.875rem',
              fontWeight: tab === t ? 600 : 500,
              color: tab === t ? '#1a5d3d' : 'var(--text-tertiary)',
              borderBottom: `2px solid ${tab === t ? '#1a5d3d' : 'transparent'}`,
              marginBottom: '-1px',
              textTransform: 'capitalize',
            }}
          >
            {t === 'suppliers' ? 'Suppliers' : 'Data Requests'}
          </button>
        ))}
      </div>

      {tab === 'suppliers' ? (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input
              style={{ ...inputStyle, flex: '1 1 240px', minWidth: '200px' }}
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              {['', 'INVITED', 'ACTIVE', 'SUSPENDED'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s as SupplierStatus | '')}
                  style={{
                    padding: '0.375rem 0.75rem', borderRadius: '0.375rem',
                    border: '1px solid var(--border-primary)',
                    cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: '0.75rem', fontWeight: 500,
                    backgroundColor: statusFilter === s ? '#1a5d3d' : 'var(--bg-card)',
                    color: statusFilter === s ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {s || 'All'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '0.75rem', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
                  {['Name', 'Email', 'Category', 'Status', 'Added', ''].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</td></tr>
                ) : suppliers.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                    No suppliers yet. Click "Invite Supplier" to add one.
                  </td></tr>
                ) : suppliers.map((s, i) => (
                  <tr key={s.id} style={{ borderTop: i > 0 ? '1px solid var(--border-primary)' : 'none' }}>
                    <td style={tdStyle}>{s.name}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{s.email}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-tertiary)' }}>{s.category ?? '—'}</td>
                    <td style={tdStyle}><Badge label={s.status} /></td>
                    <td style={{ ...tdStyle, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setRequestFor(s)} style={miniBtn}>Request Data</button>
                      <button onClick={() => handleDelete(s)} style={{ ...miniBtn, marginLeft: '0.375rem', color: '#ef4444', borderColor: '#ef4444' }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <RequestsTab />
      )}
    </div>
  );
}

// ─── Shared UI helpers ─────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '0.5625rem 0.75rem',
  border: '1px solid var(--border-primary)',
  borderRadius: '0.5rem',
  backgroundColor: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: '0.875rem', fontFamily: 'inherit',
};

const primaryBtn: React.CSSProperties = {
  padding: '0.5rem 1rem', borderRadius: '0.5rem',
  border: 'none', cursor: 'pointer',
  backgroundColor: '#1a5d3d', color: '#fff',
  fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit',
};

const secondaryBtn: React.CSSProperties = {
  padding: '0.5rem 1rem', borderRadius: '0.5rem',
  border: '1px solid var(--border-primary)', cursor: 'pointer',
  backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)',
  fontWeight: 500, fontSize: '0.875rem', fontFamily: 'inherit',
};

const miniBtn: React.CSSProperties = {
  padding: '0.25rem 0.625rem', borderRadius: '0.375rem',
  border: '1px solid var(--border-primary)', cursor: 'pointer',
  background: 'var(--bg-card)', color: 'var(--text-secondary)',
  fontSize: '0.75rem', fontFamily: 'inherit', fontWeight: 500,
};

const thStyle: React.CSSProperties = {
  padding: '0.625rem 0.875rem', textAlign: 'left',
  fontSize: '0.6875rem', fontWeight: 700,
  color: 'var(--text-tertiary)', textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '0.75rem 0.875rem', fontSize: '0.8125rem',
  color: 'var(--text-primary)',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
        {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        borderRadius: '0.75rem',
        boxShadow: 'var(--shadow-xl)',
        padding: '1.5rem',
        width: '480px', maxWidth: '92vw',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '0.25rem' }} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
      {children}
    </div>
  );
}
