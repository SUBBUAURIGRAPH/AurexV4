import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface RoleGuardProps {
  allowedRoles: string[];
  children: ReactNode;
}

function normalizeRole(role: string | undefined): string {
  return (role || 'viewer').trim().toLowerCase();
}

/**
 * FLOW-REWORK: many App.tsx routes still pass legacy role labels
 * ('administrator', 'editor') that don't exist in the Role enum
 * (super_admin | org_admin | manager | analyst | viewer | maker |
 * checker | approver | auditor | doe | dna). Without this expansion,
 * every Billing / Operations / Compliance / Audit-Logs route bounces
 * authenticated users back to /dashboard.
 *
 * Map legacy intent → real-role superset. The mapping is intentionally
 * permissive so screens aren't gated by frontend role checks alone —
 * the API still enforces fine-grained authorisation server-side.
 */
const LEGACY_ROLE_EXPANSIONS: Record<string, string[]> = {
  administrator: ['super_admin', 'org_admin'],
  editor: ['org_admin', 'maker', 'manager'],
};

function expandAllowed(roles: string[]): Set<string> {
  const out = new Set<string>();
  for (const r of roles) {
    const lower = r.toLowerCase();
    out.add(lower);
    for (const x of LEGACY_ROLE_EXPANSIONS[lower] ?? []) out.add(x);
  }
  // SUPER_ADMIN is omnipotent on the frontend — never block.
  out.add('super_admin');
  return out;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const currentRole = normalizeRole(user?.role);
  const canAccess = expandAllowed(allowedRoles).has(currentRole);

  if (!canAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
