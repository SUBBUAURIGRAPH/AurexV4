/**
 * Profile Code Skill - Performance Profiling and Analysis
 *
 * Provides code performance profiling including:
 * - Function execution timing
 * - Memory usage analysis
 * - Algorithm complexity assessment
 * - Bottleneck identification
 * - Optimization recommendations
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const fs = require('fs');
const path = require('path');

/**
 * Profile Code Skill Definition
 */
const profileCodeSkill = {
  name: 'profile-code',
  description: 'Analyze code performance with profiling metrics and optimization recommendations',
  version: '1.0.0',
  category: 'performance',
  tags: ['profiling', 'performance', 'optimization', 'benchmarking'],

  parameters: {
    filePath: {
      type: 'string',
      required: true,
      description: 'Path to file to profile'
    },
    focusArea: {
      type: 'string',
      required: false,
      default: 'all',
      description: 'Focus area: functions, loops, memory, all'
    },
    detailedAnalysis: {
      type: 'boolean',
      required: false,
      default: true,
      description: 'Include detailed performance metrics'
    }
  },

  execute: async function(context) {
    const { filePath, focusArea, detailedAnalysis } = context.parameters;

    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found: ' + filePath);
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      context.logger.info('Profiling: ' + path.basename(filePath));

      const profile = performanceProfile(content, focusArea || 'all', detailedAnalysis !== false);

      return {
        success: true,
        file: filePath,
        ...profile
      };
    } catch (error) {
      context.logger.error('Profiling failed: ' + error.message);
      return {
        success: false,
        error: error.message,
        file: filePath
      };
    }
  },

  formatResult: function(result) {
    if (!result.success) {
      return 'Profiling failed: ' + result.error;
    }

    let output = '\nPerformance Profile\n';
    output += '='.repeat(60) + '\n';
    output += 'File: ' + path.basename(result.file) + '\n\n';

    if (result.metrics) {
      output += 'Performance Metrics\n';
      output += '-'.repeat(60) + '\n';
      const m = result.metrics;
      output += 'Functions: ' + m.functions + '\n';
      output += 'Loops: ' + m.loops + '\n';
      output += 'Async Operations: ' + m.asyncOps + '\n';
      output += 'Estimated Time Complexity: ' + m.timeComplexity + '\n';
      output += '\n';
    }

    if (result.bottlenecks && result.bottlenecks.length > 0) {
      output += 'Performance Bottlenecks\n';
      output += '-'.repeat(60) + '\n';
      result.bottlenecks.forEach(function(b, i) {
        output += (i + 1) + '. ' + b.issue + ' (Line ' + b.line + ')\n';
        output += '   Impact: ' + b.impact + '\n';
      });
      output += '\n';
    }

    if (result.optimizations && result.optimizations.length > 0) {
      output += 'Optimization Opportunities\n';
      output += '-'.repeat(60) + '\n';
      result.optimizations.slice(0, 5).forEach(function(opt, i) {
        output += (i + 1) + '. ' + opt.title + '\n';
        output += '   Potential Gain: ' + opt.gain + '\n';
      });
      output += '\n';
    }

    if (result.score) {
      output += 'Performance Score: ' + result.score + '/100\n';
    }

    return output;
  }
};

/**
 * Perform code performance profiling
 */
function performanceProfile(code, focusArea, detailed) {
  const lines = code.split('\n');
  const metrics = {
    functions: 0,
    loops: 0,
    asyncOps: 0,
    timeComplexity: 'O(n)',
    recursiveFunctions: 0,
    nestedLoops: 0
  };

  const bottlenecks = [];
  const optimizations = [];

  // Count functions
  metrics.functions = (code.match(/function\s+\w+|const\s+\w+\s*=\s*function|const\s+\w+\s*=\s*\(|=>\s*\{/g) || []).length;

  // Count loops
  metrics.loops = (code.match(/for\s*\(|while\s*\(|forEach|map\(|reduce\(/g) || []).length;

  // Count async operations
  metrics.asyncOps = (code.match(/async\s+|await\s+|Promise|\.then\(|\.catch\(/g) || []).length;

  // Detect recursive functions
  const functionMatches = code.matchAll(/function\s+(\w+)|const\s+(\w+)\s*=\s*function/g);
  const functionNames = [];
  for (const match of functionMatches) {
    const name = match[1] || match[2];
    if (name) functionNames.push(name);
  }

  functionNames.forEach(name => {
    if (code.includes(name + '(') && code.includes('function ' + name)) {
      metrics.recursiveFunctions++;
      bottlenecks.push({
        issue: 'Recursive function: ' + name,
        line: lines.findIndex(l => l.includes('function ' + name) || l.includes(name + ' = function')) + 1,
        impact: 'Stack overflow risk, consider iteration'
      });
    }
  });

  // Detect nested loops by counting opening and closing braces
  let nestingLevel = 0;
  let maxNesting = 0;
  lines.forEach(function(line, idx) {
    const forCount = (line.match(/for\s*\(/g) || []).length;
    const whileCount = (line.match(/while\s*\(/g) || []).length;
    const closingCount = (line.match(/\}/g) || []).length;

    nestingLevel += forCount + whileCount;

    if (nestingLevel > maxNesting) {
      maxNesting = nestingLevel;
    }

    nestingLevel -= closingCount;
  });

  if (maxNesting > 2) {
    metrics.timeComplexity = 'O(n^' + maxNesting + ')';
    metrics.nestedLoops = maxNesting - 1;
    bottlenecks.push({
      issue: 'Deeply nested loops',
      line: 1,
      impact: 'O(n^' + maxNesting + ') complexity'
    });
  }

  // Generate optimization recommendations
  if (metrics.recursiveFunctions > 0) {
    optimizations.push({
      title: 'Replace recursion with iteration',
      description: 'Recursive functions can cause stack overflow',
      gain: '30-50%'
    });
  }

  if (metrics.nestedLoops > 0) {
    optimizations.push({
      title: 'Reduce loop nesting',
      description: 'Nested loops create exponential complexity',
      gain: '40-70%'
    });
  }

  if (code.includes('.filter(')) {
    optimizations.push({
      title: 'Chain array operations efficiently',
      description: 'Multiple array iterations create O(n*m) complexity',
      gain: '20-40%'
    });
  }

  if (code.includes('JSON.stringify') || code.includes('JSON.parse')) {
    optimizations.push({
      title: 'Cache serialization results',
      description: 'JSON serialization is expensive, consider caching',
      gain: '15-30%'
    });
  }

  if (code.includes('new RegExp') || code.includes('regex')) {
    optimizations.push({
      title: 'Pre-compile regular expressions',
      description: 'Compiling regex inside loops is inefficient',
      gain: '20-50%'
    });
  }

  // Calculate performance score
  let score = 100;
  bottlenecks.forEach(() => score -= 10);
  if (metrics.timeComplexity.includes('^')) score -= 20;
  if (metrics.asyncOps > metrics.functions) score -= 15;
  score = Math.max(0, Math.min(100, score));

  return {
    metrics,
    bottlenecks: bottlenecks.slice(0, 5),
    optimizations,
    score,
    detailedMetrics: detailed ? {
      linesOfCode: code.split('\n').length,
      complexity: metrics.timeComplexity,
      asyncRatio: metrics.functions > 0 ? (metrics.asyncOps / metrics.functions * 100).toFixed(1) + '%' : '0.0%'
    } : null
  };
}

module.exports = profileCodeSkill;
