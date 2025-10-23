/**
 * Hello World Skill - Example skill implementation
 *
 * Demonstrates the basic structure of a skill module
 * for the Aurigraph Agents Skill Executor Framework
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

module.exports = {
  // Skill metadata
  name: 'hello-world',
  description: 'A simple hello world skill demonstrating the skill framework',
  version: '1.0.0',
  author: 'Aurigraph Development Team',

  // Classification
  category: 'examples',
  tags: ['example', 'demo', 'tutorial'],
  priority: 'low',

  // Configuration
  timeout: 5000, // 5 seconds
  retries: 1,
  output: 'object',

  // Dependencies
  dependencies: [],
  requiredEnvironment: [],

  // Status
  enabled: true,
  experimental: false,
  deprecated: false,

  // Parameters definition
  parameters: {
    name: {
      type: 'string',
      required: false,
      description: 'Name to greet (defaults to "World")',
      default: 'World',
      validate: (value) => {
        return typeof value === 'string' && value.length > 0 && value.length <= 100;
      }
    },
    greeting: {
      type: 'string',
      required: false,
      description: 'Custom greeting message',
      default: 'Hello',
      validate: (value) => {
        return typeof value === 'string' && value.length > 0;
      }
    },
    uppercase: {
      type: 'boolean',
      required: false,
      description: 'Convert output to uppercase',
      default: false
    }
  },

  /**
   * Execute the skill
   *
   * @param {Object} context - Execution context
   * @param {Object} context.parameters - Input parameters
   * @param {Object} context.logger - Logger instance
   * @param {Object} context.helpers - Helper functions
   * @returns {Promise<Object>} Execution result
   */
  async execute(context) {
    const { parameters, logger, helpers } = context;

    // Get parameters with defaults
    const name = parameters.name || 'World';
    const greeting = parameters.greeting || 'Hello';
    const uppercase = parameters.uppercase || false;

    // Log execution
    logger.log(`Executing hello-world skill for: ${name}`);

    // Simulate some async work
    await helpers.sleep(100);

    // Build greeting message
    let message = `${greeting}, ${name}!`;

    if (uppercase) {
      message = message.toUpperCase();
    }

    // Return result
    return {
      message,
      timestamp: new Date().toISOString(),
      parameters: {
        name,
        greeting,
        uppercase
      },
      metadata: {
        executionTime: 100,
        skill: 'hello-world',
        version: '1.0.0'
      }
    };
  },

  /**
   * Format the result for display
   *
   * @param {Object} result - Raw execution result
   * @returns {Object} Formatted result
   */
  formatResult(result) {
    return {
      output: result.message,
      details: {
        timestamp: result.timestamp,
        parameters: result.parameters
      },
      success: true
    };
  }
};
