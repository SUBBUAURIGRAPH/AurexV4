/**
 * Strategy Model
 * MongoDB schema for trading strategies
 */

import mongoose, { Schema } from 'mongoose';
import { IStrategy, StrategyStatus, StrategyMode } from '../../types';

const strategySchema = new Schema<IStrategy>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(StrategyStatus),
      default: StrategyStatus.DRAFT,
      required: true
    },
    mode: {
      type: String,
      enum: Object.values(StrategyMode),
      default: StrategyMode.VISUAL,
      required: true
    },
    visualData: {
      nodes: [{
        id: String,
        type: String,
        position: {
          x: Number,
          y: Number
        },
        data: Schema.Types.Mixed
      }],
      connections: [{
        id: String,
        source: String,
        target: String
      }]
    },
    codeData: {
      language: {
        type: String,
        enum: ['javascript', 'python']
      },
      code: String
    },
    indicators: [{
      type: {
        type: String,
        required: true
      },
      params: Schema.Types.Mixed,
      outputs: [String]
    }],
    entryConditions: {
      type: {
        type: String,
        enum: ['AND', 'OR'],
        required: true
      },
      conditions: [{
        indicator: String,
        operator: {
          type: String,
          enum: ['GT', 'LT', 'EQ', 'GTE', 'LTE', 'CROSS_ABOVE', 'CROSS_BELOW']
        },
        value: Schema.Types.Mixed
      }]
    },
    exitConditions: {
      type: {
        type: String,
        enum: ['AND', 'OR'],
        required: true
      },
      conditions: [{
        indicator: String,
        operator: {
          type: String,
          enum: ['GT', 'LT', 'EQ', 'GTE', 'LTE', 'CROSS_ABOVE', 'CROSS_BELOW']
        },
        value: Schema.Types.Mixed
      }]
    },
    riskManagement: {
      positionSizing: {
        type: String,
        enum: ['FIXED', 'PERCENT', 'KELLY', 'VOLATILITY'],
        required: true
      },
      positionSize: {
        type: Number,
        required: true
      },
      maxPositions: {
        type: Number,
        default: 1
      },
      stopLoss: {
        type: {
          type: String,
          enum: ['FIXED', 'PERCENT', 'ATR']
        },
        value: Number
      },
      takeProfit: {
        type: {
          type: String,
          enum: ['FIXED', 'PERCENT', 'RISK_REWARD']
        },
        value: Number
      },
      trailingStop: {
        enabled: Boolean,
        type: {
          type: String,
          enum: ['FIXED', 'PERCENT', 'ATR']
        },
        value: Number
      }
    },
    timeframes: {
      type: [String],
      default: []
    },
    markets: {
      type: [String],
      default: []
    },
    version: {
      type: Number,
      default: 1
    },
    lastValidated: Date,
    validationErrors: [String],
    tags: {
      type: [String],
      default: []
    },
    isPublic: {
      type: Boolean,
      default: false
    },
    clonedFrom: String
  },
  {
    timestamps: true,
    collection: 'strategies'
  }
);

// Indexes
strategySchema.index({ userId: 1, status: 1 });
strategySchema.index({ userId: 1, createdAt: -1 });
strategySchema.index({ tags: 1 });
strategySchema.index({ name: 'text', description: 'text' });

const Strategy = mongoose.model<IStrategy>('Strategy', strategySchema);

export default Strategy;
