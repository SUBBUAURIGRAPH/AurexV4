/**
 * Optimization Model
 * MongoDB schema for optimization jobs and results
 */

import mongoose, { Schema } from 'mongoose';
import { IOptimization, OptimizationStatus, OptimizationAlgorithm } from '../../types';

const optimizationSchema = new Schema<IOptimization>(
  {
    strategyId: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(OptimizationStatus),
      default: OptimizationStatus.PENDING,
      required: true
    },
    config: {
      algorithm: {
        type: String,
        enum: Object.values(OptimizationAlgorithm),
        required: true
      },
      parameters: [{
        name: String,
        min: Number,
        max: Number,
        step: Number,
        type: {
          type: String,
          enum: ['int', 'float']
        }
      }],
      objectiveMetric: {
        type: String,
        required: true
      },
      constraints: {
        minTrades: Number,
        minWinRate: Number,
        maxDrawdown: Number
      },
      geneticConfig: {
        populationSize: Number,
        generations: Number,
        mutationRate: Number,
        crossoverRate: Number
      },
      bayesianConfig: {
        iterations: Number,
        acquisitionFunction: {
          type: String,
          enum: ['EI', 'PI', 'UCB']
        }
      }
    },
    backtestConfig: {
      startDate: Date,
      endDate: Date,
      initialCapital: Number,
      timeframe: String,
      markets: [String],
      commission: Number,
      slippage: Number,
      warmupPeriod: Number
    },
    result: {
      bestParameters: Schema.Types.Mixed,
      bestMetrics: Schema.Types.Mixed,
      allResults: [{
        parameters: Schema.Types.Mixed,
        metrics: Schema.Types.Mixed
      }],
      convergencePlot: [{
        iteration: Number,
        value: Number
      }]
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    error: String,
    startTime: {
      type: Date,
      required: true
    },
    endTime: Date,
    executionTime: Number
  },
  {
    timestamps: true,
    collection: 'optimizations'
  }
);

// Indexes
optimizationSchema.index({ strategyId: 1, createdAt: -1 });
optimizationSchema.index({ userId: 1, status: 1 });

const Optimization = mongoose.model<IOptimization>('Optimization', optimizationSchema);

export default Optimization;
