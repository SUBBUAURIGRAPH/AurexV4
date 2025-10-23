/**
 * API Key Model
 * MongoDB schema for API keys used by registered users
 */

import mongoose, { Schema } from 'mongoose';
import { IAPIKey } from '../../types';
import crypto from 'crypto';

const apiKeySchema = new Schema<IAPIKey>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    keyHash: {
      type: String,
      required: true,
      unique: true
    },
    keyPrefix: {
      type: String,
      required: true,
      // Store first 8 characters for display
      maxlength: 8
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    permissions: {
      type: [String],
      default: []
      // Can be scoped to specific actions: ['strategy:read', 'backtest:create', etc.]
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastUsed: {
      type: Date
    },
    expiresAt: {
      type: Date
      // Optional: set expiration date for time-limited keys
    },
    rateLimit: {
      type: Number,
      default: 1000
      // Requests per hour
    }
  },
  {
    timestamps: true,
    collection: 'api_keys'
  }
);

// Indexes
apiKeySchema.index({ userId: 1 });
apiKeySchema.index({ keyHash: 1 });
apiKeySchema.index({ userId: 1, isActive: 1 });
apiKeySchema.index({ expiresAt: 1 }, { sparse: true });

// Static method to generate a new API key
apiKeySchema.statics.generateKey = function() {
  const randomBytes = crypto.randomBytes(32);
  const fullKey = `aur_${randomBytes.toString('hex')}`;
  const keyPrefix = fullKey.substring(0, 8);
  const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

  return {
    key: fullKey,
    keyHash,
    keyPrefix
  };
};

// Static method to hash an API key
apiKeySchema.statics.hashKey = function(key: string) {
  return crypto.createHash('sha256').update(key).digest('hex');
};

// Static method to verify an API key
apiKeySchema.statics.verifyKey = function(key: string, keyHash: string) {
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return hash === keyHash;
};

// Virtual for user ID string
apiKeySchema.virtual('id').get(function(this: IAPIKey) {
  return this._id.toString();
});

// Transform JSON output - never return full key or hash
apiKeySchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.keyHash;
    return ret;
  }
});

const APIKey = mongoose.model<IAPIKey>('APIKey', apiKeySchema);

export default APIKey;
