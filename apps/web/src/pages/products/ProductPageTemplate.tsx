import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

interface Feature {
  title: string;
  desc: string;
  icon: React.ReactNode;
}

interface Benefit {
  title: string;
  desc: string;
}

interface ProductPageProps {
  name: string;
  tagline: string;
  description: string;
  color: string;
  heroIcon: React.ReactNode;
  features: Feature[];
  benefits: Benefit[];
}

export function ProductPageTemplate({ name, tagline, description, color, heroIcon, features, benefits }: ProductPageProps) {
  return (
    <div>
      {/* Hero */}
      <section style={{
        padding: '6rem 1.5rem 4rem',
        background: `linear-gradient(160deg, #0f172a 0%, ${color} 100%)`,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(circle at 50% 30%, ${color}33, transparent 60%)`,
        }} />
        <div style={{ maxWidth: '720px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{
            width: '4rem', height: '4rem', borderRadius: '1rem',
            backgroundColor: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem',
            border: '1px solid rgba(255,255,255,0.15)',
          }}>
            {heroIcon}
          </div>
          <h1 style={{
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 800,
            color: '#ffffff',
            marginBottom: '0.75rem',
            letterSpacing: '-0.02em',
          }}>
            {name}
          </h1>
          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            color: 'rgba(255,255,255,0.7)',
            fontWeight: 500,
            marginBottom: '1rem',
          }}>
            {tagline}
          </p>
          <p style={{
            fontSize: '1.0625rem',
            color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.7,
            maxWidth: '560px',
            margin: '0 auto 2rem',
          }}>
            {description}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
            <Link to="/register" style={{ textDecoration: 'none' }}>
              <Button size="lg" style={{ backgroundColor: '#ffffff', color: color, borderColor: '#ffffff', fontWeight: 700 }}>
                Request Demo
              </Button>
            </Link>
            <Link to="/register" style={{ textDecoration: 'none' }}>
              <Button variant="outline" size="lg" style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#ffffff' }}>
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '5rem 1.5rem', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              Key Capabilities
            </h2>
            <p style={{ fontSize: '1.0625rem', color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto' }}>
              Purpose-built features for real-world sustainability workflows.
            </p>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem',
          }}>
            {features.map((f) => (
              <Card key={f.title} padding="lg" hover>
                <div style={{
                  width: '2.75rem', height: '2.75rem', borderRadius: '0.625rem',
                  backgroundColor: `${color}12`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: color,
                  marginBottom: '1rem',
                }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  {f.desc}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section style={{ padding: '5rem 1.5rem', backgroundColor: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '2.5rem', textAlign: 'center' }}>
            Why {name}?
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {benefits.map((b, i) => (
              <div
                key={b.title}
                style={{
                  display: 'flex',
                  gap: '1.25rem',
                  padding: '1.5rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '0.75rem',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{
                  width: '2.5rem', height: '2.5rem', borderRadius: '9999px',
                  background: `linear-gradient(135deg, ${color}20, ${color}10)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: color, fontWeight: 700, fontSize: '0.875rem',
                  flexShrink: 0,
                }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '0.375rem', color: 'var(--text-primary)' }}>
                    {b.title}
                  </h3>
                  <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    {b.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: '5rem 1.5rem',
        background: `linear-gradient(135deg, #0f172a, ${color})`,
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginBottom: '1rem' }}>
            Ready to deploy {name}?
          </h2>
          <p style={{ fontSize: '1.0625rem', color: 'rgba(255,255,255,0.75)', marginBottom: '2rem', lineHeight: 1.7 }}>
            Get a personalized demo and see how {name} integrates with your existing sustainability workflows.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
            <Link to="/register" style={{ textDecoration: 'none' }}>
              <Button size="lg" style={{ backgroundColor: '#ffffff', color: color, borderColor: '#ffffff', fontWeight: 700 }}>
                Request Demo
              </Button>
            </Link>
            <Link to="/about" style={{ textDecoration: 'none' }}>
              <Button variant="outline" size="lg" style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#ffffff' }}>
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
