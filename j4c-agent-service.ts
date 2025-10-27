/**
 * J4C Agent Service - AWD2 Integration
 * Enables AWD2 to invoke J4C agents for task automation
 *
 * Location: /src/services/j4c-agent-service.ts
 * Integration: AWD2 Backend → J4C Agent System
 * Status: Ready for Integration into AWD2
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../utils/logger';

const execAsync = promisify(exec);

/**
 * Agent context providing information about the request origin
 */
export interface AgentContext {
  userId: string;           // Who invoked the agent
  farmId?: string;         // Related farm (if any)
  operationType: string;   // Type of operation
  timestamp: Date;         // When invoked
  correlationId: string;   // Trace ID for debugging
}

/**
 * Parameters for agent invocation
 */
export interface AgentInvocationRequest {
  agentId: string;                          // e.g., 'devops', 'qa', 'dlt-architect'
  skillName: string;                        // e.g., 'optimize-farm', 'run-tests'
  parameters: Record<string, any>;          // Skill-specific parameters
  context: AgentContext;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number;                         // Milliseconds (default: 30000)
}

/**
 * Response from agent invocation
 */
export interface AgentInvocationResponse {
  success: boolean;
  invocationId: string;
  agentId: string;
  skillName: string;
  result?: any;                             // Skill result
  executionTime: number;                    // Milliseconds
  agentFeedback?: string;                   // Agent's notes
  error?: string;                           // Error message if failed
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'timeout';
  metadata?: {
    agentVersion?: string;
    skillVersion?: string;
    environmentUsed?: string;
  };
}

/**
 * Agent information from J4C system
 */
export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  type: string;
  expertise: string;
  status: 'active' | 'inactive' | 'unavailable';
  availableSkills: string[];
  version?: string;
}

/**
 * Skill information for an agent
 */
export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  agent: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
  returnType: string;
  averageExecutionTime?: number;
  lastUsed?: Date;
  successRate?: number;
}

/**
 * Configuration for J4C Agent Service
 */
export interface J4CConfig {
  enabled: boolean;
  host: string;
  port: number;
  containerName: string;
  timeout: number;
  maxRetries: number;
  fallbackMode: 'suggest' | 'disable' | 'cache';
  docker: {
    network: string;
    volumeMounts: Record<string, string>;
  };
}

/**
 * J4C Agent Service
 * Handles all communication with J4C Agent system from AWD2 backend
 */
export class J4CAgentService {
  private logger: Logger;
  private config: J4CConfig;
  private agentCache: Map<string, AgentInfo> = new Map();
  private skillCache: Map<string, SkillInfo[]> = new Map();
  private invocationHistory: AgentInvocationResponse[] = [];

  constructor(config: J4CConfig) {
    this.config = config;
    this.logger = new Logger('J4CAgentService');
    this.validateConfig();
  }

  /**
   * Validate configuration on startup
   */
  private validateConfig(): void {
    if (!this.config.enabled) {
      this.logger.warn('J4C Agent Service is disabled');
      return;
    }

    if (!this.config.host || !this.config.containerName) {
      throw new Error('Invalid J4C configuration: host and containerName required');
    }

    this.logger.info('J4C Agent Service initialized', {
      host: this.config.host,
      port: this.config.port,
      container: this.config.containerName,
    });
  }

  /**
   * Invoke an agent skill
   */
  async invokeAgent(request: AgentInvocationRequest): Promise<AgentInvocationResponse> {
    if (!this.config.enabled) {
      this.logger.warn('Agent invocation attempted but service is disabled');
      return {
        success: false,
        invocationId: request.context.correlationId,
        agentId: request.agentId,
        skillName: request.skillName,
        executionTime: 0,
        status: 'failed',
        error: 'J4C Agent Service is disabled',
      };
    }

    const invocationId = this.generateInvocationId();
    const startTime = Date.now();

    try {
      this.logger.info('Invoking agent', {
        invocationId,
        agentId: request.agentId,
        skillName: request.skillName,
        userId: request.context.userId,
      });

      // Build the docker exec command
      const command = this.buildDockerCommand(request);

      // Execute with timeout
      const result = await this.executeWithTimeout(
        command,
        request.timeout || this.config.timeout
      );

      const executionTime = Date.now() - startTime;

      const response: AgentInvocationResponse = {
        success: true,
        invocationId,
        agentId: request.agentId,
        skillName: request.skillName,
        result: this.parseAgentResult(result),
        executionTime,
        status: 'completed',
      };

      this.recordInvocation(response);
      this.logger.info('Agent invocation successful', { invocationId, executionTime });

      return response;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error('Agent invocation failed', {
        invocationId,
        error: errorMessage,
        agentId: request.agentId,
        executionTime,
      });

      const response: AgentInvocationResponse = {
        success: false,
        invocationId,
        agentId: request.agentId,
        skillName: request.skillName,
        executionTime,
        status: 'failed',
        error: errorMessage,
      };

      this.recordInvocation(response);
      return response;
    }
  }

  /**
   * Get list of available agents
   */
  async getAvailableAgents(useCache = true): Promise<AgentInfo[]> {
    if (useCache && this.agentCache.size > 0) {
      return Array.from(this.agentCache.values());
    }

    try {
      const command = `docker exec ${this.config.containerName} node index.js list --format=json`;
      const result = await this.executeWithTimeout(command, 10000);
      const agents = this.parseAgentList(result);

      // Cache the results
      agents.forEach(agent => this.agentCache.set(agent.id, agent));

      this.logger.info('Retrieved agent list', { count: agents.length });
      return agents;
    } catch (error) {
      this.logger.error('Failed to get agent list', { error });
      return [];
    }
  }

  /**
   * Get available skills for an agent
   */
  async getAgentSkills(agentId: string, useCache = true): Promise<SkillInfo[]> {
    if (useCache && this.skillCache.has(agentId)) {
      return this.skillCache.get(agentId) || [];
    }

    try {
      // In actual implementation, would invoke agent to get skills
      // For now, return empty array as placeholder
      const skills: SkillInfo[] = [];
      this.skillCache.set(agentId, skills);
      return skills;
    } catch (error) {
      this.logger.error('Failed to get agent skills', { agentId, error });
      return [];
    }
  }

  /**
   * Check agent service health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const command = `docker exec ${this.config.containerName} node index.js list --format=json`;
      const result = await this.executeWithTimeout(command, 5000);
      return !!result;
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return false;
    }
  }

  /**
   * Get invocation history
   */
  getInvocationHistory(limit = 100): AgentInvocationResponse[] {
    return this.invocationHistory.slice(-limit);
  }

  /**
   * Build docker exec command for agent invocation
   */
  private buildDockerCommand(request: AgentInvocationRequest): string {
    const params = JSON.stringify(request.parameters);
    const escapedParams = params.replace(/"/g, '\\"');

    return (
      `docker exec ${this.config.containerName} ` +
      `node index.js invoke ${request.agentId} ${request.skillName} ` +
      `'${escapedParams}'`
    );
  }

  /**
   * Execute command with timeout
   */
  private async executeWithTimeout(
    command: string,
    timeout: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Command timeout after ${timeout}ms`)),
        timeout
      );

      execAsync(command)
        .then(({ stdout, stderr }) => {
          clearTimeout(timer);
          if (stderr) {
            reject(new Error(stderr));
          } else {
            resolve(stdout);
          }
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Parse agent result JSON
   */
  private parseAgentResult(output: string): any {
    try {
      // Try to parse as JSON
      return JSON.parse(output);
    } catch {
      // If not JSON, return as string
      return { rawOutput: output };
    }
  }

  /**
   * Parse agent list from command output
   */
  private parseAgentList(output: string): AgentInfo[] {
    try {
      const data = JSON.parse(output);
      if (Array.isArray(data)) {
        return data;
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Record invocation for audit trail
   */
  private recordInvocation(response: AgentInvocationResponse): void {
    this.invocationHistory.push(response);
    // Keep only last 1000 invocations in memory
    if (this.invocationHistory.length > 1000) {
      this.invocationHistory = this.invocationHistory.slice(-1000);
    }
  }

  /**
   * Generate unique invocation ID
   */
  private generateInvocationId(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.agentCache.clear();
    this.skillCache.clear();
    this.logger.info('Agent service caches cleared');
  }

  /**
   * Get service statistics
   */
  getStatistics() {
    return {
      totalInvocations: this.invocationHistory.length,
      successCount: this.invocationHistory.filter(i => i.success).length,
      failureCount: this.invocationHistory.filter(i => !i.success).length,
      averageExecutionTime:
        this.invocationHistory.length > 0
          ? this.invocationHistory.reduce((sum, i) => sum + i.executionTime, 0) /
            this.invocationHistory.length
          : 0,
      cachedAgents: this.agentCache.size,
      cachedSkills: this.skillCache.size,
    };
  }
}

/**
 * Factory function for creating J4C Agent Service
 */
export function createJ4CAgentService(env: NodeJS.ProcessEnv): J4CAgentService {
  const config: J4CConfig = {
    enabled: env.J4C_AGENT_ENABLED === 'true',
    host: env.J4C_AGENT_HOST || 'localhost',
    port: parseInt(env.J4C_AGENT_PORT || '9003'),
    containerName: env.J4C_CONTAINER_NAME || 'j4c-agent-plugin',
    timeout: parseInt(env.J4C_AGENT_TIMEOUT_MS || '30000'),
    maxRetries: parseInt(env.J4C_AGENT_MAX_RETRIES || '3'),
    fallbackMode: (env.J4C_AGENT_FALLBACK_MODE as any) || 'suggest',
    docker: {
      network: env.J4C_DOCKER_NETWORK || 'j4c-network',
      volumeMounts: {},
    },
  };

  return new J4CAgentService(config);
}

/**
 * Singleton instance
 */
let instance: J4CAgentService | null = null;

export function getJ4CAgentService(env?: NodeJS.ProcessEnv): J4CAgentService {
  if (!instance) {
    instance = createJ4CAgentService(env || process.env);
  }
  return instance;
}

export default J4CAgentService;
