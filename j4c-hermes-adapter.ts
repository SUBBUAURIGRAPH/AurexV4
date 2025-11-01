/**
 * J4C Hermes Integration Adapter
 * Bridges J4C Agent Framework with Hermes Trading Platform
 *
 * Location: j4c-hermes-adapter.ts
 * Purpose: Enable seamless communication between J4C and Hermes agents
 * Status: Production Ready
 * Version: 1.0.0
 * Last Updated: November 1, 2025
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';

/**
 * Hermes Agent Information
 */
export interface HermesAgentInfo {
  id: string;
  name: string;
  alias: string;
  description: string;
  category: 'trading' | 'infrastructure' | 'security' | 'compliance' | 'development' | 'analytics';
  skills: string[];
  status: 'active' | 'inactive' | 'unavailable';
  version: string;
  author: string;
}

/**
 * Hermes Skill Information
 */
export interface HermesSkillInfo {
  id: string;
  name: string;
  description: string;
  agent: string;
  category: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
    defaultValue?: any;
  }>;
  returnType: string;
  examples?: Array<{
    input: Record<string, any>;
    output: Record<string, any>;
  }>;
  documentation?: string;
  lastUpdated?: Date;
}

/**
 * Hermes Skill Execution Request
 */
export interface HermesExecutionRequest {
  agent: string;
  skill: string;
  parameters: Record<string, any>;
  timeout?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  requestId?: string;
  metadata?: Record<string, any>;
}

/**
 * Hermes Skill Execution Response
 */
export interface HermesExecutionResponse {
  success: boolean;
  requestId: string;
  agent: string;
  skill: string;
  result?: any;
  executionTime: number;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'timeout';
  error?: string;
  warnings?: string[];
  metadata?: {
    executionTrace?: string;
    agentVersion?: string;
    skillVersion?: string;
  };
}

/**
 * J4C-Hermes Adapter Configuration
 */
export interface J4CHermesAdapterConfig {
  hermesApiUrl: string;
  hermesApiKey?: string;
  timeout: number;
  maxRetries: number;
  retryDelayMs: number;
  enableCache: boolean;
  cacheExpireMs: number;
  enableEncryption: boolean;
  encryptionKey?: string;
  logRequests: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * J4C-Hermes Adapter
 * Provides unified interface for J4C agents to invoke Hermes skills
 */
export class J4CHermesAdapter {
  private client: AxiosInstance;
  private config: J4CHermesAdapterConfig;
  private agentCache: Map<string, HermesAgentInfo> = new Map();
  private skillCache: Map<string, HermesSkillInfo> = new Map();
  private executionHistory: HermesExecutionResponse[] = [];
  private requestCounter: number = 0;

  constructor(config: J4CHermesAdapterConfig) {
    this.config = config;
    this.client = this.initializeClient();
    this.validateConfiguration();
  }

  /**
   * Initialize axios client with configuration
   */
  private initializeClient(): AxiosInstance {
    const client = axios.create({
      baseURL: this.config.hermesApiUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'J4C-Hermes-Adapter/1.0.0',
      },
    });

    // Add request interceptor for API key if provided
    if (this.config.hermesApiKey) {
      client.interceptors.request.use((config) => {
        config.headers['Authorization'] = `Bearer ${this.config.hermesApiKey}`;
        return config;
      });
    }

    // Add response interceptor for error handling
    client.interceptors.response.use(
      (response) => response,
      (error) => {
        this.logError(`Hermes API Error: ${error.message}`);
        return Promise.reject(error);
      }
    );

    return client;
  }

  /**
   * Validate adapter configuration
   */
  private validateConfiguration(): void {
    if (!this.config.hermesApiUrl) {
      throw new Error('Hermes API URL is required');
    }

    if (!this.config.hermesApiUrl.startsWith('http')) {
      throw new Error('Hermes API URL must be a valid HTTP/HTTPS URL');
    }

    this.logInfo('J4C-Hermes Adapter initialized successfully');
  }

  /**
   * Check Hermes API health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200 && response.data.status === 'ok';
    } catch (error) {
      this.logWarn(`Health check failed: ${error}`);
      return false;
    }
  }

  /**
   * Get all available agents from Hermes
   */
  async getAvailableAgents(): Promise<HermesAgentInfo[]> {
    try {
      // Check cache first
      if (this.agentCache.size > 0) {
        return Array.from(this.agentCache.values());
      }

      const response: AxiosResponse<{ agents: HermesAgentInfo[] }> = await this.client.get(
        '/api/agents'
      );

      // Cache the agents
      response.data.agents.forEach((agent) => {
        this.agentCache.set(agent.id, agent);
      });

      this.logInfo(`Loaded ${response.data.agents.length} Hermes agents`);
      return response.data.agents;
    } catch (error) {
      this.logError(`Failed to get agents: ${error}`);
      return [];
    }
  }

  /**
   * Get agent by ID or alias
   */
  async getAgent(agentIdOrAlias: string): Promise<HermesAgentInfo | null> {
    try {
      // Check cache first
      if (this.agentCache.has(agentIdOrAlias)) {
        return this.agentCache.get(agentIdOrAlias) || null;
      }

      const response: AxiosResponse<HermesAgentInfo> = await this.client.get(
        `/api/agents/${agentIdOrAlias}`
      );

      this.agentCache.set(response.data.id, response.data);
      return response.data;
    } catch (error) {
      this.logWarn(`Failed to get agent ${agentIdOrAlias}: ${error}`);
      return null;
    }
  }

  /**
   * Get available skills for an agent
   */
  async getAgentSkills(agentId: string): Promise<HermesSkillInfo[]> {
    try {
      const response: AxiosResponse<{ skills: HermesSkillInfo[] }> = await this.client.get(
        `/api/agents/${agentId}/skills`
      );

      // Cache skills
      response.data.skills.forEach((skill) => {
        this.skillCache.set(`${agentId}:${skill.id}`, skill);
      });

      return response.data.skills;
    } catch (error) {
      this.logError(`Failed to get skills for agent ${agentId}: ${error}`);
      return [];
    }
  }

  /**
   * Execute a Hermes skill
   */
  async executeSkill(request: HermesExecutionRequest): Promise<HermesExecutionResponse> {
    const requestId = request.requestId || this.generateRequestId();
    const startTime = Date.now();

    try {
      this.logInfo(`Executing skill: ${request.agent}:${request.skill}`, { requestId });

      // Validate request
      this.validateExecutionRequest(request);

      // Execute with retry logic
      const response = await this.executeWithRetry(request, requestId);

      // Add to execution history
      const executionResponse: HermesExecutionResponse = {
        ...response,
        requestId,
        executionTime: Date.now() - startTime,
      };

      this.executionHistory.push(executionResponse);

      // Keep only last 1000 executions
      if (this.executionHistory.length > 1000) {
        this.executionHistory.shift();
      }

      return executionResponse;
    } catch (error) {
      this.logError(`Skill execution failed: ${error}`, { requestId });

      return {
        success: false,
        requestId,
        agent: request.agent,
        skill: request.skill,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(
    request: HermesExecutionRequest,
    requestId: string,
    attempt: number = 0
  ): Promise<HermesExecutionResponse> {
    try {
      const response: AxiosResponse<HermesExecutionResponse> = await this.client.post(
        '/api/execute',
        {
          ...request,
          requestId,
        }
      );

      return response.data;
    } catch (error) {
      if (attempt < this.config.maxRetries) {
        this.logWarn(
          `Execution attempt ${attempt + 1} failed, retrying...`,
          { requestId }
        );

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, this.config.retryDelayMs));

        return this.executeWithRetry(request, requestId, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Validate execution request
   */
  private validateExecutionRequest(request: HermesExecutionRequest): void {
    if (!request.agent) {
      throw new Error('Agent ID is required');
    }

    if (!request.skill) {
      throw new Error('Skill name is required');
    }

    if (!request.parameters || typeof request.parameters !== 'object') {
      throw new Error('Parameters must be a valid object');
    }
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit: number = 100): HermesExecutionResponse[] {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    averageExecutionTime: number;
    successRate: number;
  } {
    const total = this.executionHistory.length;
    const successes = this.executionHistory.filter((e) => e.success).length;
    const failures = total - successes;
    const avgTime =
      this.executionHistory.reduce((sum, e) => sum + e.executionTime, 0) / (total || 1);
    const successRate = total > 0 ? (successes / total) * 100 : 0;

    return {
      totalExecutions: total,
      successCount: successes,
      failureCount: failures,
      averageExecutionTime: Math.round(avgTime),
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.agentCache.clear();
    this.skillCache.clear();
    this.logInfo('Caches cleared');
  }

  /**
   * Close adapter connection
   */
  async close(): Promise<void> {
    this.clearCache();
    this.logInfo('J4C-Hermes Adapter closed');
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${++this.requestCounter}`;
  }

  /**
   * Logging utilities
   */
  private logInfo(message: string, context?: any): void {
    if (this.config.logLevel === 'debug' || this.config.logLevel === 'info') {
      console.log(`[J4C-Hermes] ${message}`, context || '');
    }
  }

  private logWarn(message: string, context?: any): void {
    if (['debug', 'info', 'warn'].includes(this.config.logLevel)) {
      console.warn(`[J4C-Hermes] ${message}`, context || '');
    }
  }

  private logError(message: string, context?: any): void {
    console.error(`[J4C-Hermes] ${message}`, context || '');
  }
}

/**
 * Factory function to create adapter with default configuration
 */
export function createJ4CHermesAdapter(
  hermesApiUrl: string = process.env.HERMES_API_URL || 'http://localhost:8005',
  hermesApiKey?: string
): J4CHermesAdapter {
  const config: J4CHermesAdapterConfig = {
    hermesApiUrl,
    hermesApiKey: hermesApiKey || process.env.HERMES_API_KEY,
    timeout: parseInt(process.env.HERMES_TIMEOUT || '30000', 10),
    maxRetries: parseInt(process.env.HERMES_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.HERMES_RETRY_DELAY || '1000', 10),
    enableCache: process.env.HERMES_CACHE_ENABLED !== 'false',
    cacheExpireMs: parseInt(process.env.HERMES_CACHE_EXPIRE || '300000', 10),
    enableEncryption: process.env.HERMES_ENCRYPTION_ENABLED === 'true',
    encryptionKey: process.env.HERMES_ENCRYPTION_KEY,
    logRequests: process.env.HERMES_LOG_REQUESTS === 'true',
    logLevel: (process.env.HERMES_LOG_LEVEL || 'info') as any,
  };

  return new J4CHermesAdapter(config);
}

// Export all types for external use
export type {
  J4CHermesAdapterConfig,
  HermesAgentInfo,
  HermesSkillInfo,
  HermesExecutionRequest,
  HermesExecutionResponse,
};
