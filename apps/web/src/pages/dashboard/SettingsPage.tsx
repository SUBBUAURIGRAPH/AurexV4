import { useState, FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useTheme } from '@aurigraph/aurex-theme-kit';
import { api } from '../../lib/api';

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [org, setOrg] = useState(user?.organization || '');
  const [saved, setSaved] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await api.patch<{ data: { id: string } }>('/auth/me', {
        name,
        email,
      });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          Settings
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          Manage your profile, preferences, and account settings.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Profile */}
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

          <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
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
              <Input
                label="Full Name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Input
              label="Organization"
              type="text"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              placeholder="Your company or organization name"
              disabled
              hint="Organization is managed by your workspace administrator."
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
              <Button type="submit" loading={isSavingProfile}>Save Changes</Button>
            </div>
          </form>
        </Card>

        {/* Appearance */}
        <Card padding="lg">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Appearance</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '1.5rem' }}>Customize the look and feel of your dashboard.</p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {(['light', 'dark', 'auto'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTheme(mode)}
                style={{
                  padding: '0.875rem 1.5rem',
                  borderRadius: '0.5rem',
                  border: `2px solid ${theme === mode || (mode === 'auto' && theme !== 'light' && theme !== 'dark') ? '#1a5d3d' : 'var(--border-primary)'}`,
                  backgroundColor: theme === mode ? 'rgba(26, 93, 61, 0.06)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                  fontWeight: 500,
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

        {/* Notifications */}
        <Card padding="lg">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Notifications</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '1.5rem' }}>Configure how and when you receive alerts.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { label: 'Emission threshold alerts', desc: 'Get notified when emissions exceed targets', defaultOn: true },
              { label: 'Report generation complete', desc: 'Notification when a report finishes generating', defaultOn: true },
              { label: 'Weekly summary digest', desc: 'Receive a weekly email with key metrics', defaultOn: false },
              { label: 'Regulatory deadline reminders', desc: 'Alerts before compliance deadlines', defaultOn: true },
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
                      position: 'absolute',
                      top: '0.125rem',
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

        {/* Danger Zone */}
        <Card padding="lg" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem', color: '#ef4444' }}>Danger Zone</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>
            Irreversible actions. Proceed with caution.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button variant="outline" size="sm" style={{ borderColor: '#ef4444', color: '#ef4444' }}>
              Export All Data
            </Button>
            <Button variant="danger" size="sm">
              Delete Account
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
