/**
 * J4C Skill Router - Task-to-Agent Mapping
 * Routes AWD2 tasks to appropriate J4C agents based on capabilities
 *
 * Location: /src/services/j4c-skill-router.ts
 * Integration: AWD2 Task Engine → J4C Agent Dispatch
 * Status: Ready for Integration into AWD2
 */

import { Logger } from '../utils/logger';

/**
 * Task types that can be routed to agents
 */
export enum TaskType {
  // Farm operations
  FARM_OPTIMIZATION = 'farm-optimization',
  FARM_VALIDATION = 'farm-validation',
  FARM_PERFORMANCE = 'farm-performance',

  // Water distribution
  WATER_DISTRIBUTION = 'water-distribution',
  WATER_OPTIMIZATION = 'water-optimization',
  WATER_MONITORING = 'water-monitoring',

  // User management
  USER_VALIDATION = 'user-validation',
  USER_ONBOARDING = 'user-onboarding',
  PERMISSION_REVIEW = 'permission-review',

  // Reporting
  REPORT_GENERATION = 'report-generation',
  DATA_ANALYSIS = 'data-analysis',
  PERFORMANCE_REPORTING = 'performance-reporting',

  // Testing & QA
  SYSTEM_TESTING = 'system-testing',
  DATA_VALIDATION = 'data-validation',
  DEPLOYMENT_TESTING = 'deployment-testing',

  // Infrastructure
  DEPLOYMENT = 'deployment',
  INFRASTRUCTURE = 'infrastructure',
  MONITORING = 'monitoring',

  // Security
  SECURITY_REVIEW = 'security-review',
  COMPLIANCE_CHECK = 'compliance-check',
  AUDIT = 'audit',

  // Blockchain/DLT
  BLOCKCHAIN_INTEGRATION = 'blockchain-integration',
  SMART_CONTRACT = 'smart-contract',
  DLT_SYNC = 'dlt-sync',
}

/**
 * Priority levels for task routing
 */
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Agent assignment result
 */
export interface AgentAssignment {
  agentId: string;
  agentName: string;
  skillName: string;
  reasoning: string;
  confidence: number; // 0-1
  estimatedExecutionTime: number; // milliseconds
  supportingAgents?: string[];
}

/**
 * Task routing request
 */
export interface SkillRoutingRequest {
  taskType: TaskType;
  priority: TaskPriority;
  context: {
    userId: string;
    farmId?: string;
    operation: string;
    requirements?: string[];
  };
  constraints?: {
    maxExecutionTime?: number;
    requiredCapabilities?: string[];
    preferredAgents?: string[];
  };
}

/**
 * Capability mapping between AWD2 features and agents
 */
interface CapabilityMapping {
  agent: string;
  skills: string[];
  capabilities: string[];
  priority: number; // Higher = more preferred
  estimatedTime: number;
}

/**
 * J4C Skill Router
 * Routes AWD2 tasks to the most appropriate J4C agents
 */
export class J4CSkillRouter {
  private logger: Logger;
  private capabilityMappings: Map<TaskType, CapabilityMapping[]>;
  private agentPerformance: Map<string, AgentPerformanceData> = new Map();

  constructor() {
    this.logger = new Logger('J4CSkillRouter');
    this.capabilityMappings = this.initializeCapabilityMappings();
  }

  /**
   * Route a task to appropriate agent(s)
   */
  async routeTask(request: SkillRoutingRequest): Promise<AgentAssignment> {
    this.logger.info('Routing task', {
      taskType: request.taskType,
      priority: request.priority,
      userId: request.context.userId,
    });

    // Get capable agents for this task type
    const capableAgents = this.getCapableAgents(request.taskType);

    if (capableAgents.length === 0) {
      this.logger.warn('No agents available for task', { taskType: request.taskType });
      throw new Error(`No agents available for task type: ${request.taskType}`);
    }

    // Score and rank agents based on constraints and performance
    const rankedAgents = await this.rankAgents(
      capableAgents,
      request.priority,
      request.constraints
    );

    // Select the top agent
    const selectedAgent = rankedAgents[0];

    const assignment: AgentAssignment = {
      agentId: selectedAgent.agent,
      agentName: this.getAgentName(selectedAgent.agent),
      skillName: selectedAgent.skills[0],
      reasoning: this.generateRouting Reasoning(selectedAgent, request),
      confidence: this.calculateConfidence(selectedAgent, request),
      estimatedExecutionTime: selectedAgent.estimatedTime,
      supportingAgents: this.getSupportingAgents(selectedAgent.agent, request.taskType),
    };

    this.logger.info('Task routed to agent', {
      taskType: request.taskType,
      agentId: assignment.agentId,
      confidence: assignment.confidence,
    });

    return assignment;
  }

  /**
   * Get recommended agents for a task type
   */
  async getRecommendedAgents(taskType: TaskType): Promise<AgentAssignment[]> {
    const capableAgents = this.getCapableAgents(taskType);

    return capableAgents.map(mapping => ({
      agentId: mapping.agent,
      agentName: this.getAgentName(mapping.agent),
      skillName: mapping.skills[0],
      reasoning: `Recommended for ${taskType}`,
      confidence: mapping.priority / 100,
      estimatedExecutionTime: mapping.estimatedTime,
    }));
  }

  /**
   * Evaluate agent capability for a specific task
   */
  async evaluateAgentCapability(agentId: string, taskType: TaskType): Promise<number> {
    const mappings = this.capabilityMappings.get(taskType) || [];
    const mapping = mappings.find(m => m.agent === agentId);

    if (!mapping) {
      return 0;
    }

    // Base capability from mapping
    let score = mapping.priority / 100;

    // Adjust based on performance history
    const performance = this.agentPerformance.get(agentId);
    if (performance) {
      const successRate = performance.successCount /
        (performance.successCount + performance.failureCount);
      const avgExecutionTime = performance.averageExecutionTime;

      // Boost score for reliable agents
      score *= (0.5 + 0.5 * successRate);

      // Reduce score if execution time is high
      if (avgExecutionTime > mapping.estimatedTime * 2) {
        score *= 0.8;
      }
    }

    return Math.min(1, score);
  }

  /**
   * Initialize capability mappings
   */
  private initializeCapabilityMappings(): Map<TaskType, CapabilityMapping[]> {
    const mappings = new Map<TaskType, CapabilityMapping[]>();

    // Farm operations
    mappings.set(TaskType.FARM_OPTIMIZATION, [
      {
        agent: 'devops',
        skills: ['optimize-farm', 'performance-tuning'],
        capabilities: ['system-optimization', 'infrastructure-management'],
        priority: 90,
        estimatedTime: 5000,
      },
      {
        agent: 'data-engineer',
        skills: ['optimize-data', 'create-indices'],
        capabilities: ['data-optimization', 'analytics'],
        priority: 80,
        estimatedTime: 3000,
      },
    ]);

    mappings.set(TaskType.FARM_VALIDATION, [
      {
        agent: 'qa',
        skills: ['validate-data', 'run-tests'],
        capabilities: ['testing', 'quality-assurance'],
        priority: 95,
        estimatedTime: 4000,
      },
      {
        agent: 'security',
        skills: ['validate-security', 'audit'],
        capabilities: ['security-validation'],
        priority: 85,
        estimatedTime: 5000,
      },
    ]);

    mappings.set(TaskType.FARM_PERFORMANCE, [
      {
        agent: 'sre',
        skills: ['monitor-performance', 'optimize-reliability'],
        capabilities: ['monitoring', 'reliability-engineering'],
        priority: 90,
        estimatedTime: 3000,
      },
      {
        agent: 'devops',
        skills: ['performance-tuning'],
        capabilities: ['infrastructure-optimization'],
        priority: 85,
        estimatedTime: 4000,
      },
    ]);

    // Water distribution
    mappings.set(TaskType.WATER_DISTRIBUTION, [
      {
        agent: 'dlt-architect',
        skills: ['design-distribution', 'blockchain-integration'],
        capabilities: ['dlt-architecture', 'system-design'],
        priority: 95,
        estimatedTime: 6000,
      },
      {
        agent: 'data-engineer',
        skills: ['optimize-distribution', 'analyze-flow'],
        capabilities: ['data-analysis', 'optimization'],
        priority: 85,
        estimatedTime: 4000,
      },
    ]);

    mappings.set(TaskType.WATER_OPTIMIZATION, [
      {
        agent: 'data-engineer',
        skills: ['optimize-distribution'],
        capabilities: ['optimization', 'analytics'],
        priority: 90,
        estimatedTime: 3000,
      },
      {
        agent: 'gnn-heuristic',
        skills: ['recommend-optimization'],
        capabilities: ['ml-optimization', 'recommendations'],
        priority: 85,
        estimatedTime: 2000,
      },
    ]);

    // User management
    mappings.set(TaskType.USER_VALIDATION, [
      {
        agent: 'security',
        skills: ['validate-user', 'check-permissions'],
        capabilities: ['security-validation', 'access-control'],
        priority: 95,
        estimatedTime: 2000,
      },
    ]);

    mappings.set(TaskType.USER_ONBOARDING, [
      {
        agent: 'onboarding',
        skills: ['onboard-user', 'setup-access'],
        capabilities: ['onboarding', 'user-management'],
        priority: 95,
        estimatedTime: 3000,
      },
    ]);

    // Reporting
    mappings.set(TaskType.REPORT_GENERATION, [
      {
        agent: 'project-manager',
        skills: ['generate-report', 'summarize-data'],
        capabilities: ['reporting', 'data-aggregation'],
        priority: 90,
        estimatedTime: 4000,
      },
      {
        agent: 'data-engineer',
        skills: ['analyze-data', 'create-report'],
        capabilities: ['analytics', 'reporting'],
        priority: 85,
        estimatedTime: 5000,
      },
    ]);

    mappings.set(TaskType.DATA_ANALYSIS, [
      {
        agent: 'data-engineer',
        skills: ['analyze-data', 'generate-insights'],
        capabilities: ['analytics', 'data-science'],
        priority: 95,
        estimatedTime: 3000,
      },
      {
        agent: 'gnn-heuristic',
        skills: ['analyze-patterns'],
        capabilities: ['ml-analysis', 'pattern-recognition'],
        priority: 85,
        estimatedTime: 2000,
      },
    ]);

    // Testing
    mappings.set(TaskType.SYSTEM_TESTING, [
      {
        agent: 'qa',
        skills: ['run-tests', 'validate-system'],
        capabilities: ['testing', 'quality-assurance'],
        priority: 95,
        estimatedTime: 5000,
      },
    ]);

    // Deployment
    mappings.set(TaskType.DEPLOYMENT, [
      {
        agent: 'devops',
        skills: ['deploy', 'deploy-wizard'],
        capabilities: ['deployment', 'infrastructure-management'],
        priority: 95,
        estimatedTime: 8000,
      },
      {
        agent: 'sre',
        skills: ['deploy-reliably'],
        capabilities: ['deployment', 'reliability'],
        priority: 85,
        estimatedTime: 7000,
      },
    ]);

    // Security
    mappings.set(TaskType.SECURITY_REVIEW, [
      {
        agent: 'security',
        skills: ['review-security', 'audit-security'],
        capabilities: ['security-audit', 'compliance'],
        priority: 95,
        estimatedTime: 4000,
      },
    ]);

    // DLT/Blockchain
    mappings.set(TaskType.BLOCKCHAIN_INTEGRATION, [
      {
        agent: 'dlt-architect',
        skills: ['design-blockchain', 'integrate-dlt'],
        capabilities: ['blockchain-design', 'system-integration'],
        priority: 95,
        estimatedTime: 6000,
      },
      {
        agent: 'dlt-developer',
        skills: ['develop-smart-contracts'],
        capabilities: ['smart-contract-development'],
        priority: 85,
        estimatedTime: 5000,
      },
    ]);

    return mappings;
  }

  /**
   * Get agents capable of handling a task type
   */
  private getCapableAgents(taskType: TaskType): CapabilityMapping[] {
    return this.capabilityMappings.get(taskType) || [];
  }

  /**
   * Rank agents based on constraints and performance
   */
  private async rankAgents(
    mappings: CapabilityMapping[],
    priority: TaskPriority,
    constraints?: { maxExecutionTime?: number; requiredCapabilities?: string[]; preferredAgents?: string[] }
  ): Promise<CapabilityMapping[]> {
    let ranked = [...mappings];

    // Filter by execution time constraint
    if (constraints?.maxExecutionTime) {
      ranked = ranked.filter(m => m.estimatedTime <= constraints.maxExecutionTime!);
    }

    // Filter by required capabilities
    if (constraints?.requiredCapabilities && constraints.requiredCapabilities.length > 0) {
      ranked = ranked.filter(m =>
        constraints.requiredCapabilities!.every(cap => m.capabilities.includes(cap))
      );
    }

    // Sort by preference
    if (constraints?.preferredAgents && constraints.preferredAgents.length > 0) {
      ranked.sort((a, b) => {
        const aIndex = constraints.preferredAgents!.indexOf(a.agent);
        const bIndex = constraints.preferredAgents!.indexOf(b.agent);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return 0;
      });
    }

    // Sort by priority
    ranked.sort((a, b) => b.priority - a.priority);

    return ranked;
  }

  /**
   * Generate reasoning for agent selection
   */
  private generateRoutingReasoning (
    mapping: CapabilityMapping,
    request: SkillRoutingRequest
  ): string {
    const reasons = [];
    reasons.push(`Selected ${mapping.agent} for ${request.taskType}`);
    reasons.push(`Task priority: ${request.priority}`);
    reasons.push(`Available skills: ${mapping.skills.join(', ')}`);
    return reasons.join(' | ');
  }

  /**
   * Calculate confidence score for assignment
   */
  private calculateConfidence(mapping: CapabilityMapping, request: SkillRoutingRequest): number {
    let confidence = mapping.priority / 100;

    // Adjust based on priority
    switch (request.priority) {
      case TaskPriority.CRITICAL:
        confidence *= 1.1; // Prefer most capable agents for critical tasks
        break;
      case TaskPriority.HIGH:
        confidence *= 1.05;
        break;
    }

    return Math.min(1, confidence);
  }

  /**
   * Get supporting agents for a task
   */
  private getSupportingAgents(primaryAgent: string, taskType: TaskType): string[] {
    const mappings = this.capabilityMappings.get(taskType) || [];
    return mappings
      .filter(m => m.agent !== primaryAgent)
      .slice(0, 2)
      .map(m => m.agent);
  }

  /**
   * Get agent display name
   */
  private getAgentName(agentId: string): string {
    const names: Record<string, string> = {
      'devops': 'DevOps Engineer',
      'qa': 'QA Engineer',
      'dlt-architect': 'DLT Architect',
      'dlt-developer': 'DLT Developer',
      'data-engineer': 'Data Engineer',
      'security': 'Security & Compliance',
      'sre': 'SRE/Reliability',
      'gnn-heuristic': 'GNN Heuristic',
      'project-manager': 'Project Manager',
      'onboarding': 'Employee Onboarding',
      'frontend': 'Frontend Developer',
      'master-sop': 'Master SOP',
    };
    return names[agentId] || agentId;
  }

  /**
   * Record agent performance
   */
  recordAgentPerformance(
    agentId: string,
    taskType: TaskType,
    success: boolean,
    executionTime: number
  ): void {
    if (!this.agentPerformance.has(agentId)) {
      this.agentPerformance.set(agentId, {
        successCount: 0,
        failureCount: 0,
        totalExecutionTime: 0,
        invocationCount: 0,
        lastUsed: new Date(),
      });
    }

    const perf = this.agentPerformance.get(agentId)!;
    if (success) {
      perf.successCount++;
    } else {
      perf.failureCount++;
    }
    perf.totalExecutionTime += executionTime;
    perf.invocationCount++;
    perf.lastUsed = new Date();
  }

  /**
   * Get agent performance data
   */
  getAgentPerformance(agentId: string): AgentPerformanceData | undefined {
    return this.agentPerformance.get(agentId);
  }
}

/**
 * Agent performance tracking data
 */
interface AgentPerformanceData {
  successCount: number;
  failureCount: number;
  totalExecutionTime: number;
  invocationCount: number;
  lastUsed: Date;
  get averageExecutionTime(): number {
    return this.totalExecutionTime / this.invocationCount || 0;
  }
  get successRate(): number {
    return this.successCount / (this.successCount + this.failureCount) || 0;
  }
}

// Export factory
export function createSkillRouter(): J4CSkillRouter {
  return new J4CSkillRouter();
}

export const skillRouter = new J4CSkillRouter();

export default J4CSkillRouter;
