# Aurigraph Agent Environment Loading

**Version**: 1.0.0
**Last Updated**: 2025-10-23
**Status**: ✅ Production Ready

---

## Overview

The Aurigraph Agent Environment Loader is a comprehensive system that automatically loads all project files, including credentials, when the agent environment initializes. This ensures all agents have access to complete project context, configuration, and credentials when they start.

### Key Features

✅ **Automatic File Loading**
- Loads all project context files (CONTEXT.md, README.md, TODO.md, etc.)
- Loads agent and skill definitions
- Loads configuration files (config.json, package.json)

✅ **Credential Management**
- Securely loads credentials from `credentials.md`
- Integrates environment variables
- Identifies encryptable credentials
- Redacts sensitive values in logs

✅ **Project Context Integration**
- Makes all project files available to agents
- Provides access to strategy specifications
- Enables agents to understand project state

✅ **Security**
- Credential redaction by default
- Secure hash tracking
- Audit logging support
- Environment-specific credential isolation

---

## Installation

### 1. Copy Environment Loader

The environment loader is already included in the plugin:

```bash
# File location
plugin/environment-loader.js
```

### 2. Create Credentials File

Create credentials.md from the template:

```bash
cp credentials.md.template credentials.md
```

### 3. Update .gitignore

Add credentials file to .gitignore:

```bash
echo "credentials.md" >> .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

---

## Usage

### Initialize Environment Programmatically

```javascript
const AurigraphAgentsPlugin = require('./plugin/index.js');

// Create plugin instance
const plugin = new AurigraphAgentsPlugin();

// Initialize environment (loads all project files and credentials)
await plugin.initializeEnvironment({
  projectRoot: process.cwd(),
  environment: 'development',
  verbose: true
});

// Now agents can access project context
const context = plugin.getProjectContext();
console.log('Files loaded:', Object.keys(context.files));
console.log('Context files:', Object.keys(context.contextFiles));
```

### Initialize from CLI

```bash
# Initialize environment
node plugin/environment-loader.js init

# Initialize with verbose output
node plugin/environment-loader.js init --verbose

# Check environment status
node plugin/environment-loader.js status

# View credentials information
node plugin/environment-loader.js credentials

# Export environment state
node plugin/environment-loader.js export state.json
```

---

## API Reference

### Plugin Methods

#### `initializeEnvironment(options)`

Initialize the environment and load all project files.

**Parameters:**
- `options.projectRoot` (string): Root directory of the project
- `options.environment` (string): Environment name (development, staging, production)
- `options.verbose` (boolean): Enable verbose logging

**Returns:** Promise<InitializationResult>

**Example:**
```javascript
const result = await plugin.initializeEnvironment({
  projectRoot: '/path/to/project',
  environment: 'production',
  verbose: true
});

// Result structure:
// {
//   success: true,
//   environment: 'production',
//   filesLoaded: 42,
//   contextAvailable: true,
//   credentialsLoaded: true
// }
```

#### `getProjectContext()`

Get the loaded project context.

**Returns:** ProjectContext object

**Example:**
```javascript
const context = plugin.getProjectContext();
// {
//   files: { ... },
//   contextFiles: { 'CONTEXT.md': {...}, ... },
//   credentials: { sources: [...], data: {...}, ... },
//   environment: 'development'
// }
```

#### `getContextFileContent(fileName)`

Get the content of a specific context file.

**Parameters:**
- `fileName` (string): Name of the file (e.g., 'CONTEXT.md')

**Returns:** string | null

**Example:**
```javascript
const contextContent = plugin.getContextFileContent('CONTEXT.md');
if (contextContent) {
  console.log('Project context:', contextContent);
}
```

#### `getLoadedFiles()`

Get metadata for all loaded files.

**Returns:** Map of file metadata

**Example:**
```javascript
const files = plugin.getLoadedFiles();
files.forEach((info, fileName) => {
  console.log(`${fileName}: ${info.size} bytes`);
});
```

#### `hasCredential(key)`

Check if a credential exists.

**Parameters:**
- `key` (string): Credential key name

**Returns:** boolean

**Example:**
```javascript
if (plugin.hasCredential('HERMES_API_KEY')) {
  // Credential is available
}
```

#### `getCredential(key, redact = true)`

Get a credential value (redacted by default).

**Parameters:**
- `key` (string): Credential key name
- `redact` (boolean): Whether to redact the value (default: true)

**Returns:** string | null

**Example:**
```javascript
// Get redacted credential (safe for logging)
const redacted = plugin.getCredential('HERMES_API_KEY');
// Returns: "***abc123"

// Get actual credential (for internal use only)
const actual = plugin.getCredential('HERMES_API_KEY', false);
// Returns: "actual-api-key-value"
```

#### `getAllCredentials(redact = true)`

Get all loaded credentials.

**Parameters:**
- `redact` (boolean): Whether to redact values (default: true)

**Returns:** Credentials object

**Example:**
```javascript
const allCredentials = plugin.getAllCredentials();
// {
//   sources: ['credentials.md', 'environment-variables'],
//   data: { HERMES_API_KEY: '***abc123', ... },
//   environment: { ... },
//   encryptable: { HERMES_API_KEY: true, ... }
// }
```

#### `isEnvironmentLoaded()`

Check if environment has been initialized.

**Returns:** boolean

**Example:**
```javascript
if (plugin.isEnvironmentLoaded()) {
  // Safe to access context and credentials
}
```

#### `getEnvironmentStatus()`

Get detailed environment status.

**Returns:** Status object

**Example:**
```javascript
const status = plugin.getEnvironmentStatus();
// {
//   loaded: true,
//   environment: 'development',
//   filesLoaded: 42,
//   credentialsAvailable: true,
//   contextAvailable: true
// }
```

#### `exportEnvironmentState(outputPath)`

Export environment state to a JSON file.

**Parameters:**
- `outputPath` (string, optional): Path for output file

**Returns:** Exported state object

**Example:**
```javascript
const state = plugin.exportEnvironmentState('environment-state.json');
// Exports state to file for debugging
```

---

## Credentials File Format

### CREDENTIALS.MD Structure

```markdown
# Aurigraph Agent Credentials

## API Credentials

### Hermes Trading Platform

HERMES_API_URL = http://localhost:8005
HERMES_API_KEY = your-key-here

### JIRA Integration

JIRA_API_KEY = your-jira-key
JIRA_USERNAME = your-username
```

### Supported Formats

The environment loader supports multiple credential formats:

**Key=Value Format:**
```
API_KEY = your-api-key
API_SECRET = your-api-secret
```

**YAML Format:**
```
api_key: your-api-key
api_secret: your-api-secret
```

**Environment Variable Format:**
```
export API_KEY="your-api-key"
export API_SECRET="your-api-secret"
```

---

## Loaded Files

### Context Files (Automatically Loaded)

- **CONTEXT.md** - Project context and overview
- **README.md** - Main documentation
- **PROMPTS.md** - Interaction logs
- **TODO.md** - Task tracking
- **CHANGELOG.md** - Version history

### Configuration Files (Automatically Loaded)

- **plugin/config.json** - Plugin configuration
- **plugin/package.json** - Package dependencies

### Agent and Skill Files (Automatically Loaded)

- **agents/\*.md** - All agent definitions
- **skills/\*.md** - All skill definitions (except templates)

### Credentials (Loaded Securely)

- **credentials.md** - Credential storage (redacted in memory)
- **Environment Variables** - System environment credentials

---

## Security Features

### Credential Redaction

By default, credentials are redacted for security:

```javascript
// Gets redacted credential safe for logs
const cred = plugin.getCredential('API_KEY');
// Result: "***abc123" (shows only last 4 chars)

// Gets actual credential (internal use only)
const actualCred = plugin.getCredential('API_KEY', false);
// Result: "actual-api-key-value"
```

### File Hashing

All loaded files are hashed for integrity verification:

```javascript
const context = plugin.getContextFileContent('CONTEXT.md');
const file = plugin.getLoadedFiles()['CONTEXT.md'];
console.log('File hash:', file.hash); // SHA256 first 8 chars
```

### Audit Logging

All credential access is logged (can be integrated with audit system):

```javascript
// Automatically logged:
// - Which credentials were accessed
// - By which agent/service
// - At what time
// - Success/failure status
```

### Environment Isolation

Different credentials for each environment:

```javascript
// Development
const devKey = plugin.getCredential('DEV_HERMES_API_KEY');

// Production
const prodKey = plugin.getCredential('PROD_HERMES_API_KEY');
```

---

## Examples

### Example 1: Initialize and Check Status

```javascript
const plugin = new AurigraphAgentsPlugin();

// Initialize environment
await plugin.initializeEnvironment({
  environment: 'development',
  verbose: true
});

// Check status
const status = plugin.getEnvironmentStatus();
console.log('Environment loaded:', status.loaded);
console.log('Files:', status.filesLoaded);
console.log('Credentials:', status.credentialsAvailable);

// Get context
const context = plugin.getContextFileContent('CONTEXT.md');
console.log('Project context available:', !!context);
```

### Example 2: Access Credentials Safely

```javascript
const plugin = new AurigraphAgentsPlugin();
await plugin.initializeEnvironment();

// Check for credential
if (plugin.hasCredential('HERMES_API_KEY')) {
  // Use redacted credential for logging
  console.log('Using API key:', plugin.getCredential('HERMES_API_KEY'));

  // Use actual credential internally
  const apiKey = plugin.getCredential('HERMES_API_KEY', false);
  // ... use apiKey for API calls
}
```

### Example 3: Load Strategy Context

```javascript
const plugin = new AurigraphAgentsPlugin();
await plugin.initializeEnvironment();

// Get strategy builder specification
const strategyContext = plugin.getContextFileContent('CONTEXT.md');

// Parse project context
if (strategyContext) {
  const lines = strategyContext.split('\n');
  const strategySection = lines.find(line =>
    line.includes('Strategy Builder')
  );

  console.log('Strategy info available:', !!strategySection);
}
```

### Example 4: Export Environment for Debugging

```javascript
const plugin = new AurigraphAgentsPlugin();
await plugin.initializeEnvironment({ verbose: true });

// Export state for debugging
const state = plugin.exportEnvironmentState('debug-state.json');

console.log('Environment state exported');
console.log('Files loaded:', state.filesLoaded);
console.log('Context files:', state.contextFilesLoaded);
```

---

## Troubleshooting

### Issue: "Environment not initialized"

**Problem:** Trying to access context before calling `initializeEnvironment()`

**Solution:**
```javascript
// Wrong
const context = plugin.getProjectContext(); // Throws error

// Correct
await plugin.initializeEnvironment();
const context = plugin.getProjectContext(); // Works
```

### Issue: "No credentials loaded"

**Problem:** credentials.md file not found or empty

**Solution:**
```bash
# Create credentials file
cp credentials.md.template credentials.md

# Edit and fill with actual credentials
nano credentials.md

# Verify file exists
ls -la credentials.md
```

### Issue: "Permission denied reading credentials"

**Problem:** File permissions too restrictive

**Solution:**
```bash
# Make credentials readable
chmod 600 credentials.md

# Check permissions
ls -la credentials.md
```

### Issue: "Context files not loading"

**Problem:** Project root path incorrect

**Solution:**
```javascript
// Specify correct project root
await plugin.initializeEnvironment({
  projectRoot: '/path/to/aurigraph-agents-staging',
  verbose: true // Use verbose to see what's loading
});
```

---

## Best Practices

### ✅ DO:

- Always initialize environment at startup
- Check `isEnvironmentLoaded()` before accessing context
- Use redacted credentials for logging
- Rotate credentials regularly
- Store credentials in secure file
- Use environment-specific credentials
- Export state for debugging issues

### ❌ DON'T:

- Commit credentials.md to version control
- Log actual credential values
- Share credentials across environments
- Store credentials in code
- Use same credentials for multiple services
- Ignore initialization errors
- Leave credentials.md world-readable

---

## Integration with Agents

### Using Context in Agent Tasks

```javascript
class DevOpsAgent {
  async deploy(options) {
    // Get environment context
    const context = this.plugin.getProjectContext();

    // Access project information
    const deploySpec = this.plugin.getContextFileContent('CONTEXT.md');

    // Get API credentials
    const apiKey = this.plugin.getCredential('HERMES_API_KEY', false);

    // Perform deployment with full context
    return this.hermes.deploy(options, {
      context: deploySpec,
      apiKey: apiKey
    });
  }
}
```

### Checking Credentials Before Operations

```javascript
class TraderAgent {
  async executeStrategy(strategyId) {
    // Verify all required credentials exist
    const required = ['BINANCE_API_KEY', 'BINANCE_API_SECRET'];
    const missing = required.filter(k => !this.plugin.hasCredential(k));

    if (missing.length > 0) {
      throw new Error(`Missing credentials: ${missing.join(', ')}`);
    }

    // Proceed with strategy execution
  }
}
```

---

## Performance Considerations

### Loading Performance

- Initial load: ~50-100ms
- File I/O for 40+ files
- In-memory caching for all files
- Credential parsing: ~10-20ms

### Memory Usage

- Base memory: ~2MB
- Per file: ~100KB average
- Credentials: ~500KB maximum
- Total typical: ~5-10MB

### Optimization Tips

- Call `initializeEnvironment()` once at startup
- Cache context files in agent memory
- Use `isEnvironmentLoaded()` to avoid repeated checks
- Clear cache if credentials are rotated

---

## Monitoring and Logging

### Enable Debug Logging

```javascript
await plugin.initializeEnvironment({
  environment: 'development',
  verbose: true // Shows detailed loading information
});
```

### Access Load Summary

```javascript
const status = plugin.getEnvironmentStatus();
console.log(`
Environment Status:
- Loaded: ${status.loaded}
- Environment: ${status.environment}
- Files: ${status.filesLoaded}
- Credentials: ${status.credentialsAvailable}
- Context: ${status.contextAvailable}
`);
```

---

## Version Information

| Component | Version | Status |
|-----------|---------|--------|
| Environment Loader | 1.0.0 | ✅ Production Ready |
| Plugin Integration | 1.0.0 | ✅ Production Ready |
| Credentials Support | 1.0.0 | ✅ Production Ready |
| CLI Tools | 1.0.0 | ✅ Production Ready |

---

## Support

For issues or questions about environment loading:

- **Documentation**: See this file
- **Template File**: credentials.md.template
- **Email**: agents@aurigraph.io
- **Slack**: #aurigraph-agents

---

**Last Updated**: 2025-10-23
**Maintained By**: Aurigraph Development Team
**License**: Proprietary

