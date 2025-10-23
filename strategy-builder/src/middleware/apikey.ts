/**
 * API Key Authentication Middleware
 */

import { Response, NextFunction } from 'express';
import APIKey from '../api/models/apikey.model';
import User from '../api/models/user.model';
import { APIKeyRequest } from '../types';
import { extractAPIKeyFromHeader } from '../utils/auth';
import { AppError } from './errorHandler';

/**
 * Authenticate request using API Key
 * Extracts API key from Authorization header, validates it, and attaches user to request
 */
export async function authenticateAPIKey(
  req: APIKeyRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKeyString = extractAPIKeyFromHeader(req.headers.authorization);

    if (!apiKeyString) {
      throw new AppError('Missing API key in Authorization header', 401);
    }

    // Hash the provided key to compare with stored hash
    const crypto = require('crypto');
    const keyHash = crypto.createHash('sha256').update(apiKeyString).digest('hex');

    // Find the API key
    const apiKeyDoc = await APIKey.findOne({ keyHash });

    if (!apiKeyDoc) {
      throw new AppError('Invalid API key', 401);
    }

    // Check if API key is active
    if (!apiKeyDoc.isActive) {
      throw new AppError('API key is inactive', 401);
    }

    // Check if API key is expired
    if (apiKeyDoc.expiresAt && new Date() > apiKeyDoc.expiresAt) {
      throw new AppError('API key has expired', 401);
    }

    // Fetch the user
    const user = await User.findById(apiKeyDoc.userId);

    if (!user || !user.isActive) {
      throw new AppError('User account is inactive or not found', 401);
    }

    // Update last used timestamp
    apiKeyDoc.lastUsed = new Date();
    await apiKeyDoc.save();

    // Attach user and API key to request
    req.user = user;
    req.apiKey = apiKeyDoc;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: error.message
        }
      });
    } else {
      next(error);
    }
  }
}

/**
 * Optional API Key authentication
 * Validates API key if provided, but continues if not
 */
export async function optionalAPIKeyAuthentication(
  req: APIKeyRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKeyString = extractAPIKeyFromHeader(req.headers.authorization);

    if (!apiKeyString) {
      return next();
    }

    const crypto = require('crypto');
    const keyHash = crypto.createHash('sha256').update(apiKeyString).digest('hex');

    const apiKeyDoc = await APIKey.findOne({ keyHash });

    if (apiKeyDoc && apiKeyDoc.isActive) {
      if (!apiKeyDoc.expiresAt || new Date() <= apiKeyDoc.expiresAt) {
        const user = await User.findById(apiKeyDoc.userId);
        if (user && user.isActive) {
          apiKeyDoc.lastUsed = new Date();
          await apiKeyDoc.save();

          req.user = user;
          req.apiKey = apiKeyDoc;
        }
      }
    }

    next();
  } catch (error) {
    // Silently fail on optional authentication
    next();
  }
}

/**
 * Require API key authentication (alternative to JWT)
 * Used for API endpoint protection with API keys
 */
export function requireAPIKey(req: APIKeyRequest, res: Response, next: NextFunction): void {
  if (!req.apiKey) {
    throw new AppError('API key authentication required', 401);
  }
  next();
}

/**
 * Check API key permissions
 * Validates that the API key has the required permissions
 */
export function requireAPIKeyPermission(...permissions: string[]) {
  return (req: APIKeyRequest, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      throw new AppError('API key required', 401);
    }

    const hasPermission = permissions.every(permission =>
      req.apiKey!.permissions.includes(permission)
    );

    if (!hasPermission) {
      throw new AppError('API key does not have required permissions', 403);
    }

    next();
  };
}

/**
 * Rate limit check for API key
 * Validates against the API key's rate limit
 */
export async function checkAPIKeyRateLimit(req: APIKeyRequest, res: Response, next: NextFunction) {
  if (!req.apiKey) {
    return next();
  }

  // This is a simplified check. In production, use Redis for accurate rate limiting
  const redis = require('redis').default;
  const redisClient = redis.createClient();

  try {
    const key = `api_key_rate_limit:${req.apiKey._id}`;
    const now = Math.floor(Date.now() / 1000);
    const hour = Math.floor(now / 3600);
    const rateKey = `${key}:${hour}`;

    const count = await redisClient.incr(rateKey);

    if (count === 1) {
      await redisClient.expire(rateKey, 3600);
    }

    if (count > req.apiKey.rateLimit) {
      throw new AppError('API rate limit exceeded', 429);
    }

    next();
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: error.message
        }
      });
    } else {
      next(error);
    }
  }
}
