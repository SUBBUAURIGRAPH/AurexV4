import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface RoleGuardProps {
  allowedRoles: string[];
  children: ReactNode;
}

function normalizeRole(role: string | undefined): string {
  return (role || 'administrator').trim().toLowerCase();
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const currentRole = normalizeRole(user?.role);
  const canAccess = allowedRoles.map((r) => r.toLowerCase()).includes(currentRole);

  if (!canAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
