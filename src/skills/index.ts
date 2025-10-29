/**
 * Skills Module Index
 * Exports all available skills for the HMS Trading Platform
 * Version: 1.0.0
 */

export { ExchangeConnector, default as ExchangeConnectorDefault } from './exchange-connector';
export { StrategyBuilder, default as StrategyBuilderDefault } from './strategy-builder';
export { DockerManager, default as DockerManagerDefault } from './docker-manager';

/**
 * Skill Registry
 * Central registry of all available skills
 */
export const skillRegistry = {
  trading: {
    'exchange-connector': {
      name: 'Exchange Connector',
      description: 'Manage connections to 12+ cryptocurrency and trading exchanges',
      agent: 'Trading Operations',
      version: '1.0.0',
      status: 'active',
    },
    'strategy-builder': {
      name: 'Strategy Builder',
      description: 'Create, backtest, and deploy trading strategies',
      agent: 'Trading Operations',
      version: '1.0.0',
      status: 'active',
    },
  },
  devops: {
    'docker-manager': {
      name: 'Docker Manager',
      description: 'Container lifecycle management and Docker Compose orchestration',
      agent: 'DevOps Engineer',
      version: '1.0.0',
      status: 'active',
    },
  },
};

/**
 * Get skill by name
 */
export function getSkill(skillName: string): any {
  const skillMap: Record<string, any> = {
    'exchange-connector': require('./exchange-connector').default,
    'strategy-builder': require('./strategy-builder').default,
    'docker-manager': require('./docker-manager').default,
  };

  return skillMap[skillName] || null;
}

/**
 * List all available skills
 */
export function listAllSkills(): Array<{
  id: string;
  name: string;
  description: string;
  agent: string;
  version: string;
}> {
  const skills: Array<{
    id: string;
    name: string;
    description: string;
    agent: string;
    version: string;
  }> = [];

  for (const [category, categorySkills] of Object.entries(skillRegistry)) {
    for (const [skillId, skillInfo] of Object.entries(categorySkills)) {
      skills.push({
        id: skillId,
        name: (skillInfo as any).name,
        description: (skillInfo as any).description,
        agent: (skillInfo as any).agent,
        version: (skillInfo as any).version,
      });
    }
  }

  return skills;
}

/**
 * Get skills by agent
 */
export function getSkillsByAgent(agentName: string): string[] {
  const skills: string[] = [];

  for (const [category, categorySkills] of Object.entries(skillRegistry)) {
    for (const [skillId, skillInfo] of Object.entries(categorySkills)) {
      if ((skillInfo as any).agent === agentName) {
        skills.push(skillId);
      }
    }
  }

  return skills;
}

export default {
  skillRegistry,
  getSkill,
  listAllSkills,
  getSkillsByAgent,
};
