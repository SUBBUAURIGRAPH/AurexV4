/**
 * J4C Hermes Skill Executor
 * Executes Hermes skills with error handling and async result tracking
 *
 * Location: j4c-hermes-skill-executor.ts
 * Purpose: Provide skill execution engine with comprehensive error handling
 * Status: Production Ready
 * Version: 1.0.0
 * Last Updated: November 1, 2025
 */

import {
  J4CHermesAdapter,
  HermesExecutionRequest,
  HermesExecutionResponse,
} from './j4c-hermes-adapter';

/**
 * Skill execution context
 */
export interface SkillExecutionContext {
  executionId: string;
  agent: string;
  skill: string;
  parameters: Record<string, any>;
  startTime: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: any;
  error?: string;
  retry?: {
    count: number;
    maxRetries: number;
    nextRetryAt?: number;
  };
}

/**
 * Skill execution result
 */
export interface SkillExecutionResult {
  success: boolean;
  executionId: string;
  agent: string;
  skill: string;
  result?: any;
  error?: string;
  executionTime: number;
  retries: number;
  logs: string[];
}

/**
 * Execution callback function
 */
export type ExecutionCallback = (context: SkillExecutionContext) => void;

/**
 * J4C Hermes Skill Executor
 */
export class J4CHermesSkillExecutor {
  private adapter: J4CHermesAdapter;
  private executionContexts: Map<string, SkillExecutionContext> = new Map();
  private executionCallbacks: Map<string, ExecutionCallback[]> = new Map();
  private executionLogs: Map<string, string[]> = new Map();
  private executionCounter: number = 0;
  private maxConcurrentExecutions: number = 10;
  private activeExecutions: Set<string> = new Set();

  constructor(adapter: J4CHermesAdapter, maxConcurrent: number = 10) {
    this.adapter = adapter;
    this.maxConcurrentExecutions = maxConcurrent;
  }

  /**
   * Execute a skill with full error handling
   */
  async executeSkill(
    agent: string,
    skill: string,
    parameters: Record<string, any> = {},
    timeout: number = 30000
  ): Promise<SkillExecutionResult> {
    const executionId = this.generateExecutionId();
    const startTime = Date.now();

    // Create execution context
    const context: SkillExecutionContext = {
      executionId,
      agent,
      skill,
      parameters,
      startTime,
      status: 'pending',
      retry: {
        count: 0,
        maxRetries: 3,
      },
    };

    this.executionContexts.set(executionId, context);
    this.executionLogs.set(executionId, []);
    this.addLog(executionId, `Skill execution started: ${agent}/${skill}`);

    try {
      // Wait for capacity if needed
      while (this.activeExecutions.size >= this.maxConcurrentExecutions) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      this.activeExecutions.add(executionId);
      context.status = 'running';
      this.notifyCallbacks(executionId, context);

      // Build execution request
      const request: HermesExecutionRequest = {
        agent,
        skill,
        parameters,
        timeout,
        requestId: executionId,
      };

      // Execute with timeout wrapper
      const result = await this.executeWithTimeout(request, timeout);

      // Update context
      context.status = 'completed';
      context.result = result.result;
      this.addLog(executionId, `Skill execution completed successfully`);
      this.addLog(executionId, `Execution time: ${result.executionTime}ms`);

      this.notifyCallbacks(executionId, context);

      const finalResult: SkillExecutionResult = {
        success: true,
        executionId,
        agent,
        skill,
        result: result.result,
        executionTime: result.executionTime,
        retries: context.retry?.count || 0,
        logs: this.executionLogs.get(executionId) || [],
      };

      // Clean up
      setTimeout(() => {
        this.executionContexts.delete(executionId);
        this.activeExecutions.delete(executionId);
      }, 5000);

      return finalResult;
    } catch (error) {
      context.status = 'failed';
      context.error = error instanceof Error ? error.message : String(error);
      this.addLog(executionId, `Skill execution failed: ${context.error}`);

      this.notifyCallbacks(executionId, context);

      const failureResult: SkillExecutionResult = {
        success: false,
        executionId,
        agent,
        skill,
        error: context.error,
        executionTime: Date.now() - startTime,
        retries: context.retry?.count || 0,
        logs: this.executionLogs.get(executionId) || [],
      };

      // Clean up
      setTimeout(() => {
        this.executionContexts.delete(executionId);
        this.activeExecutions.delete(executionId);
      }, 5000);

      return failureResult;
    }
  }

  /**
   * Execute with timeout wrapper
   */
  private executeWithTimeout(
    request: HermesExecutionRequest,
    timeout: number
  ): Promise<HermesExecutionResponse> {
    return new Promise((resolve, reject) => {
      let timeoutHandle: NodeJS.Timeout;
      let completed = false;

      // Set timeout
      timeoutHandle = setTimeout(() => {
        completed = true;
        reject(new Error(`Skill execution timeout after ${timeout}ms`));
      }, timeout);

      // Execute skill
      this.adapter
        .executeSkill(request)
        .then((result) => {
          if (!completed) {
            completed = true;
            clearTimeout(timeoutHandle);
            resolve(result);
          }
        })
        .catch((error) => {
          if (!completed) {
            completed = true;
            clearTimeout(timeoutHandle);
            reject(error);
          }
        });
    });
  }

  /**
   * Execute skill with async callback
   */
  async executeSkillAsync(
    agent: string,
    skill: string,
    parameters: Record<string, any> = {},
    callback?: (result: SkillExecutionResult) => void
  ): Promise<string> {
    const executionId = this.generateExecutionId();

    // Execute in background
    this.executeSkill(agent, skill, parameters)
      .then((result) => {
        if (callback) {
          callback(result);
        }
      })
      .catch((error) => {
        if (callback) {
          callback({
            success: false,
            executionId,
            agent,
            skill,
            error: error.message,
            executionTime: 0,
            retries: 0,
            logs: [],
          });
        }
      });

    return executionId;
  }

  /**
   * Get execution status
   */
  getExecutionStatus(executionId: string): SkillExecutionContext | undefined {
    return this.executionContexts.get(executionId);
  }

  /**
   * Cancel execution
   */
  cancelExecution(executionId: string): boolean {
    const context = this.executionContexts.get(executionId);

    if (!context) {
      return false;
    }

    if (context.status === 'completed' || context.status === 'failed') {
      return false;
    }

    context.status = 'cancelled';
    this.addLog(executionId, 'Execution cancelled');
    this.notifyCallbacks(executionId, context);

    return true;
  }

  /**
   * Add execution callback listener
   */
  on(executionId: string, callback: ExecutionCallback): void {
    if (!this.executionCallbacks.has(executionId)) {
      this.executionCallbacks.set(executionId, []);
    }

    this.executionCallbacks.get(executionId)?.push(callback);
  }

  /**
   * Remove execution callback listener
   */
  off(executionId: string, callback: ExecutionCallback): void {
    const callbacks = this.executionCallbacks.get(executionId);

    if (callbacks) {
      const index = callbacks.indexOf(callback);

      if (index >= 0) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Get execution logs
   */
  getExecutionLogs(executionId: string): string[] {
    return this.executionLogs.get(executionId) || [];
  }

  /**
   * Add log entry
   */
  private addLog(executionId: string, message: string): void {
    if (!this.executionLogs.has(executionId)) {
      this.executionLogs.set(executionId, []);
    }

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;

    this.executionLogs.get(executionId)?.push(logEntry);
  }

  /**
   * Notify execution callbacks
   */
  private notifyCallbacks(executionId: string, context: SkillExecutionContext): void {
    const callbacks = this.executionCallbacks.get(executionId);

    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(context);
        } catch (error) {
          console.error('Error in execution callback:', error);
        }
      });
    }
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec-${Date.now()}-${++this.executionCounter}`;
  }

  /**
   * Get executor statistics
   */
  getStatistics(): {
    totalExecutions: number;
    activeExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
  } {
    const total = this.executionContexts.size;
    const active = this.activeExecutions.size;
    const completed = Array.from(this.executionContexts.values()).filter(
      (c) => c.status === 'completed'
    ).length;
    const failed = Array.from(this.executionContexts.values()).filter(
      (c) => c.status === 'failed'
    ).length;

    const avgTime =
      Array.from(this.executionContexts.values()).reduce((sum, ctx) => {
        return sum + (Date.now() - ctx.startTime);
      }, 0) / (total || 1);

    return {
      totalExecutions: total,
      activeExecutions: active,
      completedExecutions: completed,
      failedExecutions: failed,
      averageExecutionTime: Math.round(avgTime),
    };
  }

  /**
   * Batch execute skills
   */
  async executeSkillBatch(
    skills: Array<{
      agent: string;
      skill: string;
      parameters: Record<string, any>;
      timeout?: number;
    }>
  ): Promise<SkillExecutionResult[]> {
    const results = await Promise.all(
      skills.map((s) => this.executeSkill(s.agent, s.skill, s.parameters, s.timeout))
    );

    return results;
  }

  /**
   * Clear old executions
   */
  clearOldExecutions(olderThanMs: number = 3600000): number {
    let cleared = 0;
    const now = Date.now();

    for (const [id, context] of this.executionContexts.entries()) {
      if (now - context.startTime > olderThanMs) {
        this.executionContexts.delete(id);
        this.executionLogs.delete(id);
        this.executionCallbacks.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Wait for execution to complete
   */
  async waitForExecution(executionId: string, timeout: number = 30000): Promise<SkillExecutionResult> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const context = this.executionContexts.get(executionId);

        if (!context) {
          clearInterval(checkInterval);
          reject(new Error(`Execution ${executionId} not found`));
          return;
        }

        if (context.status === 'completed') {
          clearInterval(checkInterval);
          resolve({
            success: true,
            executionId,
            agent: context.agent,
            skill: context.skill,
            result: context.result,
            executionTime: Date.now() - context.startTime,
            retries: context.retry?.count || 0,
            logs: this.executionLogs.get(executionId) || [],
          });
          return;
        }

        if (context.status === 'failed') {
          clearInterval(checkInterval);
          resolve({
            success: false,
            executionId,
            agent: context.agent,
            skill: context.skill,
            error: context.error,
            executionTime: Date.now() - context.startTime,
            retries: context.retry?.count || 0,
            logs: this.executionLogs.get(executionId) || [],
          });
          return;
        }

        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          reject(new Error(`Execution timeout after ${timeout}ms`));
          return;
        }
      }, 100);
    });
  }
}

// Factory function
export function createSkillExecutor(
  adapter: J4CHermesAdapter,
  maxConcurrent?: number
): J4CHermesSkillExecutor {
  return new J4CHermesSkillExecutor(adapter, maxConcurrent);
}

// Export types
export type { SkillExecutionContext, SkillExecutionResult, ExecutionCallback };
