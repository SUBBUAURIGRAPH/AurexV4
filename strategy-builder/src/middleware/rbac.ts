/**
 * Role-Based Access Control (RBAC) Middleware
 * Authorization based on user roles and permissions
 */

import { Response, NextFunction } from 'express';
import { AuthRequest, UserRole } from '../types';
import { logger } from '../utils/logger';

/**
 * Role hierarchy (higher index = more permissions)
 */
const ROLE_HIERARCHY: UserRole[] = [
  UserRole.VIEWER,
  UserRole.TRADER,
  UserRole.SENIOR_TRADER,
  UserRole.RISK_MANAGER,
  UserRole.ADMIN
];

/**
 * Check if user has required role or higher
 */
function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const userIndex = ROLE_HIERARCHY.indexOf(userRole);
  const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole);

  return userIndex >= requiredIndex;
}

/**
 * Require specific role (or higher in hierarchy)
 */
export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const hasRequiredRole = roles.some(role => hasRole(req.user!.role, role));

    if (!hasRequiredRole) {
      logger.warn('Access denied - insufficient role', {
        userId: req.user._id,
        userRole: req.user.role,
        requiredRoles: roles
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
      return;
    }

    next();
  };
}

/**
 * Require specific permission
 */
export function requirePermission(...permissions: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const hasPermission = permissions.every(permission =>
      req.user!.permissions.includes(permission)
    );

    if (!hasPermission) {
      logger.warn('Access denied - missing permission', {
        userId: req.user._id,
        userPermissions: req.user.permissions,
        requiredPermissions: permissions
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Missing required permissions'
        }
      });
      return;
    }

    next();
  };
}

/**
 * Check if user owns the resource or is admin
 */
export function requireOwnership(resourceUserIdField: string = 'userId') {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    // Admins bypass ownership check
    if (req.user.role === UserRole.ADMIN) {
      next();
      return;
    }

    // Check ownership based on resource field
    const resourceUserId = req.body[resourceUserIdField] || req.params[resourceUserIdField];

    if (resourceUserId !== req.user._id.toString()) {
      logger.warn('Access denied - not resource owner', {
        userId: req.user._id,
        resourceUserId
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource'
        }
      });
      return;
    }

    next();
  };
}

/**
 * Permission definitions for different operations
 */
export const Permissions = {
  // Strategy permissions
  STRATEGY_CREATE: 'strategy:create',
  STRATEGY_READ: 'strategy:read',
  STRATEGY_UPDATE: 'strategy:update',
  STRATEGY_DELETE: 'strategy:delete',
  STRATEGY_VALIDATE: 'strategy:validate',

  // Backtest permissions
  BACKTEST_CREATE: 'backtest:create',
  BACKTEST_READ: 'backtest:read',
  BACKTEST_CANCEL: 'backtest:cancel',

  // Optimization permissions
  OPTIMIZE_CREATE: 'optimize:create',
  OPTIMIZE_READ: 'optimize:read',
  OPTIMIZE_CANCEL: 'optimize:cancel',

  // Deployment permissions
  DEPLOY_PAPER: 'deploy:paper',
  DEPLOY_LIVE: 'deploy:live',
  DEPLOY_APPROVE: 'deploy:approve',
  DEPLOY_REJECT: 'deploy:reject',
  DEPLOY_STOP: 'deploy:stop',

  // Admin permissions
  USER_MANAGE: 'user:manage',
  SYSTEM_CONFIG: 'system:config',
  AUDIT_VIEW: 'audit:view'
};

/**
 * Default permissions by role
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.VIEWER]: [
    Permissions.STRATEGY_READ,
    Permissions.BACKTEST_READ,
    Permissions.OPTIMIZE_READ
  ],

  [UserRole.TRADER]: [
    Permissions.STRATEGY_CREATE,
    Permissions.STRATEGY_READ,
    Permissions.STRATEGY_UPDATE,
    Permissions.STRATEGY_DELETE,
    Permissions.STRATEGY_VALIDATE,
    Permissions.BACKTEST_CREATE,
    Permissions.BACKTEST_READ,
    Permissions.BACKTEST_CANCEL,
    Permissions.OPTIMIZE_CREATE,
    Permissions.OPTIMIZE_READ,
    Permissions.OPTIMIZE_CANCEL,
    Permissions.DEPLOY_PAPER
  ],

  [UserRole.SENIOR_TRADER]: [
    Permissions.STRATEGY_CREATE,
    Permissions.STRATEGY_READ,
    Permissions.STRATEGY_UPDATE,
    Permissions.STRATEGY_DELETE,
    Permissions.STRATEGY_VALIDATE,
    Permissions.BACKTEST_CREATE,
    Permissions.BACKTEST_READ,
    Permissions.BACKTEST_CANCEL,
    Permissions.OPTIMIZE_CREATE,
    Permissions.OPTIMIZE_READ,
    Permissions.OPTIMIZE_CANCEL,
    Permissions.DEPLOY_PAPER,
    Permissions.DEPLOY_LIVE
  ],

  [UserRole.RISK_MANAGER]: [
    Permissions.STRATEGY_READ,
    Permissions.BACKTEST_READ,
    Permissions.OPTIMIZE_READ,
    Permissions.DEPLOY_APPROVE,
    Permissions.DEPLOY_REJECT,
    Permissions.DEPLOY_STOP,
    Permissions.AUDIT_VIEW
  ],

  [UserRole.ADMIN]: [
    ...Object.values(Permissions)
  ]
};
