/**
 * Conflict Resolver Service
 * Handles data conflicts intelligently when discrepancies occur
 * Supports multiple resolution strategies
 * @version 1.0.0
 */

export enum ConflictResolutionStrategy {
  LAST_WRITE_WINS = 'last_write_wins',
  FIRST_WRITE_WINS = 'first_write_wins',
  HIGHEST_VALUE = 'highest_value',
  LOWEST_VALUE = 'lowest_value',
  MERGE = 'merge',
  MANUAL = 'manual',
  SOURCE_PRIORITY = 'source_priority',
  CONSENSUS = 'consensus',
  TIMESTAMP_BASED = 'timestamp_based',
}

export interface ConflictData {
  localValue: unknown;
  remoteValue: unknown;
  localTimestamp?: Date;
  remoteTimestamp?: Date;
  source: string;
  destination: string;
  metadata?: Record<string, unknown>;
}

export interface ConflictResolution {
  resolvedValue: unknown;
  strategy: ConflictResolutionStrategy;
  reason: string;
  confidence: number;
  appliedAt: Date;
  discardedValue: unknown;
}

export interface ConflictHistory {
  id: string;
  timestamp: Date;
  conflictData: ConflictData;
  resolution: ConflictResolution;
  resolvedBy: string;
}

export interface SourcePriority {
  source: string;
  priority: number;
}

export interface ConflictResolverConfig {
  defaultStrategy: ConflictResolutionStrategy;
  sourcePriorities: SourcePriority[];
  consensusThreshold: number;
  mergeStrategy: 'deep' | 'shallow';
  enableManualReview: boolean;
  manualReviewTimeout: number;
  trackHistory: boolean;
  maxHistorySize: number;
}

/**
 * Intelligent conflict resolution service
 */
export class ConflictResolver {
  private config: ConflictResolverConfig;
  private conflictHistory: ConflictHistory[];
  private manualReviewQueue: Map<string, ConflictData>;
  private manualReviewHandlers: Map<string, (resolution: unknown) => void>;

  constructor(
    defaultStrategy: ConflictResolutionStrategy = ConflictResolutionStrategy.LAST_WRITE_WINS,
    config?: Partial<ConflictResolverConfig>
  ) {
    this.config = {
      defaultStrategy,
      sourcePriorities: config?.sourcePriorities ?? [],
      consensusThreshold: config?.consensusThreshold ?? 0.6,
      mergeStrategy: config?.mergeStrategy ?? 'deep',
      enableManualReview: config?.enableManualReview ?? false,
      manualReviewTimeout: config?.manualReviewTimeout ?? 300000, // 5 minutes
      trackHistory: config?.trackHistory ?? true,
      maxHistorySize: config?.maxHistorySize ?? 1000,
    };

    this.conflictHistory = [];
    this.manualReviewQueue = new Map();
    this.manualReviewHandlers = new Map();
  }

  /**
   * Resolve a conflict between local and remote data
   */
  async resolve(conflictData: ConflictData): Promise<unknown> {
    const strategy = this.config.defaultStrategy;

    const resolution = await this.applyStrategy(strategy, conflictData);

    if (this.config.trackHistory) {
      this.recordConflictResolution(conflictData, resolution);
    }

    return resolution.resolvedValue;
  }

  /**
   * Resolve with a specific strategy
   */
  async resolveWithStrategy(
    conflictData: ConflictData,
    strategy: ConflictResolutionStrategy
  ): Promise<ConflictResolution> {
    const resolution = await this.applyStrategy(strategy, conflictData);

    if (this.config.trackHistory) {
      this.recordConflictResolution(conflictData, resolution);
    }

    return resolution;
  }

  /**
   * Apply conflict resolution strategy
   */
  private async applyStrategy(
    strategy: ConflictResolutionStrategy,
    conflictData: ConflictData
  ): Promise<ConflictResolution> {
    switch (strategy) {
      case ConflictResolutionStrategy.LAST_WRITE_WINS:
        return this.lastWriteWins(conflictData);

      case ConflictResolutionStrategy.FIRST_WRITE_WINS:
        return this.firstWriteWins(conflictData);

      case ConflictResolutionStrategy.HIGHEST_VALUE:
        return this.highestValue(conflictData);

      case ConflictResolutionStrategy.LOWEST_VALUE:
        return this.lowestValue(conflictData);

      case ConflictResolutionStrategy.MERGE:
        return this.mergeValues(conflictData);

      case ConflictResolutionStrategy.MANUAL:
        return this.manualResolution(conflictData);

      case ConflictResolutionStrategy.SOURCE_PRIORITY:
        return this.sourcePriority(conflictData);

      case ConflictResolutionStrategy.CONSENSUS:
        return this.consensusResolution(conflictData);

      case ConflictResolutionStrategy.TIMESTAMP_BASED:
        return this.timestampBased(conflictData);

      default:
        throw new Error(`Unsupported resolution strategy: ${strategy}`);
    }
  }

  /**
   * Last write wins strategy
   */
  private lastWriteWins(conflictData: ConflictData): ConflictResolution {
    const localTime = conflictData.localTimestamp?.getTime() ?? 0;
    const remoteTime = conflictData.remoteTimestamp?.getTime() ?? 0;

    const useRemote = remoteTime >= localTime;

    return {
      resolvedValue: useRemote ? conflictData.remoteValue : conflictData.localValue,
      strategy: ConflictResolutionStrategy.LAST_WRITE_WINS,
      reason: `Selected ${useRemote ? 'remote' : 'local'} value based on latest timestamp`,
      confidence: 1.0,
      appliedAt: new Date(),
      discardedValue: useRemote ? conflictData.localValue : conflictData.remoteValue,
    };
  }

  /**
   * First write wins strategy
   */
  private firstWriteWins(conflictData: ConflictData): ConflictResolution {
    const localTime = conflictData.localTimestamp?.getTime() ?? 0;
    const remoteTime = conflictData.remoteTimestamp?.getTime() ?? 0;

    const useLocal = localTime <= remoteTime;

    return {
      resolvedValue: useLocal ? conflictData.localValue : conflictData.remoteValue,
      strategy: ConflictResolutionStrategy.FIRST_WRITE_WINS,
      reason: `Selected ${useLocal ? 'local' : 'remote'} value based on earliest timestamp`,
      confidence: 1.0,
      appliedAt: new Date(),
      discardedValue: useLocal ? conflictData.remoteValue : conflictData.localValue,
    };
  }

  /**
   * Highest value strategy
   */
  private highestValue(conflictData: ConflictData): ConflictResolution {
    const localNum = this.toNumber(conflictData.localValue);
    const remoteNum = this.toNumber(conflictData.remoteValue);

    if (localNum === null || remoteNum === null) {
      throw new Error('Cannot apply HIGHEST_VALUE strategy to non-numeric values');
    }

    const useRemote = remoteNum > localNum;

    return {
      resolvedValue: useRemote ? conflictData.remoteValue : conflictData.localValue,
      strategy: ConflictResolutionStrategy.HIGHEST_VALUE,
      reason: `Selected ${useRemote ? 'remote' : 'local'} value (${useRemote ? remoteNum : localNum}) as highest`,
      confidence: 1.0,
      appliedAt: new Date(),
      discardedValue: useRemote ? conflictData.localValue : conflictData.remoteValue,
    };
  }

  /**
   * Lowest value strategy
   */
  private lowestValue(conflictData: ConflictData): ConflictResolution {
    const localNum = this.toNumber(conflictData.localValue);
    const remoteNum = this.toNumber(conflictData.remoteValue);

    if (localNum === null || remoteNum === null) {
      throw new Error('Cannot apply LOWEST_VALUE strategy to non-numeric values');
    }

    const useLocal = localNum < remoteNum;

    return {
      resolvedValue: useLocal ? conflictData.localValue : conflictData.remoteValue,
      strategy: ConflictResolutionStrategy.LOWEST_VALUE,
      reason: `Selected ${useLocal ? 'local' : 'remote'} value (${useLocal ? localNum : remoteNum}) as lowest`,
      confidence: 1.0,
      appliedAt: new Date(),
      discardedValue: useLocal ? conflictData.remoteValue : conflictData.localValue,
    };
  }

  /**
   * Merge values strategy
   */
  private mergeValues(conflictData: ConflictData): ConflictResolution {
    const merged =
      this.config.mergeStrategy === 'deep'
        ? this.deepMerge(conflictData.localValue, conflictData.remoteValue)
        : this.shallowMerge(conflictData.localValue, conflictData.remoteValue);

    return {
      resolvedValue: merged,
      strategy: ConflictResolutionStrategy.MERGE,
      reason: `Merged local and remote values using ${this.config.mergeStrategy} merge`,
      confidence: 0.8,
      appliedAt: new Date(),
      discardedValue: null,
    };
  }

  /**
   * Manual resolution strategy
   */
  private async manualResolution(conflictData: ConflictData): Promise<ConflictResolution> {
    if (!this.config.enableManualReview) {
      // Fallback to last write wins if manual review is disabled
      return this.lastWriteWins(conflictData);
    }

    const conflictId = this.generateConflictId();
    this.manualReviewQueue.set(conflictId, conflictData);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.manualReviewQueue.delete(conflictId);
        this.manualReviewHandlers.delete(conflictId);
        reject(new Error('Manual resolution timeout'));
      }, this.config.manualReviewTimeout);

      this.manualReviewHandlers.set(conflictId, (resolvedValue: unknown) => {
        clearTimeout(timeout);
        this.manualReviewQueue.delete(conflictId);
        this.manualReviewHandlers.delete(conflictId);

        resolve({
          resolvedValue,
          strategy: ConflictResolutionStrategy.MANUAL,
          reason: 'Manually resolved by operator',
          confidence: 1.0,
          appliedAt: new Date(),
          discardedValue: null,
        });
      });
    });
  }

  /**
   * Source priority strategy
   */
  private sourcePriority(conflictData: ConflictData): ConflictResolution {
    const sourcePriority = this.config.sourcePriorities.find(
      sp => sp.source === conflictData.source
    );
    const destPriority = this.config.sourcePriorities.find(
      sp => sp.source === conflictData.destination
    );

    const sourceRank = sourcePriority?.priority ?? 0;
    const destRank = destPriority?.priority ?? 0;

    const useRemote = sourceRank >= destRank;

    return {
      resolvedValue: useRemote ? conflictData.remoteValue : conflictData.localValue,
      strategy: ConflictResolutionStrategy.SOURCE_PRIORITY,
      reason: `Selected ${useRemote ? 'remote' : 'local'} value based on source priority (${useRemote ? sourceRank : destRank})`,
      confidence: 0.9,
      appliedAt: new Date(),
      discardedValue: useRemote ? conflictData.localValue : conflictData.remoteValue,
    };
  }

  /**
   * Consensus resolution strategy
   */
  private consensusResolution(conflictData: ConflictData): ConflictResolution {
    // This would typically involve checking multiple sources
    // For now, we'll use a simplified version
    const values = [conflictData.localValue, conflictData.remoteValue];
    const valueCounts = new Map<string, number>();

    values.forEach(value => {
      const key = JSON.stringify(value);
      valueCounts.set(key, (valueCounts.get(key) ?? 0) + 1);
    });

    let maxCount = 0;
    let consensusValue: unknown = null;

    valueCounts.forEach((count, valueKey) => {
      if (count > maxCount) {
        maxCount = count;
        consensusValue = JSON.parse(valueKey);
      }
    });

    const confidence = maxCount / values.length;

    if (confidence < this.config.consensusThreshold) {
      // Fall back to last write wins if consensus not reached
      return this.lastWriteWins(conflictData);
    }

    return {
      resolvedValue: consensusValue,
      strategy: ConflictResolutionStrategy.CONSENSUS,
      reason: `Consensus reached with ${confidence * 100}% agreement`,
      confidence,
      appliedAt: new Date(),
      discardedValue: null,
    };
  }

  /**
   * Timestamp-based resolution
   */
  private timestampBased(conflictData: ConflictData): ConflictResolution {
    return this.lastWriteWins(conflictData);
  }

  /**
   * Provide manual resolution
   */
  provideManualResolution(conflictId: string, resolvedValue: unknown): void {
    const handler = this.manualReviewHandlers.get(conflictId);
    if (handler) {
      handler(resolvedValue);
    }
  }

  /**
   * Get pending manual reviews
   */
  getPendingManualReviews(): Array<{ id: string; data: ConflictData }> {
    return Array.from(this.manualReviewQueue.entries()).map(([id, data]) => ({
      id,
      data,
    }));
  }

  /**
   * Get conflict resolution history
   */
  getHistory(limit?: number): ConflictHistory[] {
    const history = [...this.conflictHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.conflictHistory = [];
  }

  /**
   * Get resolution statistics
   */
  getStatistics(): {
    totalResolutions: number;
    byStrategy: Record<ConflictResolutionStrategy, number>;
    averageConfidence: number;
    manualResolutionRate: number;
  } {
    const byStrategy: Record<ConflictResolutionStrategy, number> = {
      [ConflictResolutionStrategy.LAST_WRITE_WINS]: 0,
      [ConflictResolutionStrategy.FIRST_WRITE_WINS]: 0,
      [ConflictResolutionStrategy.HIGHEST_VALUE]: 0,
      [ConflictResolutionStrategy.LOWEST_VALUE]: 0,
      [ConflictResolutionStrategy.MERGE]: 0,
      [ConflictResolutionStrategy.MANUAL]: 0,
      [ConflictResolutionStrategy.SOURCE_PRIORITY]: 0,
      [ConflictResolutionStrategy.CONSENSUS]: 0,
      [ConflictResolutionStrategy.TIMESTAMP_BASED]: 0,
    };

    let totalConfidence = 0;
    let manualCount = 0;

    this.conflictHistory.forEach(history => {
      byStrategy[history.resolution.strategy]++;
      totalConfidence += history.resolution.confidence;

      if (history.resolution.strategy === ConflictResolutionStrategy.MANUAL) {
        manualCount++;
      }
    });

    return {
      totalResolutions: this.conflictHistory.length,
      byStrategy,
      averageConfidence:
        this.conflictHistory.length > 0 ? totalConfidence / this.conflictHistory.length : 0,
      manualResolutionRate:
        this.conflictHistory.length > 0 ? manualCount / this.conflictHistory.length : 0,
    };
  }

  // Helper methods

  private recordConflictResolution(
    conflictData: ConflictData,
    resolution: ConflictResolution
  ): void {
    const history: ConflictHistory = {
      id: this.generateConflictId(),
      timestamp: new Date(),
      conflictData,
      resolution,
      resolvedBy: 'ConflictResolver',
    };

    this.conflictHistory.push(history);

    // Limit history size
    if (this.conflictHistory.length > this.config.maxHistorySize) {
      this.conflictHistory = this.conflictHistory.slice(-this.config.maxHistorySize / 2);
    }
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    }

    return null;
  }

  private deepMerge(target: unknown, source: unknown): unknown {
    if (!this.isObject(target) || !this.isObject(source)) {
      return source;
    }

    const result = { ...target };

    Object.keys(source).forEach(key => {
      const targetValue = (result as Record<string, unknown>)[key];
      const sourceValue = (source as Record<string, unknown>)[key];

      if (this.isObject(targetValue) && this.isObject(sourceValue)) {
        (result as Record<string, unknown>)[key] = this.deepMerge(targetValue, sourceValue);
      } else {
        (result as Record<string, unknown>)[key] = sourceValue;
      }
    });

    return result;
  }

  private shallowMerge(target: unknown, source: unknown): unknown {
    if (!this.isObject(target) || !this.isObject(source)) {
      return source;
    }

    return { ...target, ...source };
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default ConflictResolver;
