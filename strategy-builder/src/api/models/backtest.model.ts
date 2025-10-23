/**
 * Backtest Model
 * MongoDB schema for backtest jobs and results
 */

import mongoose, { Schema } from 'mongoose';
import { IBacktest, BacktestStatus } from '../../types';

const backtestSchema = new Schema<IBacktest>(
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
      enum: Object.values(BacktestStatus),
      default: BacktestStatus.PENDING,
      required: true
    },
    config: {
      startDate: {
        type: Date,
        required: true
      },
      endDate: {
        type: Date,
        required: true
      },
      initialCapital: {
        type: Number,
        required: true
      },
      timeframe: {
        type: String,
        required: true
      },
      markets: {
        type: [String],
        required: true
      },
      commission: {
        type: Number,
        default: 0.001
      },
      slippage: {
        type: Number,
        default: 0.0005
      },
      warmupPeriod: Number
    },
    result: {
      metrics: {
        totalReturn: Number,
        returnPercent: Number,
        cagr: Number,
        sharpeRatio: Number,
        sortinoRatio: Number,
        calmarRatio: Number,
        maxDrawdown: Number,
        maxDrawdownPercent: Number,
        maxDrawdownDuration: Number,
        winRate: Number,
        profitFactor: Number,
        totalTrades: Number,
        winningTrades: Number,
        losingTrades: Number,
        avgWin: Number,
        avgLoss: Number,
        avgWinPercent: Number,
        avgLossPercent: Number,
        largestWin: Number,
        largestLoss: Number,
        avgTradeDuration: Number,
        avgBarsInTrade: Number,
        expectancy: Number,
        kelly: Number,
        volatility: Number
      },
      equityCurve: [{
        date: Date,
        equity: Number
      }],
      drawdownCurve: [{
        date: Date,
        drawdown: Number
      }],
      trades: [{
        id: String,
        entryTime: Date,
        entryPrice: Number,
        exitTime: Date,
        exitPrice: Number,
        direction: {
          type: String,
          enum: ['LONG', 'SHORT']
        },
        size: Number,
        pnl: Number,
        pnlPercent: Number,
        commission: Number,
        slippage: Number,
        stopLoss: Number,
        takeProfit: Number,
        exitReason: {
          type: String,
          enum: ['STOP_LOSS', 'TAKE_PROFIT', 'SIGNAL', 'EOD']
        },
        market: String
      }],
      monthlyReturns: [{
        month: String,
        return: Number
      }],
      logs: [{
        timestamp: Date,
        level: String,
        message: String
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
    collection: 'backtests'
  }
);

// Indexes
backtestSchema.index({ strategyId: 1, createdAt: -1 });
backtestSchema.index({ userId: 1, status: 1 });
backtestSchema.index({ status: 1, createdAt: -1 });

const Backtest = mongoose.model<IBacktest>('Backtest', backtestSchema);

export default Backtest;
