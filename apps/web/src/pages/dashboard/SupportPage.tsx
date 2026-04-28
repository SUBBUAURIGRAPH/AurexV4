/**
 * AAT-FLOW6 — Support page rewrite.
 *
 * Was a hardcoded ticket table referencing fake "SUP-9812" tickets and a
 * disabled "Create Ticket" button. We don't have a support-ticket model
 * yet (no SupportTicket Prisma model — and per FLOW6 scope we don't add
 * one). The honest story is: contact email, customer-success owner, and
 * a clear pointer to where to send the request.
 */
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export function SupportPage() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          Support Center
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          Reach the Aurex team for technical, compliance, or account questions.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <Card padding="lg">
          <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
            Email support
          </p>
          <h3 style={{ fontSize: '1.0625rem', color: 'var(--text-primary)', marginTop: '0.5rem' }}>
            <a href="mailto:contact@aurex.in" style={{ color: '#1a5d3d', textDecoration: 'none' }}>
              contact@aurex.in
            </a>
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Response target: 1 business day.
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                window.location.href = 'mailto:contact@aurex.in?subject=Aurex%20support%20request';
              }}
            >
              Email support
            </Button>
          </div>
        </Card>

        <Card padding="lg">
          <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
            Documentation
          </p>
          <h3 style={{ fontSize: '1.0625rem', color: 'var(--text-primary)', marginTop: '0.5rem' }}>Aurex docs</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Onboarding guides, API reference, BRSR / DPDP runbooks.
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.open('https://aurex.in/docs', '_blank', 'noopener');
              }}
            >
              Open docs
            </Button>
          </div>
        </Card>

        <Card padding="lg">
          <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
            Status & incidents
          </p>
          <h3 style={{ fontSize: '1.0625rem', color: 'var(--text-primary)', marginTop: '0.5rem' }}>Platform status</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Current uptime and posted incidents.
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.open('https://aurex.in/status', '_blank', 'noopener');
              }}
            >
              Open status page
            </Button>
          </div>
        </Card>
      </div>

      <Card padding="lg">
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          A self-service ticket portal is on the roadmap. In the meantime, every email to{' '}
          <a href="mailto:contact@aurex.in" style={{ color: '#1a5d3d' }}>contact@aurex.in</a> is
          tracked and routed to the right team member.
        </p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
          For urgent compliance / incident reports (DPDP §8 breach intimation), please copy{' '}
          <a href="mailto:dpo@aurex.in" style={{ color: '#1a5d3d' }}>dpo@aurex.in</a>.
        </p>
      </Card>
    </div>
  );
}
