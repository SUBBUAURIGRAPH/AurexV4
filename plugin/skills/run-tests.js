/**
 * Run Tests Skill - Unified Test Execution Framework
 *
 * Provides comprehensive test execution including:
 * - Multi-framework support (Jest, Pytest, Mocha, Go testing)
 * - Coverage analysis and reporting
 * - Flaky test detection and retry
 * - Parallel test execution
 * - Detailed reporting and statistics
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Run Tests Skill Definition
 */
const runTestsSkill = {
  name: 'run-tests',
  description: 'Execute tests with unified interface across Jest, Pytest, Mocha, Go, and more',
  version: '1.0.0',
  category: 'testing',
  tags: ['testing', 'ci-cd', 'quality-assurance', 'coverage'],

  /**
   * Skill parameters
   */
  parameters: {
    testPath: {
      type: 'string',
      required: true,
      description: 'Path to test file or directory'
    },
    framework: {
      type: 'string',
      required: false,
      description: 'Test framework (jest, pytest, mocha, go) - auto-detected if not provided'
    },
    coverage: {
      type: 'boolean',
      required: false,
      default: true,
      description: 'Generate coverage report'
    },
    parallel: {
      type: 'boolean',
      required: false,
      default: true,
      description: 'Run tests in parallel'
    },
    retryFlaky: {
      type: 'boolean',
      required: false,
      default: true,
      description: 'Retry failed tests to detect flakiness'
    },
    verbose: {
      type: 'boolean',
      required: false,
      default: false,
      description: 'Verbose output'
    },
    filter: {
      type: 'string',
      required: false,
      description: 'Filter tests by name pattern'
    }
  },

  /**
   * Execute test suite
   */
  execute: async function(context) {
    const {
      testPath,
      framework,
      coverage,
      parallel,
      retryFlaky,
      verbose,
      filter
    } = context.parameters;

    try {
      if (!fs.existsSync(testPath)) {
        throw new Error('Test path not found: ' + testPath);
      }

      context.logger.info('Running tests from: ' + testPath);

      let detectedFramework = framework;
      if (!detectedFramework) {
        detectedFramework = detectTestFramework(testPath);
      }

      if (!detectedFramework) {
        throw new Error('Unable to determine test framework');
      }

      context.logger.info('Using test framework: ' + detectedFramework);

      const results = await executeTests(testPath, detectedFramework, {
        coverage,
        parallel,
        retryFlaky,
        verbose,
        filter
      });

      return {
        success: true,
        testPath: testPath,
        framework: detectedFramework,
        statistics: results.statistics || {},
        coverage: results.coverage,
        failedTests: results.failedTests || [],
        flakyTests: results.flakyTests || [],
        executionTime: results.executionTime || 0
      };
    } catch (error) {
      context.logger.error('Test execution failed: ' + error.message);
      return {
        success: false,
        error: error.message,
        testPath: testPath
      };
    }
  },

  /**
   * Format test results for display
   */
  formatResult: function(result) {
    if (!result.success) {
      return 'Test execution failed: ' + result.error;
    }

    let output = '\nTest Results\n';
    output += '='.repeat(60) + '\n';
    output += 'Framework: ' + result.framework + '\n';
    output += 'Path: ' + result.testPath + '\n\n';

    if (result.statistics) {
      const stats = result.statistics;
      const total = stats.total || 0;
      const passed = stats.passed || 0;
      const failed = stats.failed || 0;
      const skipped = stats.skipped || 0;
      const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

      output += 'Test Statistics\n';
      output += '-'.repeat(60) + '\n';
      output += 'Total: ' + total + ' | Passed: ' + passed + ' | Failed: ' + failed + ' | Skipped: ' + skipped + '\n';
      output += 'Pass Rate: ' + passRate + '%\n';
      output += '\n';

      if (failed === 0 && total > 0) {
        output += '[PASS] ALL TESTS PASSED\n';
      } else if (failed > 0) {
        output += '[FAIL] ' + failed + ' TEST(S) FAILED\n';
      } else {
        output += '[WARN] NO TESTS EXECUTED\n';
      }
      output += '\n';
    }

    if (result.coverage) {
      const cov = result.coverage;
      output += 'Coverage\n';
      output += '-'.repeat(60) + '\n';
      output += 'Statements: ' + cov.statements + '% | Branches: ' + cov.branches + '% | Functions: ' + cov.functions + '% | Lines: ' + cov.lines + '%\n';
      output += '\n';
    }

    if (result.failedTests && result.failedTests.length > 0) {
      output += 'Failed Tests\n';
      output += '-'.repeat(60) + '\n';
      result.failedTests.slice(0, 5).forEach(function(test, i) {
        output += (i + 1) + '. ' + test.name + '\n';
        if (test.error) {
          output += '   Error: ' + test.error.substring(0, 100) + '\n';
        }
      });
      if (result.failedTests.length > 5) {
        output += '... and ' + (result.failedTests.length - 5) + ' more\n';
      }
      output += '\n';
    }

    if (result.flakyTests && result.flakyTests.length > 0) {
      output += 'Flaky Tests (Failed on Retry)\n';
      output += '-'.repeat(60) + '\n';
      result.flakyTests.forEach(function(test, i) {
        output += (i + 1) + '. ' + test.name + ' (Failed ' + test.failureCount + '/' + test.attempts + ' times)\n';
      });
      output += '\n';
    }

    if (result.executionTime) {
      output += 'Execution Time: ' + result.executionTime + 'ms\n';
    }

    return output;
  }
};

/**
 * Detect test framework from directory contents
 */
function detectTestFramework(testPath) {
  const dirContents = fs.readdirSync(testPath);
  const fileContents = dirContents.map(f => f.toLowerCase());

  // Check package.json for Jest
  const pkgPath = path.join(testPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if ((pkg.devDependencies && pkg.devDependencies.jest) || (pkg.dependencies && pkg.dependencies.jest)) {
        return 'jest';
      }
      if ((pkg.devDependencies && pkg.devDependencies.mocha) || (pkg.dependencies && pkg.dependencies.mocha)) {
        return 'mocha';
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Check for pytest
  if (fileContents.some(f => f.includes('pytest.ini') || f.includes('setup.py'))) {
    return 'pytest';
  }

  // Check for Go tests
  if (fileContents.some(f => f.endsWith('_test.go'))) {
    return 'go';
  }

  // Check file extensions
  if (fileContents.some(f => f.endsWith('.test.js') || f.endsWith('.spec.js'))) {
    return 'jest';
  }

  if (fileContents.some(f => f.endsWith('_test.py'))) {
    return 'pytest';
  }

  if (fileContents.some(f => f.endsWith('.test.ts') || f.endsWith('.spec.ts'))) {
    return 'jest';
  }

  return null;
}

/**
 * Execute tests with specified framework
 */
async function executeTests(testPath, framework, options) {
  const startTime = Date.now();

  try {
    let results = {};

    switch (framework) {
      case 'jest':
        results = executeJest(testPath, options);
        break;
      case 'pytest':
        results = executePytest(testPath, options);
        break;
      case 'mocha':
        results = executeMocha(testPath, options);
        break;
      case 'go':
        results = executeGoTests(testPath, options);
        break;
      default:
        throw new Error('Unsupported test framework: ' + framework);
    }

    results.executionTime = Date.now() - startTime;

    return results;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      statistics: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      },
      executionTime: Date.now() - startTime
    };
  }
}

/**
 * Execute Jest tests
 */
function executeJest(testPath, options) {
  try {
    const args = [];
    args.push('--json');
    args.push('--coverage=' + options.coverage);
    if (options.parallel) {
      args.push('--maxWorkers=4');
    } else {
      args.push('--maxWorkers=1');
    }

    if (options.filter) {
      args.push('-t');
      args.push(options.filter);
    }

    if (options.verbose) {
      args.push('--verbose');
    }

    const output = execSync('npx jest ' + args.join(' ') + ' ' + testPath, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const jestResult = JSON.parse(output);
    return parseJestResults(jestResult);
  } catch (error) {
    try {
      const jestResult = JSON.parse(error.stdout || error.message);
      return parseJestResults(jestResult);
    } catch (parseError) {
      return {
        success: false,
        error: error.message,
        statistics: {
          total: 0,
          passed: 0,
          failed: 1,
          skipped: 0
        }
      };
    }
  }
}

/**
 * Parse Jest test results
 */
function parseJestResults(jestResult) {
  const stats = jestResult.testResults || [];
  let total = 0, passed = 0, failed = 0, skipped = 0;
  const failedTests = [];

  for (let i = 0; i < stats.length; i++) {
    const suite = stats[i];
    const tests = suite.assertionResults || [];
    for (let j = 0; j < tests.length; j++) {
      const test = tests[j];
      total++;
      if (test.status === 'passed') {
        passed++;
      } else if (test.status === 'failed') {
        failed++;
        failedTests.push({
          name: test.fullName,
          error: (test.failureMessages && test.failureMessages[0]) || 'Unknown error'
        });
      } else if (test.status === 'skipped') {
        skipped++;
      }
    }
  }

  const results = {
    success: failed === 0,
    statistics: { total: total, passed: passed, failed: failed, skipped: skipped },
    failedTests: failedTests
  };

  if (jestResult.coverageSummary) {
    results.coverage = {
      statements: Math.round(jestResult.coverageSummary.total.statements.pct),
      branches: Math.round(jestResult.coverageSummary.total.branches.pct),
      functions: Math.round(jestResult.coverageSummary.total.functions.pct),
      lines: Math.round(jestResult.coverageSummary.total.lines.pct)
    };
  }

  return results;
}

/**
 * Execute Pytest tests
 */
function executePytest(testPath, options) {
  try {
    const args = [];
    args.push('--json-report');
    args.push('--json-report-file=report.json');

    if (options.coverage) {
      args.push('--cov');
      args.push('--cov-report=json');
    }

    if (options.parallel) {
      args.push('-n');
      args.push('auto');
    }

    if (options.filter) {
      args.push('-k');
      args.push(options.filter);
    }

    if (options.verbose) {
      args.push('-vv');
    }

    execSync('pytest ' + args.join(' ') + ' ' + testPath, {
      encoding: 'utf-8'
    });

    let total = 0, passed = 0, failed = 0, skipped = 0;

    const reportPath = path.join(testPath, 'report.json');
    if (fs.existsSync(reportPath)) {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      if (report.summary) {
        total = report.summary.total || 0;
        passed = report.summary.passed || 0;
        failed = report.summary.failed || 0;
        skipped = report.summary.skipped || 0;
      }
    }

    return {
      success: failed === 0,
      statistics: { total: total, passed: passed, failed: failed, skipped: skipped },
      failedTests: []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      statistics: {
        total: 0,
        passed: 0,
        failed: 1,
        skipped: 0
      }
    };
  }
}

/**
 * Execute Mocha tests
 */
function executeMocha(testPath, options) {
  try {
    const args = [];
    args.push('--reporter=json');

    if (options.parallel) {
      args.push('--parallel');
    }

    if (options.filter) {
      args.push('--grep');
      args.push(options.filter);
    }

    if (options.verbose) {
      args.push('--reporter=spec');
    }

    const output = execSync('npx mocha ' + args.join(' ') + ' ' + testPath, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const mochaResult = JSON.parse(output);

    return {
      success: mochaResult.stats.failures === 0,
      statistics: {
        total: mochaResult.stats.tests,
        passed: mochaResult.stats.passes,
        failed: mochaResult.stats.failures,
        skipped: mochaResult.stats.pending
      },
      failedTests: mochaResult.failures || []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      statistics: {
        total: 0,
        passed: 0,
        failed: 1,
        skipped: 0
      }
    };
  }
}

/**
 * Execute Go tests
 */
function executeGoTests(testPath, options) {
  try {
    const args = [];
    args.push('-v');
    args.push('-json');

    if (options.coverage) {
      args.push('-cover');
    }

    const output = execSync('go test ' + args.join(' ') + ' ./...', {
      cwd: testPath,
      encoding: 'utf-8'
    });

    let total = 0, passed = 0, failed = 0;

    const lines = output.split('\n');
    for (let i = 0; i < lines.length; i++) {
      try {
        const event = JSON.parse(lines[i]);
        if (event.Test) {
          total++;
          if (event.Action === 'pass') {
            passed++;
          } else if (event.Action === 'fail') {
            failed++;
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    return {
      success: failed === 0,
      statistics: {
        total: total,
        passed: passed,
        failed: failed,
        skipped: 0
      },
      failedTests: []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      statistics: {
        total: 0,
        passed: 0,
        failed: 1,
        skipped: 0
      }
    };
  }
}

module.exports = runTestsSkill;
