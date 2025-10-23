/**
 * Deployment Model
 * MongoDB schema for strategy deployments
 */

import mongoose, { Schema } from 'mongoose';
import { IDeployment, DeploymentStatus, DeploymentEnvironment } from '../../types';

const deploymentSchema = new Schema<IDeployment>(
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
      enum: Object.values(DeploymentStatus),
      default: DeploymentStatus.PENDING_APPROVAL,
      required: true
    },
    config: {
      environment: {
        type: String,
        enum: Object.values(DeploymentEnvironment),
        required: true
      },
      markets: {
        type: [String],
        required: true
      },
      maxCapital: {
        type: Number,
        required: true
      },
      riskLimits: {
        maxDailyLoss: {
          type: Number,
          required: true
        },
        maxDrawdown: {
          type: Number,
          required: true
        },
        maxPositionSize: {
          type: Number,
          required: true
        }
      }
    },
    approvedBy: String,
    approvedAt: Date,
    rejectedBy: String,
    rejectedAt: Date,
    rejectionReason: String,
    deployedAt: Date,
    stoppedAt: Date,
    performance: {
      totalReturn: Number,
      sharpeRatio: Number,
      maxDrawdown: Number,
      activeTrades: Number
    }
  },
  {
    timestamps: true,
    collection: 'deployments'
  }
);

// Indexes
deploymentSchema.index({ strategyId: 1, status: 1 });
deploymentSchema.index({ userId: 1, status: 1 });
deploymentSchema.index({ status: 1, createdAt: -1 });

const Deployment = mongoose.model<IDeployment>('Deployment', deploymentSchema);

export default Deployment;
