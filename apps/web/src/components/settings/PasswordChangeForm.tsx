import { useState, FormEvent } from 'react';
import { useChangePassword } from '../../hooks/useSecurity';
import { useToast } from '../../contexts/ToastContext';

export function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const changePassword = useChangePassword();
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  const tooShort = newPassword.length > 0 && newPassword.length < 12;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (tooShort || mismatch || !currentPassword || !newPassword) return;

    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          toastSuccess('Password changed');
          toastInfo('All sessions have been invalidated — please log in again.');
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          // Force re-login after sessions are invalidated server-side
          setTimeout(() => {
            localStorage.removeItem('aurex_token');
            localStorage.removeItem('aurex_refresh_token');
            window.location.href = '/login';
          }, 2000);
        },
        onError: (e: Error) => toastError(e.message),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Field label="Current Password">
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          style={inputStyle}
          autoComplete="current-password"
        />
      </Field>

      <Field label="New Password" hint="At least 12 characters">
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          style={{ ...inputStyle, borderColor: tooShort ? '#ef4444' : 'var(--border-primary)' }}
          autoComplete="new-password"
        />
        {tooShort && (
          <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>
            Must be at least 12 characters
          </p>
        )}
      </Field>

      <Field label="Confirm New Password">
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          style={{ ...inputStyle, borderColor: mismatch ? '#ef4444' : 'var(--border-primary)' }}
          autoComplete="new-password"
        />
        {mismatch && (
          <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>
            Passwords don't match
          </p>
        )}
      </Field>

      <div style={{
        padding: '0.75rem 1rem',
        backgroundColor: 'rgba(245,158,11,0.08)',
        border: '1px solid rgba(245,158,11,0.25)',
        borderRadius: '0.5rem',
        fontSize: '0.8125rem',
        color: 'var(--text-secondary)',
      }}>
        Changing your password will sign you out of all sessions, including this one.
      </div>

      <div>
        <button
          type="submit"
          disabled={changePassword.isPending || tooShort || mismatch || !currentPassword || !newPassword}
          style={{
            padding: '0.5rem 1.125rem', borderRadius: '0.5rem',
            border: 'none', cursor: 'pointer',
            backgroundColor: '#1a5d3d', color: '#fff',
            fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit',
            opacity: (changePassword.isPending || tooShort || mismatch || !currentPassword || !newPassword) ? 0.5 : 1,
          }}
        >
          {changePassword.isPending ? 'Changing…' : 'Change Password'}
        </button>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '0.5625rem 0.75rem',
  border: '1px solid var(--border-primary)',
  borderRadius: '0.5rem',
  backgroundColor: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: '0.875rem', fontFamily: 'inherit',
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
        {label}
        {hint && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: '0.5rem' }}>· {hint}</span>}
      </label>
      {children}
    </div>
  );
}
