import React from 'react';

interface StepperStep {
  label: string;
}

interface StepperProps {
  steps: StepperStep[];
  currentStep: number;
}

export function Stepper({ steps, currentStep }: StepperProps) {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    padding: '0.5rem 0 1.5rem',
  };

  return (
    <div style={containerStyle}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isFuture = index > currentStep;

        const circleColor = isCompleted
          ? '#22c55e'
          : isCurrent
            ? '#1a5d3d'
            : 'var(--border-secondary)';

        const circleStyle: React.CSSProperties = {
          width: '2rem',
          height: '2rem',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isCompleted || isCurrent ? circleColor : 'transparent',
          border: isFuture ? `2px solid var(--border-secondary)` : 'none',
          color: isCompleted || isCurrent ? '#ffffff' : 'var(--text-tertiary)',
          fontSize: '0.8125rem',
          fontWeight: 600,
          flexShrink: 0,
          transition: 'all 200ms ease',
        };

        const labelStyle: React.CSSProperties = {
          fontSize: '0.75rem',
          fontWeight: isCurrent ? 700 : 500,
          color: isCurrent
            ? '#1a5d3d'
            : isCompleted
              ? 'var(--text-primary)'
              : 'var(--text-tertiary)',
          marginTop: '0.375rem',
          textAlign: 'center',
          whiteSpace: 'nowrap',
        };

        const lineStyle: React.CSSProperties = {
          flex: 1,
          height: '2px',
          minWidth: '2rem',
          maxWidth: '6rem',
          backgroundColor: index < currentStep ? '#22c55e' : 'var(--border-secondary)',
          transition: 'background-color 200ms ease',
        };

        return (
          <React.Fragment key={index}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={circleStyle}>
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span style={labelStyle}>{step.label}</span>
            </div>
            {index < steps.length - 1 && <div style={lineStyle} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
