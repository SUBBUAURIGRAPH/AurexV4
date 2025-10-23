# Aurigraph Agent Environment Loader

**Auto-load all project files and credentials when agents initialize**

---

## Quick Start

### 1. Create credentials file

```bash
cp credentials.md.template credentials.md
nano credentials.md  # Fill in your credentials
chmod 600 credentials.md
```

### 2. Initialize environment in code

```javascript
const AurigraphAgentsPlugin = require('./plugin/index.js');

const plugin = new AurigraphAgentsPlugin();

// Initialize - loads all project files and credentials
await plugin.initializeEnvironment({
  environment: 'development',
  verbose: true
});

// Now you can access project context
const context = plugin.getProjectContext();
const hasApiKey = plugin.hasCredential('HERMES_API_KEY');
```

### 3. From CLI

```bash
# Initialize environment
node plugin/environment-loader.js init --verbose

# Check what loaded
node plugin/environment-loader.js status

# View credentials info
node plugin/environment-loader.js credentials

# Export state for debugging
node plugin/environment-loader.js export state.json
```

---

## What Gets Loaded?

✅ **Context Files**
- CONTEXT.md (project overview)
- README.md (documentation)
- TODO.md (tasks)
- PROMPTS.md (interaction logs)
- CHANGELOG.md (version history)

✅ **Configuration**
- plugin/config.json
- plugin/package.json

✅ **Agent & Skill Definitions**
- All agents (agents/*.md)
- All skills (skills/*.md)

✅ **Credentials**
- credentials.md (main credentials file)
- Environment variables (API keys, secrets)

---

## Key Features

### Automatic Project Context Loading

All agents automatically have access to:
- Project specifications and requirements
- Skill definitions and capabilities
- Agent documentation and roles
- Task tracking and TODO items
- Change history and version info

### Secure Credential Management

- Credentials loaded from credentials.md
- Environment variable support
- Automatic credential redaction in logs
- Encryptable field identification
- Hash-based integrity tracking

### Easy Integration

```javascript
// Simple one-line initialization
await plugin.initializeEnvironment();

// Access project context anytime
const context = plugin.getContextFileContent('CONTEXT.md');

// Check for credentials
if (plugin.hasCredential('API_KEY')) {
  const key = plugin.getCredential('API_KEY', false); // Get actual value
}
```

---

## API Methods

### Core Methods

| Method | Purpose |
|--------|---------|
| `initializeEnvironment(options)` | Load all project files and credentials |
| `getProjectContext()` | Get loaded context and credentials |
| `getContextFileContent(fileName)` | Get specific file content |
| `getLoadedFiles()` | Get all loaded file metadata |
| `isEnvironmentLoaded()` | Check if initialized |

### Credential Methods

| Method | Purpose |
|--------|---------|
| `hasCredential(key)` | Check if credential exists |
| `getCredential(key, redact=true)` | Get credential value |
| `getAllCredentials(redact=true)` | Get all credentials |

### Status Methods

| Method | Purpose |
|--------|---------|
| `getEnvironmentStatus()` | Get status summary |
| `exportEnvironmentState(path)` | Export state for debugging |

---

## Security

### Credential Redaction

By default, credentials are redacted for safety:

```javascript
// Safe for logs - shows only last 4 chars
const redacted = plugin.getCredential('API_KEY');
// Returns: "***abc123"

// Full value - internal use only
const actual = plugin.getCredential('API_KEY', false);
// Returns: "actual-api-key-value"
```

### Best Practices

✅ **DO:**
- Create credentials.md from template
- Use chmod 600 credentials.md
- Add credentials.md to .gitignore
- Use environment-specific credentials
- Rotate credentials regularly

❌ **DON'T:**
- Commit credentials.md to git
- Log actual credential values
- Share credentials via email
- Hardcode credentials in code
- Use same credentials across environments

---

## Examples

### Initialize and Check Status

```javascript
const plugin = new AurigraphAgentsPlugin();

await plugin.initializeEnvironment({
  environment: 'development',
  verbose: true
});

const status = plugin.getEnvironmentStatus();
console.log(`Loaded: ${status.filesLoaded} files`);
console.log(`Credentials: ${status.credentialsAvailable}`);
console.log(`Context: ${status.contextAvailable}`);
```

### Access Project Context in Agent

```javascript
class DevOpsAgent {
  async deploy(task) {
    // Get project context
    const contextContent = this.plugin.getContextFileContent('CONTEXT.md');

    // Get credentials
    if (this.plugin.hasCredential('HERMES_API_KEY')) {
      const apiKey = this.plugin.getCredential('HERMES_API_KEY', false);

      // Deploy with context and credentials
      return this.hermes.deploy(task, {
        context: contextContent,
        apiKey: apiKey
      });
    }
  }
}
```

### Verify Credentials Before Operation

```javascript
class TraderAgent {
  async executeStrategy(strategy) {
    // Verify all required credentials
    const required = [
      'BINANCE_API_KEY',
      'BINANCE_API_SECRET'
    ];

    const missing = required.filter(k => !this.plugin.hasCredential(k));

    if (missing.length > 0) {
      throw new Error(`Missing: ${missing.join(', ')}`);
    }

    // All credentials available - proceed
    return this.execute(strategy);
  }
}
```

---

## Files Included

| File | Purpose |
|------|---------|
| `plugin/environment-loader.js` | Core environment loader |
| `plugin/index.js` | Updated to integrate loader |
| `credentials.md.template` | Template for credentials file |
| `docs/ENVIRONMENT_LOADING.md` | Comprehensive documentation |
| `plugin/ENVIRONMENT_LOADER_README.md` | This file |

---

## Troubleshooting

### Environment not initializing

**Check:**
```bash
# 1. Does credentials.md exist?
ls -la credentials.md

# 2. Does .env file exist?
ls -la .env

# 3. Are you in right directory?
pwd

# 4. Run with verbose flag
node plugin/environment-loader.js init --verbose
```

### Can't find context files

**Solution:**
```javascript
// Ensure correct project root
await plugin.initializeEnvironment({
  projectRoot: '/full/path/to/aurigraph-agents-staging',
  verbose: true
});
```

### Credentials not loading

**Solution:**
```bash
# 1. Create credentials from template
cp credentials.md.template credentials.md

# 2. Edit file
nano credentials.md

# 3. Set permissions
chmod 600 credentials.md

# 4. Test loading
node plugin/environment-loader.js credentials
```

---

## CLI Commands

### Initialize Environment

```bash
# Basic initialization
node plugin/environment-loader.js init

# With verbose output
node plugin/environment-loader.js init --verbose
```

### Check Status

```bash
# Show what files loaded
node plugin/environment-loader.js status
```

### Credentials Info

```bash
# Show credential sources and status
node plugin/environment-loader.js credentials
```

### Export State

```bash
# Export environment state for debugging
node plugin/environment-loader.js export state.json
```

### Help

```bash
# Show command help
node plugin/environment-loader.js help
```

---

## Performance

- **Initial load**: ~50-100ms
- **Memory usage**: ~5-10MB typical
- **File count**: 40+ files automatically loaded
- **Caching**: All files cached in memory
- **Credential parsing**: ~10-20ms

---

## Version Information

| Component | Version | Status |
|-----------|---------|--------|
| Environment Loader | 1.0.0 | ✅ Ready |
| Plugin Integration | 1.0.0 | ✅ Ready |
| Credentials Support | 1.0.0 | ✅ Ready |
| CLI Tools | 1.0.0 | ✅ Ready |

---

## Support

- **Documentation**: See docs/ENVIRONMENT_LOADING.md
- **Email**: agents@aurigraph.io
- **Slack**: #aurigraph-agents

---

**Created**: 2025-10-23
**Maintained By**: Aurigraph Development Team

