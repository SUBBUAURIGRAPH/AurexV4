import { useState } from 'react';
import { useMfaEnroll, useMfaVerify, useMfaDisable } from '../../hooks/useSecurity';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export function MFASetup() {
  const { user } = useAuth();
  const enroll = useMfaEnroll();
  const verify = useMfaVerify();
  const disable = useMfaDisable();
  const { success: toastSuccess, error: toastError } = useToast();

  const [enrolmentData, setEnrolmentData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisable, setShowDisable] = useState(false);

  // Note: user.mfaEnabled isn't in the AuthContext yet, so we derive status from
  // whether enrolment data is pending (null) or we've just verified (enrolmentData null + success).
  // For MVP we track locally; AuthContext can carry it later.
  const [mfaEnabled, setMfaEnabled] = useState(false);

  const handleEnroll = () => {
    enroll.mutate(undefined, {
      onSuccess: (res) => setEnrolmentData(res.data),
      onError: (e: Error) => toastError(e.message),
    });
  };

  const handleVerify = () => {
    if (code.length !== 6) return;
    verify.mutate(code, {
      onSuccess: () => {
        toastSuccess('MFA enabled');
        setMfaEnabled(true);
        setEnrolmentData(null);
        setCode('');
      },
      onError: (e: Error) => toastError(e.message),
    });
  };

  const handleDisable = () => {
    if (!disablePassword) return;
    disable.mutate(disablePassword, {
      onSuccess: () => {
        toastSuccess('MFA disabled');
        setMfaEnabled(false);
        setShowDisable(false);
        setDisablePassword('');
      },
      onError: (e: Error) => toastError(e.message),
    });
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toastSuccess(`${label} copied to clipboard`);
    } catch {
      toastError('Could not copy');
    }
  };

  // ─── Enabled state ──────────────────────────────────────────────
  if (mfaEnabled) {
    return (
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.625rem',
          padding: '0.875rem 1rem',
          backgroundColor: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Two-factor authentication is on
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: '0.125rem 0 0' }}>
              You'll be asked for a code from your authenticator app when signing in.
            </p>
          </div>
        </div>

        {!showDisable ? (
          <button
            onClick={() => setShowDisable(true)}
            style={{
              padding: '0.4375rem 0.875rem', borderRadius: '0.5rem',
              border: '1px solid #ef4444', cursor: 'pointer',
              background: 'transparent', color: '#ef4444',
              fontWeight: 600, fontSize: '0.8125rem', fontFamily: 'inherit',
            }}
          >
            Disable MFA
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                Confirm with your password
              </label>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                style={inputStyle}
                autoComplete="current-password"
              />
            </div>
            <button
              onClick={handleDisable}
              disabled={disable.isPending || !disablePassword}
              style={{
                padding: '0.5625rem 1rem', borderRadius: '0.5rem',
                border: 'none', cursor: 'pointer',
                backgroundColor: '#ef4444', color: '#fff',
                fontWeight: 600, fontSize: '0.8125rem', fontFamily: 'inherit',
                opacity: (disable.isPending || !disablePassword) ? 0.5 : 1,
              }}
            >
              {disable.isPending ? '...' : 'Disable'}
            </button>
            <button
              onClick={() => { setShowDisable(false); setDisablePassword(''); }}
              style={{
                padding: '0.5625rem 0.875rem', borderRadius: '0.5rem',
                border: '1px solid var(--border-primary)', cursor: 'pointer',
                background: 'none', color: 'var(--text-secondary)',
                fontSize: '0.8125rem', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── Not enrolled / in-progress enrolment ───────────────────────
  if (!enrolmentData) {
    return (
      <div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
          Add an extra layer of security by requiring a 6-digit code from an authenticator app (Google Authenticator, Authy, 1Password) in addition to your password.
        </p>
        <button
          onClick={handleEnroll}
          disabled={enroll.isPending}
          style={{
            padding: '0.5rem 1.125rem', borderRadius: '0.5rem',
            border: 'none', cursor: 'pointer',
            backgroundColor: '#1a5d3d', color: '#fff',
            fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit',
            opacity: enroll.isPending ? 0.5 : 1,
          }}
        >
          {enroll.isPending ? 'Starting enrolment…' : 'Enable MFA'}
        </button>
      </div>
    );
  }

  // ─── Enrolment: show secret + verify code ───────────────────────
  return (
    <div>
      <ol style={{ margin: 0, padding: '0 0 0 1.25rem', color: 'var(--text-primary)' }}>
        <li style={{ marginBottom: '1rem', fontSize: '0.875rem', lineHeight: 1.5 }}>
          <strong>Add Aurex to your authenticator app</strong> — most apps offer "Scan QR code" or "Enter setup key" options. Paste the secret below into the "Setup key" option:
          <div style={{
            marginTop: '0.5rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.625rem 0.875rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: '0.5rem',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: '0.8125rem',
            wordBreak: 'break-all',
          }}>
            <span style={{ flex: 1, color: 'var(--text-primary)' }}>{enrolmentData.secret}</span>
            <button
              onClick={() => copyToClipboard(enrolmentData.secret, 'Secret')}
              style={{
                padding: '0.25rem 0.625rem', borderRadius: '0.375rem',
                border: '1px solid var(--border-primary)', cursor: 'pointer',
                background: 'var(--bg-card)', color: 'var(--text-secondary)',
                fontSize: '0.75rem', fontFamily: 'inherit',
              }}
            >
              Copy
            </button>
          </div>
          <details style={{ marginTop: '0.5rem' }}>
            <summary style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
              Or use the raw otpauth:// URL
            </summary>
            <div style={{
              marginTop: '0.375rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              borderRadius: '0.375rem',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: '0.6875rem',
              color: 'var(--text-tertiary)',
              wordBreak: 'break-all',
            }}>
              {enrolmentData.otpauthUrl}
            </div>
          </details>
        </li>

        <li style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>
          <strong>Enter the 6-digit code</strong> shown in your authenticator for user <code>{user?.email}</code>:
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              style={{
                ...inputStyle,
                width: '140px', letterSpacing: '0.2em',
                textAlign: 'center', fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                fontSize: '1rem',
              }}
              autoFocus
            />
            <button
              onClick={handleVerify}
              disabled={verify.isPending || code.length !== 6}
              style={{
                padding: '0.5625rem 1.125rem', borderRadius: '0.5rem',
                border: 'none', cursor: 'pointer',
                backgroundColor: '#1a5d3d', color: '#fff',
                fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit',
                opacity: (verify.isPending || code.length !== 6) ? 0.5 : 1,
              }}
            >
              {verify.isPending ? 'Verifying…' : 'Verify & Enable'}
            </button>
          </div>
        </li>
      </ol>

      <button
        onClick={() => { setEnrolmentData(null); setCode(''); }}
        style={{
          marginTop: '1rem',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-tertiary)', fontSize: '0.8125rem',
          fontFamily: 'inherit', padding: '0.25rem 0',
        }}
      >
        Cancel enrolment
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  padding: '0.5625rem 0.75rem',
  border: '1px solid var(--border-primary)',
  borderRadius: '0.5rem',
  backgroundColor: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: '0.875rem', fontFamily: 'inherit',
};
