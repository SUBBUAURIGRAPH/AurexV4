import { useTheme } from '@aurigraph/aurex-theme-kit';
import { useState, useEffect } from 'react';

export function App() {
  const { theme, toggleTheme } = useTheme();
  const [health, setHealth] = useState<{ status: string; version: string } | null>(null);

  useEffect(() => {
    fetch('/api/v1/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <div style={{ minHeight: '100vh', padding: '2rem', fontFamily: 'Inter, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
          Aurex<span style={{ fontWeight: 400, opacity: 0.6 }}>V4</span>
        </h1>
        <button onClick={toggleTheme} style={{ cursor: 'pointer', padding: '0.5rem 1rem' }}>
          {theme === 'dark' ? 'Light' : 'Dark'} Mode
        </button>
      </header>
      <main style={{ marginTop: '3rem', maxWidth: '600px' }}>
        <h2>Sustainability Intelligence Platform</h2>
        <p style={{ opacity: 0.7, marginTop: '0.5rem' }}>
          Environmental compliance, carbon accounting, and regulatory reporting.
        </p>
        <div style={{ marginTop: '2rem', padding: '1rem', borderRadius: '8px', border: '1px solid currentColor', opacity: 0.8 }}>
          <strong>API Status:</strong>{' '}
          {health ? (
            <span style={{ color: 'green' }}>{health.status} (v{health.version})</span>
          ) : (
            <span style={{ color: 'orange' }}>Connecting...</span>
          )}
        </div>
      </main>
    </div>
  );
}
