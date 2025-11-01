/**
 * Error Boundary Component
 * Catches and displays React component errors gracefully
 * @version 1.0.0
 */

import React, { ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #000000 0%, #0f0f23 50%, #1a0033 100%)',
            color: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            padding: '2rem',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: '3rem',
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              maxWidth: '500px',
            }}
          >
            <h1
              style={{
                fontSize: '3rem',
                marginBottom: '1rem',
                color: '#ff6b6b',
              }}
            >
              ⚠️
            </h1>
            <h2
              style={{
                fontSize: '1.5rem',
                marginBottom: '0.5rem',
                color: '#ffffff',
              }}
            >
              Something Went Wrong
            </h2>
            <p
              style={{
                fontSize: '0.95rem',
                color: '#a1a1a1',
                marginBottom: '2rem',
              }}
            >
              We encountered an error while rendering this component.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details
                style={{
                  textAlign: 'left',
                  background: 'rgba(255, 107, 107, 0.1)',
                  padding: '1rem',
                  borderRadius: '8px',
                  marginBottom: '2rem',
                  cursor: 'pointer',
                }}
              >
                <summary style={{ cursor: 'pointer', color: '#ff6b6b', marginBottom: '0.5rem' }}>
                  Error Details (Development Only)
                </summary>
                <pre
                  style={{
                    fontSize: '0.85rem',
                    color: '#a1a1a1',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.href = '/'}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                color: '#ffffff',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: '500',
                transition: 'all 0.3s ease',
              }}
              onMouseOver={(e) => {
                (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
                (e.target as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.4)';
              }}
              onMouseOut={(e) => {
                (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
                (e.target as HTMLButtonElement).style.boxShadow = 'none';
              }}
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
