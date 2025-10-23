/**
 * API Key Routes
 * Endpoints for managing user API keys
 */

import { Router } from 'express';
import APIKey from '../models/apikey.model';
import User from '../models/user.model';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { generateAPIKey } from '../../utils/auth';
import { AuthRequest } from '../../types';
import { z } from 'zod';
import { validate } from '../../middleware/validation';

const router = Router();

// Validation schemas
const createAPIKeySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
  rateLimit: z.number().int().positive().default(1000)
});

const updateAPIKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  rateLimit: z.number().int().positive().optional()
});

/**
 * POST /api/v1/apikeys
 * Create a new API key for the authenticated user
 */
router.post(
  '/',
  authenticate,
  validate('body', createAPIKeySchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user!;
    const { name, description, permissions, expiresAt, rateLimit } = req.body;

    // Generate new API key
    const { key, keyHash, keyPrefix } = generateAPIKey();

    // Create API key document
    const apiKey = new APIKey({
      userId: user._id,
      name,
      keyHash,
      keyPrefix,
      description,
      permissions: permissions || [],
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      rateLimit: rateLimit || 1000,
      isActive: true
    });

    await apiKey.save();

    // Return the key only once (it can't be retrieved later)
    res.status(201).json({
      success: true,
      data: {
        id: apiKey._id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        key: key, // Full key shown only once
        description: apiKey.description,
        permissions: apiKey.permissions,
        rateLimit: apiKey.rateLimit,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt
      },
      meta: {
        timestamp: new Date().toISOString(),
        warning: 'Store this key safely. You will not be able to see it again.'
      }
    });
  })
);

/**
 * GET /api/v1/apikeys
 * List all API keys for the authenticated user
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user!;
    const { limit = 50, skip = 0 } = req.query;

    const apiKeys = await APIKey.find({ userId: user._id })
      .select('-keyHash')
      .limit(Math.min(parseInt(limit as string) || 50, 100))
      .skip(parseInt(skip as string) || 0)
      .sort({ createdAt: -1 });

    const total = await APIKey.countDocuments({ userId: user._id });

    res.json({
      success: true,
      data: apiKeys,
      meta: {
        timestamp: new Date().toISOString(),
        page: Math.floor((parseInt(skip as string) || 0) / (parseInt(limit as string) || 50)) + 1,
        limit: Math.min(parseInt(limit as string) || 50, 100),
        total
      }
    });
  })
);

/**
 * GET /api/v1/apikeys/:keyId
 * Get details of a specific API key
 */
router.get(
  '/:keyId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user!;
    const { keyId } = req.params;

    const apiKey = await APIKey.findOne({
      _id: keyId,
      userId: user._id
    }).select('-keyHash');

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'API key not found'
        }
      });
    }

    res.json({
      success: true,
      data: apiKey,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  })
);

/**
 * PATCH /api/v1/apikeys/:keyId
 * Update an API key
 */
router.patch(
  '/:keyId',
  authenticate,
  validate('body', updateAPIKeySchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user!;
    const { keyId } = req.params;
    const { name, description, permissions, isActive, rateLimit } = req.body;

    const apiKey = await APIKey.findOne({
      _id: keyId,
      userId: user._id
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'API key not found'
        }
      });
    }

    // Update fields
    if (name) apiKey.name = name;
    if (description !== undefined) apiKey.description = description;
    if (permissions !== undefined) apiKey.permissions = permissions;
    if (isActive !== undefined) apiKey.isActive = isActive;
    if (rateLimit !== undefined) apiKey.rateLimit = rateLimit;

    await apiKey.save();

    res.json({
      success: true,
      data: apiKey,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  })
);

/**
 * DELETE /api/v1/apikeys/:keyId
 * Revoke/delete an API key
 */
router.delete(
  '/:keyId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user!;
    const { keyId } = req.params;

    const apiKey = await APIKey.findOne({
      _id: keyId,
      userId: user._id
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'API key not found'
        }
      });
    }

    await APIKey.deleteOne({ _id: keyId });

    res.json({
      success: true,
      data: {
        id: keyId,
        message: 'API key successfully revoked'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  })
);

/**
 * POST /api/v1/apikeys/:keyId/revoke
 * Revoke an API key (alternative to DELETE)
 */
router.post(
  '/:keyId/revoke',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user!;
    const { keyId } = req.params;

    const apiKey = await APIKey.findOne({
      _id: keyId,
      userId: user._id
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'API key not found'
        }
      });
    }

    // Set to inactive instead of deleting
    apiKey.isActive = false;
    await apiKey.save();

    res.json({
      success: true,
      data: {
        id: keyId,
        message: 'API key successfully revoked'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  })
);

/**
 * POST /api/v1/apikeys/:keyId/rotate
 * Rotate an API key (create new one, deactivate old one)
 */
router.post(
  '/:keyId/rotate',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user!;
    const { keyId } = req.params;

    const oldKey = await APIKey.findOne({
      _id: keyId,
      userId: user._id
    });

    if (!oldKey) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'API key not found'
        }
      });
    }

    // Deactivate old key
    oldKey.isActive = false;
    await oldKey.save();

    // Generate new key with same properties
    const { key, keyHash, keyPrefix } = generateAPIKey();

    const newKey = new APIKey({
      userId: user._id,
      name: oldKey.name,
      keyHash,
      keyPrefix,
      description: oldKey.description,
      permissions: oldKey.permissions,
      expiresAt: oldKey.expiresAt,
      rateLimit: oldKey.rateLimit,
      isActive: true
    });

    await newKey.save();

    res.status(201).json({
      success: true,
      data: {
        id: newKey._id,
        name: newKey.name,
        keyPrefix: newKey.keyPrefix,
        key: key, // Full key shown only once
        description: newKey.description,
        permissions: newKey.permissions,
        rateLimit: newKey.rateLimit,
        expiresAt: newKey.expiresAt,
        createdAt: newKey.createdAt
      },
      meta: {
        timestamp: new Date().toISOString(),
        warning: 'Old key has been deactivated. Store new key safely.'
      }
    });
  })
);

/**
 * GET /api/v1/apikeys/validate
 * Validate the current API key
 */
router.get(
  '/validate/current',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user!;

    res.json({
      success: true,
      data: {
        authenticated: true,
        userId: user._id,
        email: user.email,
        username: user.username,
        role: user.role
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  })
);

export default router;
