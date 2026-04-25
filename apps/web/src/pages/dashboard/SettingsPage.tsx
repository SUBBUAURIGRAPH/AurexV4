import { useState, FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useTheme } from '@aurigraph/aurex-theme-kit';
import { api } from '../../lib/api';
import { PasswordChangeForm } from '../../components/settings/PasswordChangeForm';
import { MFASetup } from '../../components/settings/MFASetup';
import { SessionList } from '../../components/settings/SessionList';
import { ExportMenu } from '../../components/settings/ExportMenu';
import { useToast } from '../../contexts/ToastContext';

type Tab = 'profile' | 'security' | 'appearance' | 'notifications' | 'data';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'profile', label: 'Profile' },
  { key: 'security', label: 'Security' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'data', label: 'Data & Export' },
];

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          Settings
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          Manage your profile, security, preferences, and data.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: '0.25rem', marginBottom: '1.5rem',
        borderBottom: '1px solid var(--border-primary)',
        overflowX: 'auto',
      }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '0.5625rem 1rem',
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '0.875rem',
                fontWeight: active ? 600 : 500,
                color: active ? '#1a5d3d' : 'var(--text-tertiary)',
                borderBottom: `2px solid ${active ? '#1a5d3d' : 'transparent'}`,
                marginBottom: '-1px',
                whiteSpace: 'nowrap',
                transition: 'all 150ms',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Panels */}
      {tab === 'profile' && <ProfileTab />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'appearance' && <AppearanceTab />}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'data' && <DataTab />}
    </div>
  );
}

// ─── Profile ────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [org] = useState(user?.organization || '');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const { error: toastError } = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch<{ data: { id: string } }>('/auth/me', { name, email });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toastError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padding="lg">
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Profile Information</h3>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '1.5rem' }}>Update your personal details.</p>

      {saved && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: 'rgba(34, 197, 94, 0.08)',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          borderRadius: '0.5rem',
          marginBottom: '1.25rem',
          fontSize: '0.875rem',
          color: '#16a34a',
        }}>
          Profile updated successfully.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '0.5rem' }}>
          <div style={{
            width: '4rem', height: '4rem', borderRadius: '9999px',
            backgroundColor: 'rgba(26, 93, 61, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#1a5d3d', fontWeight: 700, fontSize: '1.5rem',
            flexShrink: 0,
          }}>
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name || 'User'}</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>{user?.role || 'Administrator'}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <Input label="Full Name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <Input
          label="Organization"
          type="text"
          value={org}
          disabled
          hint="Organization is managed by your workspace administrator."
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
          <Button type="submit" loading={saving}>Save Changes</Button>
        </div>
      </form>
    </Card>
  );
}

// ─── Security ───────────────────────────────────────────────────────────

function SecurityTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Card padding="lg">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Change Password</h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>
          Use a unique, strong password for Aurex.
        </p>
        <PasswordChangeForm />
      </Card>

      <Card padding="lg">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Two-Factor Authentication (MFA)</h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>
          Protect your account with an authenticator-app code at sign-in.
        </p>
        <MFASetup />
      </Card>

      <Card padding="lg">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Active Sessions</h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>
          These devices are currently signed in to your account. Revoke any you don't recognise.
        </p>
        <SessionList />
      </Card>
    </div>
  );
}

// ─── Appearance ─────────────────────────────────────────────────────────

function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  return (
    <Card padding="lg">
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Appearance</h3>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '1.5rem' }}>Customize the look and feel of your dashboard.</p>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {(['light', 'dark', 'auto'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setTheme(mode)}
            style={{
              padding: '0.875rem 1.5rem', borderRadius: '0.5rem',
              border: `2px solid ${theme === mode ? '#1a5d3d' : 'var(--border-primary)'}`,
              backgroundColor: theme === mode ? 'rgba(26, 93, 61, 0.06)' : 'var(--bg-primary)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 500,
              color: 'var(--text-primary)',
              transition: 'all 150ms',
            }}
          >
            {mode === 'light' && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
            )}
            {mode === 'dark' && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            )}
            {mode === 'auto' && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
            )}
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>
    </Card>
  );
}

// ─── Notifications (stub, wired to backend when prefs endpoint stabilises) ──

function NotificationsTab() {
  return (
    <Card padding="lg">
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Notification Preferences</h3>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>
        Configure how and when you receive alerts.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {[
          { label: 'Email on status change', desc: 'Receive an email when your submissions change state.', defaultOn: true },
          { label: 'Email on approval request', desc: 'Receive an email when someone needs your approval.', defaultOn: true },
          { label: 'In-app on status change', desc: 'Surface state changes in the notifications bell.', defaultOn: true },
          { label: 'In-app on approval request', desc: 'Surface approval requests in the notifications bell.', defaultOn: true },
        ].map((n) => (
          <div key={n.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.875rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-primary)',
          }}>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{n.label}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.125rem' }}>{n.desc}</p>
            </div>
            <label style={{ position: 'relative', width: '2.75rem', height: '1.5rem', flexShrink: 0, cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked={n.defaultOn} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{
                position: 'absolute', inset: 0,
                backgroundColor: n.defaultOn ? '#1a5d3d' : 'var(--border-secondary)',
                borderRadius: '9999px',
                transition: 'background 200ms',
              }}>
                <span style={{
                  position: 'absolute', top: '0.125rem',
                  left: n.defaultOn ? '1.375rem' : '0.125rem',
                  width: '1.25rem', height: '1.25rem',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  transition: 'left 200ms',
                }} />
              </span>
            </label>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Data & Export ──────────────────────────────────────────────────────

function DataTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Card padding="lg">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Export Your Data</h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>
          Download CSV copies of your organisation's data for backup or external analysis.
        </p>
        <ExportMenu />
      </Card>

      <Card padding="lg" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem', color: '#ef4444' }}>Danger Zone</h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>
          Irreversible actions. Proceed with caution.
        </p>
        {/* AAT-WORKFLOW (Wave 9a): account deletion API isn't built — disable so the click is honest. */}
        <Button
          variant="danger"
          size="sm"
          disabled
          title="Coming soon — email support@aurex.in to request account deletion"
        >
          Delete Account
        </Button>
      </Card>
    </div>
  );
}
