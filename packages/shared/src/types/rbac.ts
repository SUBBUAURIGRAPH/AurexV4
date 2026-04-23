export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ORG_ADMIN: 'org_admin',
  MANAGER: 'manager',
  ANALYST: 'analyst',
  VIEWER: 'viewer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export type Permission =
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'emissions:read'
  | 'emissions:write'
  | 'reports:read'
  | 'reports:write'
  | 'reports:export'
  | 'settings:read'
  | 'settings:write'
  | 'audit:read';
