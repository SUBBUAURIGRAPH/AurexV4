import { ReactNode } from 'react';

interface LegalSection {
  title: string;
  content: ReactNode;
}

interface LegalPageTemplateProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections: LegalSection[];
}

export function LegalPageTemplate({ title, subtitle, lastUpdated, sections }: LegalPageTemplateProps) {
  return (
    <section
      style={{
        backgroundColor: 'var(--bg-primary)',
        padding: '3rem 0 4rem',
      }}
    >
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 1.5rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              marginBottom: '0.75rem',
            }}
          >
            {title}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.7 }}>{subtitle}</p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8125rem', marginTop: '0.875rem' }}>
            Last updated: {lastUpdated}
          </p>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sections.map((section) => (
            <article
              key={section.title}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-primary)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
              }}
            >
              <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.625rem' }}>
                {section.title}
              </h2>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.75 }}>{section.content}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
