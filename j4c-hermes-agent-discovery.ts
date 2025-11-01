/**
 * J4C Hermes Agent Discovery Service
 * Dynamically discovers and manages Hermes agents and skills
 *
 * Location: j4c-hermes-agent-discovery.ts
 * Purpose: Provide agent discovery, capability mapping, and agent selection
 * Status: Production Ready
 * Version: 1.0.0
 * Last Updated: November 1, 2025
 */

import { J4CHermesAdapter, HermesAgentInfo, HermesSkillInfo } from './j4c-hermes-adapter';

/**
 * Agent capability map
 */
export interface AgentCapability {
  agent: string;
  capabilities: string[];
  specializations: string[];
  supportedTaskTypes: string[];
  performanceMetrics: {
    averageExecutionTime: number;
    successRate: number;
    reliability: number;
  };
}

/**
 * Agent selection criteria
 */
export interface AgentSelectionCriteria {
  requiredCapabilities?: string[];
  preferredAgents?: string[];
  maxExecutionTime?: number;
  prioritizeReliability?: boolean;
  taskType?: string;
}

/**
 * Agent assignment result
 */
export interface AgentAssignmentResult {
  agent: string;
  skill: string;
  confidence: number;
  reason: string;
  estimatedExecutionTime: number;
  alternativeAgents?: Array<{
    agent: string;
    skill: string;
    confidence: number;
  }>;
}

/**
 * J4C Hermes Agent Discovery Service
 */
export class J4CHermesAgentDiscoveryService {
  private adapter: J4CHermesAdapter;
  private agentCapabilities: Map<string, AgentCapability> = new Map();
  private agentCache: Map<string, HermesAgentInfo> = new Map();
  private lastDiscoveryTime: number = 0;
  private discoveryRefreshInterval: number = 300000; // 5 minutes

  constructor(adapter: J4CHermesAdapter) {
    this.adapter = adapter;
  }

  /**
   * Discover all agents and their capabilities
   */
  async discoverAgents(): Promise<HermesAgentInfo[]> {
    try {
      // Check if discovery is fresh
      if (
        this.agentCache.size > 0 &&
        Date.now() - this.lastDiscoveryTime < this.discoveryRefreshInterval
      ) {
        return Array.from(this.agentCache.values());
      }

      console.log('[Agent Discovery] Discovering agents from Hermes...');

      // Get agents from Hermes
      const agents = await this.adapter.getAvailableAgents();

      // Discover capabilities for each agent
      for (const agent of agents) {
        await this.discoverAgentCapabilities(agent);
        this.agentCache.set(agent.id, agent);
      }

      this.lastDiscoveryTime = Date.now();

      console.log(`[Agent Discovery] Discovered ${agents.length} agents`);
      return agents;
    } catch (error) {
      console.error('[Agent Discovery] Discovery failed:', error);
      return [];
    }
  }

  /**
   * Discover capabilities for a specific agent
   */
  private async discoverAgentCapabilities(agent: HermesAgentInfo): Promise<void> {
    try {
      // Get skills for the agent
      const skills = await this.adapter.getAgentSkills(agent.id);

      // Extract capabilities from skills
      const capabilities = new Set<string>();
      const specializations = new Set<string>();

      skills.forEach((skill) => {
        capabilities.add(skill.category);
        specializations.add(skill.name);
      });

      // Create capability map
      const agentCapability: AgentCapability = {
        agent: agent.id,
        capabilities: Array.from(capabilities),
        specializations: Array.from(specializations),
        supportedTaskTypes: this.mapTaskTypesForAgent(agent.id),
        performanceMetrics: {
          averageExecutionTime: this.estimateAverageExecutionTime(skills),
          successRate: 0.95, // Default success rate
          reliability: this.calculateReliability(agent.status),
        },
      };

      this.agentCapabilities.set(agent.id, agentCapability);

      console.log(`[Agent Discovery] ${agent.id}: ${capabilities.size} capabilities, ${specializations.size} skills`);
    } catch (error) {
      console.error(`[Agent Discovery] Failed to discover capabilities for ${agent.id}:`, error);
    }
  }

  /**
   * Get agent by ID or alias
   */
  async getAgent(agentIdOrAlias: string): Promise<HermesAgentInfo | null> {
    // Check cache first
    if (this.agentCache.has(agentIdOrAlias)) {
      return this.agentCache.get(agentIdOrAlias) || null;
    }

    // Try to get from Hermes
    return this.adapter.getAgent(agentIdOrAlias);
  }

  /**
   * Get all agents
   */
  async getAllAgents(): Promise<HermesAgentInfo[]> {
    if (this.agentCache.size === 0) {
      await this.discoverAgents();
    }
    return Array.from(this.agentCache.values());
  }

  /**
   * Select best agent for task
   */
  async selectBestAgent(
    taskDescription: string,
    criteria: AgentSelectionCriteria
  ): Promise<AgentAssignmentResult | null> {
    try {
      // Discover agents if needed
      if (this.agentCache.size === 0) {
        await this.discoverAgents();
      }

      // Filter agents by criteria
      let candidates = Array.from(this.agentCapabilities.values());

      // Filter by required capabilities
      if (criteria.requiredCapabilities && criteria.requiredCapabilities.length > 0) {
        candidates = candidates.filter((agent) =>
          criteria.requiredCapabilities?.every((cap) =>
            agent.capabilities.includes(cap)
          )
        );
      }

      // Filter by preferred agents
      if (criteria.preferredAgents && criteria.preferredAgents.length > 0) {
        const preferred = candidates.filter((agent) =>
          criteria.preferredAgents?.includes(agent.agent)
        );

        if (preferred.length > 0) {
          candidates = preferred;
        }
      }

      // Filter by execution time
      if (criteria.maxExecutionTime) {
        candidates = candidates.filter(
          (agent) => agent.performanceMetrics.averageExecutionTime <= criteria.maxExecutionTime!
        );
      }

      if (candidates.length === 0) {
        console.warn('[Agent Selection] No agents match criteria');
        return null;
      }

      // Score and rank candidates
      const scored = candidates.map((agent) => {
        const score = this.scoreAgent(agent, criteria, taskDescription);
        return { agent, score };
      });

      // Sort by score (highest first)
      scored.sort((a, b) => b.score - a.score);

      const bestCandidate = scored[0];

      // Find skill for the task
      const skill = this.selectSkillForTask(bestCandidate.agent, taskDescription);

      return {
        agent: bestCandidate.agent.agent,
        skill: skill,
        confidence: bestCandidate.score,
        reason: `Selected ${bestCandidate.agent.agent} for task: ${taskDescription}`,
        estimatedExecutionTime: bestCandidate.agent.performanceMetrics.averageExecutionTime,
        alternativeAgents: scored
          .slice(1, 4)
          .map((candidate) => ({
            agent: candidate.agent.agent,
            skill: this.selectSkillForTask(candidate.agent, taskDescription),
            confidence: candidate.score,
          })),
      };
    } catch (error) {
      console.error('[Agent Selection] Failed to select agent:', error);
      return null;
    }
  }

  /**
   * Score agent for selection
   */
  private scoreAgent(
    agent: AgentCapability,
    criteria: AgentSelectionCriteria,
    taskDescription: string
  ): number {
    let score = 0;

    // Base reliability score
    score += agent.performanceMetrics.reliability * 30;

    // Success rate score
    score += agent.performanceMetrics.successRate * 25;

    // Execution time score (inverse - faster is better)
    const timeScore = Math.max(0, 100 - agent.performanceMetrics.averageExecutionTime / 100);
    score += timeScore * 15;

    // Capability match score
    if (criteria.requiredCapabilities) {
      const matchedCapabilities = criteria.requiredCapabilities.filter((cap) =>
        agent.capabilities.includes(cap)
      ).length;
      const capabilityScore =
        (matchedCapabilities / criteria.requiredCapabilities.length) * 30;
      score += capabilityScore;
    } else {
      score += agent.capabilities.length * 5;
    }

    // Task type match score
    if (criteria.taskType && agent.supportedTaskTypes.includes(criteria.taskType)) {
      score += 10;
    }

    // Reliability prioritization
    if (criteria.prioritizeReliability) {
      score += agent.performanceMetrics.reliability * 20;
    }

    return score;
  }

  /**
   * Select most appropriate skill for task
   */
  private selectSkillForTask(agent: AgentCapability, taskDescription: string): string {
    // Simple skill selection based on task description keywords
    const keywords = taskDescription.toLowerCase().split(' ');
    const specializations = agent.specializations;

    // Find best matching skill
    for (const specialization of specializations) {
      const specWords = specialization.toLowerCase().split('-');
      const matches = specWords.filter((word) => keywords.includes(word)).length;

      if (matches > 0) {
        return specialization;
      }
    }

    // Default to first specialization
    return specializations[0] || 'execute';
  }

  /**
   * Map task types for agent
   */
  private mapTaskTypesForAgent(agentId: string): string[] {
    const taskMapping: Record<string, string[]> = {
      'dlt-developer': ['blockchain-deployment', 'smart-contract', 'token-creation'],
      'trading-operations': ['backtest', 'trading-strategy', 'market-analysis'],
      'devops-engineer': ['deployment', 'infrastructure', 'monitoring'],
      'qa-engineer': ['testing', 'quality-assurance', 'validation'],
      'project-manager': ['planning', 'coordination', 'reporting'],
      'security-compliance': ['security-audit', 'compliance-check', 'vulnerability-scan'],
      'data-engineer': ['data-pipeline', 'analytics', 'reporting'],
      'frontend-developer': ['ui-development', 'frontend-testing', 'design'],
      'sre-reliability': ['incident-response', 'monitoring', 'reliability'],
      'digital-marketing': ['campaign-management', 'marketing-analytics', 'growth'],
      'employee-onboarding': ['onboarding', 'team-management', 'training'],
      'gnn-heuristic-agent': ['optimization', 'graph-analysis', 'prediction'],
    };

    return taskMapping[agentId] || [];
  }

  /**
   * Estimate average execution time for skills
   */
  private estimateAverageExecutionTime(skills: HermesSkillInfo[]): number {
    if (skills.length === 0) return 2000; // Default 2 seconds

    const times = skills
      .map((skill) => skill.averageExecutionTime || 2000)
      .reduce((a, b) => a + b, 0);

    return Math.round(times / skills.length);
  }

  /**
   * Calculate reliability score based on agent status
   */
  private calculateReliability(status: string): number {
    switch (status) {
      case 'active':
        return 0.99;
      case 'inactive':
        return 0.5;
      case 'unavailable':
        return 0.0;
      default:
        return 0.75;
    }
  }

  /**
   * Get agent capabilities
   */
  getAgentCapabilities(agentId: string): AgentCapability | undefined {
    return this.agentCapabilities.get(agentId);
  }

  /**
   * Get all agent capabilities
   */
  getAllAgentCapabilities(): AgentCapability[] {
    return Array.from(this.agentCapabilities.values());
  }

  /**
   * Search agents by capability
   */
  searchAgentsByCapability(capability: string): AgentCapability[] {
    return Array.from(this.agentCapabilities.values()).filter((agent) =>
      agent.capabilities.includes(capability)
    );
  }

  /**
   * Refresh agent discovery
   */
  async refreshAgentDiscovery(): Promise<void> {
    this.agentCache.clear();
    this.agentCapabilities.clear();
    await this.discoverAgents();
  }

  /**
   * Get discovery statistics
   */
  getDiscoveryStats(): {
    totalAgents: number;
    discoveredAt: Date;
    agentCapabilities: { agent: string; capabilities: number }[];
  } {
    const agentCapabilities = Array.from(this.agentCapabilities.values()).map((agent) => ({
      agent: agent.agent,
      capabilities: agent.capabilities.length,
    }));

    return {
      totalAgents: this.agentCache.size,
      discoveredAt: new Date(this.lastDiscoveryTime),
      agentCapabilities,
    };
  }
}

// Factory function to create discovery service
export function createAgentDiscoveryService(
  adapter: J4CHermesAdapter
): J4CHermesAgentDiscoveryService {
  return new J4CHermesAgentDiscoveryService(adapter);
}

// Export all types
export type {
  AgentCapability,
  AgentSelectionCriteria,
  AgentAssignmentResult,
};
