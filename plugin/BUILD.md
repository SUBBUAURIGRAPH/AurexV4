# Aurigraph Claude Code Plugin - Build & Deployment Guide

**Version**: 1.0.0
**Date**: October 23, 2025
**Status**: Production Ready

---

## Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- Claude Code CLI installed
- Git for version control

### Installation

```bash
# Clone the repository
git clone https://github.com/Aurigraph-DLT-Corp/glowing-adventure.git
cd glowing-adventure/plugin

# Install dependencies
npm install

# Run tests to verify everything works
npm test

# Build the plugin distribution
npm run build
```

---

## Build Process

### 1. Clean Build
```bash
npm run clean      # Remove old build artifacts
npm run build      # Create new distribution
```

### 2. Verify Build
```bash
npm test           # Run full test suite
npm run lint       # Check code quality (if configured)
```

### 3. Package for Distribution
```bash
npm pack           # Create tarball for npm registry
```

---

## Installation Methods

### Method 1: NPM Registry (Recommended)
```bash
# Install directly from npm
npm install @aurigraph/claude-agents-plugin

# Or with Claude Code
claude-code plugin install @aurigraph/claude-agents-plugin
```

### Method 2: From GitHub
```bash
# Clone and install locally
git clone https://github.com/Aurigraph-DLT-Corp/glowing-adventure.git
cd glowing-adventure/plugin
npm install
npm link

# Use in Claude Code
claude-code plugin install file:$(pwd)
```

### Method 3: From Tarball
```bash
# Create tarball
npm pack

# Install tarball
npm install ./aurigraph-claude-agents-plugin-1.0.0.tgz
```

---

## Plugin Activation

### Using Claude Code
```bash
# List installed plugins
claude-code plugin list

# Activate Aurigraph plugin
claude-code plugin activate @aurigraph/claude-agents-plugin

# Verify activation
claude-code plugin status
```

### Configuration
Create `~/.clauderc` or `~/.claude/config.json`:
```json
{
  "plugins": {
    "@aurigraph/claude-agents-plugin": {
      "enabled": true,
      "config": {
        "defaultTimeout": 30000,
        "maxRetries": 3,
        "verbose": false
      }
    }
  }
}
```

---

## Plugin Structure

```
plugin/
├── index.js                          # Main plugin entry point
├── package.json                      # Plugin metadata
├── skills/                           # Skill implementations
│   ├── analyze-code.js              # Code analysis skill
│   ├── run-tests.js                 # Test execution skill
│   ├── hello-world.js               # Example skill
│   ├── file-analyzer.js             # File analysis skill
│   └── helpers/                     # Helper utilities
│       ├── ast-parser.js            # AST parsing
│       ├── language-detector.js     # Language detection
│       ├── bug-patterns.js          # Bug pattern library
│       └── pattern-matcher.js       # Pattern detection
└── agents/                           # Agent definitions
    └── (reference to main agents)
```

---

## Features

### Available Skills

#### Development Tools
- **analyze-code**: Multi-language code quality analysis
  - 10+ language support
  - 20+ bug patterns
  - Complexity metrics
  - Quality scoring

- **run-tests**: Universal test execution
  - Jest, Pytest, Mocha, Go support
  - Coverage analysis
  - Flaky test detection
  - Parallel execution

#### Coming Soon
- **scan-security**: Security vulnerability scanning
- **profile-code**: Performance profiling
- **generate-docs**: Documentation generation
- **comprehensive-review**: Aggregated code review

### Available Agents

All 12 agents are accessible with associated skills:
1. DLT Developer (5 skills)
2. Trading Operations (6 skills)
3. DevOps Engineer (8 skills)
4. QA Engineer (7 skills)
5. Project Manager (5 skills)
6. Security & Compliance (6 skills)
7. Data Engineer (8 skills)
8. Frontend Developer (7 skills)
9. SRE/Reliability (8 skills)
10. Digital Marketing (5 skills)
11. Employee Onboarding (4 skills)
12. Developer Tools (6 skills - NEW)

---

## Testing

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
npm test -- skills/__tests__/analyze-code.test.js
npm test -- skills/__tests__/run-tests.test.js
npm test -- integration.test.js
```

### Test Coverage
```bash
npm test -- --coverage
```

---

## Development

### Adding New Skills

Create a new file in `skills/`:
```javascript
const mySkill = {
  name: 'my-skill',
  description: 'What this skill does',
  version: '1.0.0',
  category: 'category',
  tags: ['tag1', 'tag2'],

  parameters: {
    param1: {
      type: 'string',
      required: true,
      description: 'Parameter description'
    }
  },

  execute: async function(context) {
    // Implementation here
    return { success: true, data: {} };
  },

  formatResult: function(result) {
    // Format for display
    return 'Formatted output';
  }
};

module.exports = mySkill;
```

### Adding Tests

Create tests in `skills/__tests__/`:
```javascript
describe('My Skill', () => {
  test('should do something', () => {
    // Test implementation
  });
});
```

---

## Troubleshooting

### Plugin Not Loading
```bash
# Check plugin installation
claude-code plugin list

# Verify configuration
cat ~/.claude/config.json

# Check for errors
claude-code plugin debug @aurigraph/claude-agents-plugin
```

### Tests Failing
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Run tests with verbose output
npm test -- --verbose
```

### Performance Issues
- Increase `defaultTimeout` in configuration
- Enable `verbose` mode for debugging
- Check system resources
- Review skill parameters

---

## Version History

### v1.0.0 (October 23, 2025)
- ✅ Skill Executor Framework (2,850+ lines)
- ✅ Analyze-Code Skill (350+ lines)
- ✅ Run-Tests Skill (500+ lines)
- ✅ 12 Agent Definitions
- ✅ 76+ Skills (68 documented, 8 implemented)
- ✅ 269+ Test Cases
- ✅ Full Documentation

---

## Support & Contributions

### Reporting Issues
- GitHub Issues: https://github.com/Aurigraph-DLT-Corp/glowing-adventure/issues
- Email: support@aurigraph.ai

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit pull request

### Code Quality Standards
- Must pass all tests (100% pass rate required)
- No console.log in production code
- JSDoc comments for all public functions
- Handle errors gracefully
- Compatible with Node.js 18+

---

## License

MIT License - See LICENSE.md for details

---

## Credits

**Aurigraph Development Team**
Built with Claude Code and AI-Assisted Development
Powered by the SPARC Framework

---

## Changelog

See CHANGELOG.md for detailed version history and release notes.

---

**Last Updated**: October 23, 2025
**Next Update**: November 15, 2025 (v1.1.0 with additional skills)
