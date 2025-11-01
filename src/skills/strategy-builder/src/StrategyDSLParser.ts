/**
 * StrategyDSLParser - YAML/JSON Strategy Definition Parser
 * Parses and validates strategy definitions
 */

export class StrategyDSLParser {
  parseYAML(yaml: string): any {
    // TODO: Implement YAML parsing
    // For now, return parsed JSON representation
    try {
      return JSON.parse(yaml);
    } catch (e) {
      throw new Error(`Invalid YAML/JSON: ${e}`);
    }
  }

  parseJSON(json: string): any {
    return JSON.parse(json);
  }

  validate(definition: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!definition.name) errors.push('Strategy name is required');
    if (!Array.isArray(definition.conditions)) errors.push('Conditions array required');
    if (!Array.isArray(definition.actions)) errors.push('Actions array required');

    return { valid: errors.length === 0, errors };
  }
}

export default StrategyDSLParser;
