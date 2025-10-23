/**
 * Credentials Loader Tests
 * Unit and integration tests for the CredentialsLoader class
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const CredentialsLoader = require('./credentials-loader');

describe('CredentialsLoader', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear all Aurigraph-related variables
    delete process.env.JIRA_API_KEY;
    delete process.env.JIRA_EMAIL;
    delete process.env.GITHUB_TOKEN;
    delete process.env.DOCKER_REGISTRY_USERNAME;
    delete process.env.DOCKER_REGISTRY_PASSWORD;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_SIGNING_SECRET;
    delete process.env.MONGODB_URI;
    delete process.env.JWT_SECRET;
    delete process.env.ENCRYPTION_KEY;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Initialization', () => {
    test('should create loader with default options', () => {
      const loader = new CredentialsLoader();
      expect(loader).toBeDefined();
      expect(loader.credentials).toEqual({});
      expect(loader.missingCredentials).toEqual([]);
    });

    test('should accept verbose option', () => {
      const loader = new CredentialsLoader({ verbose: true });
      expect(loader.verbose).toBe(true);
    });

    test('should detect environment correctly', () => {
      process.env.NODE_ENV = 'production';
      const loader = new CredentialsLoader();
      expect(loader.environment).toBe('production');
    });
  });

  describe('JIRA Credentials', () => {
    test('should load JIRA credentials when both variables set', () => {
      process.env.JIRA_API_KEY = 'test_token_123';
      process.env.JIRA_EMAIL = 'test@example.com';

      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.jira.apiKey).toBe('test_token_123');
      expect(creds.jira.email).toBe('test@example.com');
      expect(creds.jira.configured).toBe(true);
    });

    test('should use default JIRA URL when not provided', () => {
      process.env.JIRA_API_KEY = 'test_token';
      process.env.JIRA_EMAIL = 'test@example.com';

      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.jira.baseUrl).toBe('https://aurigraph.atlassian.net');
    });

    test('should use custom JIRA URL when provided', () => {
      process.env.JIRA_API_KEY = 'test_token';
      process.env.JIRA_EMAIL = 'test@example.com';
      process.env.JIRA_BASE_URL = 'https://custom.atlassian.net';

      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.jira.baseUrl).toBe('https://custom.atlassian.net');
    });

    test('should mark JIRA as not configured when missing variables', () => {
      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.jira.configured).toBe(false);
      expect(creds.jira.apiKey).toBeNull();
      expect(creds.jira.email).toBeNull();
    });

    test('should add JIRA to missing credentials when incomplete', () => {
      const loader = new CredentialsLoader();
      loader.load();

      const missing = loader.getMissingCredentials();
      expect(missing.some(m => m.service === 'JIRA')).toBe(true);
    });
  });

  describe('GitHub Credentials', () => {
    test('should load GitHub credentials when token provided', () => {
      process.env.GITHUB_TOKEN = 'ghp_test123';

      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.github.token).toBe('ghp_test123');
      expect(creds.github.configured).toBe(true);
    });

    test('should use default GitHub API URL', () => {
      process.env.GITHUB_TOKEN = 'ghp_test123';

      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.github.apiUrl).toBe('https://api.github.com');
    });

    test('should mark GitHub as not configured when token missing', () => {
      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.github.configured).toBe(false);
      expect(creds.github.token).toBeNull();
    });
  });

  describe('Docker Credentials', () => {
    test('should load Docker registry credentials when provided', () => {
      process.env.DOCKER_REGISTRY_USERNAME = 'dockeruser';
      process.env.DOCKER_REGISTRY_PASSWORD = 'dockerpass';

      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.docker.registryUsername).toBe('dockeruser');
      expect(creds.docker.registryPassword).toBe('dockerpass');
      expect(creds.docker.configured).toBe(true);
    });

    test('should use default Docker host and registry', () => {
      process.env.DOCKER_REGISTRY_USERNAME = 'user';
      process.env.DOCKER_REGISTRY_PASSWORD = 'pass';

      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.docker.host).toBe('unix:///var/run/docker.sock');
      expect(creds.docker.registryUrl).toBe('docker.io');
    });

    test('should use custom Docker host when provided', () => {
      process.env.DOCKER_HOST = 'tcp://localhost:2375';
      process.env.DOCKER_REGISTRY_USERNAME = 'user';
      process.env.DOCKER_REGISTRY_PASSWORD = 'pass';

      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.docker.host).toBe('tcp://localhost:2375');
    });
  });

  describe('AWS Credentials', () => {
    test('should load AWS credentials when provided', () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIA...';
      process.env.AWS_SECRET_ACCESS_KEY = 'secret...';

      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.aws.accessKeyId).toBe('AKIA...');
      expect(creds.aws.secretAccessKey).toBe('secret...');
      expect(creds.aws.configured).toBe(true);
    });

    test('should use default AWS region', () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIA...';
      process.env.AWS_SECRET_ACCESS_KEY = 'secret...';

      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.aws.region).toBe('us-east-1');
    });

    test('should use custom AWS region when provided', () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIA...';
      process.env.AWS_SECRET_ACCESS_KEY = 'secret...';
      process.env.AWS_REGION = 'eu-west-1';

      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.aws.region).toBe('eu-west-1');
    });
  });

  describe('Slack Credentials', () => {
    test('should load Slack credentials when provided', () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-...';
      process.env.SLACK_SIGNING_SECRET = 'secret...';

      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.slack.botToken).toBe('xoxb-...');
      expect(creds.slack.signingSecret).toBe('secret...');
      expect(creds.slack.configured).toBe(true);
    });

    test('should mark Slack as not configured when missing secrets', () => {
      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.slack.configured).toBe(false);
    });
  });

  describe('Database Credentials', () => {
    test('should load MongoDB URI when provided', () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/aurigraph';

      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.database.mongoUri).toBe('mongodb://localhost:27017/aurigraph');
      expect(creds.database.configured).toBe(true);
    });

    test('should load MongoDB Atlas URI', () => {
      process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/aurigraph';

      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.database.mongoUri).toContain('mongodb+srv://');
      expect(creds.database.configured).toBe(true);
    });

    test('should load MongoDB credentials separately', () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/aurigraph';
      process.env.MONGODB_USER = 'testuser';
      process.env.MONGODB_PASSWORD = 'testpass';

      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.database.user).toBe('testuser');
      expect(creds.database.password).toBe('testpass');
    });
  });

  describe('Security Credentials', () => {
    test('should load JWT secret when provided', () => {
      process.env.JWT_SECRET = 'test_secret_key';

      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.security.jwtSecret).toBe('test_secret_key');
    });

    test('should load encryption key when provided', () => {
      process.env.ENCRYPTION_KEY = 'test_encryption_key';

      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds.security.encryptionKey).toBe('test_encryption_key');
    });

    test('should warn when JWT secret missing', () => {
      const loader = new CredentialsLoader();
      loader.load();

      expect(loader.getWarnings().some(w => w.includes('JWT_SECRET'))).toBe(true);
    });

    test('should warn when encryption key missing', () => {
      const loader = new CredentialsLoader();
      loader.load();

      expect(loader.getWarnings().some(w => w.includes('ENCRYPTION_KEY'))).toBe(true);
    });
  });

  describe('Service Management', () => {
    test('should get specific service credentials', () => {
      process.env.JIRA_API_KEY = 'token';
      process.env.JIRA_EMAIL = 'test@test.com';

      const loader = new CredentialsLoader();
      loader.load();

      const jira = loader.getCredentials('jira');
      expect(jira.apiKey).toBe('token');
    });

    test('should throw error for unknown service', () => {
      const loader = new CredentialsLoader();
      loader.load();

      expect(() => loader.getCredentials('unknown')).toThrow();
    });

    test('should check if service is configured', () => {
      process.env.JIRA_API_KEY = 'token';
      process.env.JIRA_EMAIL = 'test@test.com';

      const loader = new CredentialsLoader();
      loader.load();

      expect(loader.isConfigured('jira')).toBe(true);
      expect(loader.isConfigured('github')).toBe(false);
    });

    test('should list configured services', () => {
      process.env.JIRA_API_KEY = 'token';
      process.env.JIRA_EMAIL = 'test@test.com';
      process.env.GITHUB_TOKEN = 'ghp_test';

      const loader = new CredentialsLoader();
      loader.load();

      const services = loader.getConfiguredServices();
      expect(services).toContain('jira');
      expect(services).toContain('github');
      expect(services.length).toBeGreaterThan(0);
    });
  });

  describe('Error Reporting', () => {
    test('should track missing credentials', () => {
      const loader = new CredentialsLoader();
      loader.load();

      const missing = loader.getMissingCredentials();
      expect(Array.isArray(missing)).toBe(true);
      expect(missing.length).toBeGreaterThan(0);
    });

    test('should provide warnings for optional services', () => {
      const loader = new CredentialsLoader();
      loader.load();

      const warnings = loader.getWarnings();
      expect(Array.isArray(warnings)).toBe(true);
      expect(warnings.length).toBeGreaterThan(0);
    });

    test('should have minimal warnings when all credentials set', () => {
      process.env.JIRA_API_KEY = 'token';
      process.env.JIRA_EMAIL = 'test@test.com';
      process.env.GITHUB_TOKEN = 'ghp_test';
      process.env.JWT_SECRET = 'secret';
      process.env.ENCRYPTION_KEY = 'key';
      process.env.DOCKER_REGISTRY_USERNAME = 'user';
      process.env.DOCKER_REGISTRY_PASSWORD = 'pass';
      process.env.SLACK_BOT_TOKEN = 'xoxb_test';
      process.env.SLACK_SIGNING_SECRET = 'secret';

      const loader = new CredentialsLoader();
      loader.load();

      const warnings = loader.getWarnings();
      expect(warnings.length).toBe(0);
    });
  });

  describe('Credential Validation', () => {
    test('should validate all credentials on load', () => {
      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(creds).toBeDefined();
      expect(creds.jira).toBeDefined();
      expect(creds.github).toBeDefined();
      expect(creds.docker).toBeDefined();
      expect(creds.aws).toBeDefined();
      expect(creds.slack).toBeDefined();
      expect(creds.database).toBeDefined();
      expect(creds.security).toBeDefined();
    });

    test('should have configured flag for all services', () => {
      const loader = new CredentialsLoader();
      const creds = loader.load();

      Object.keys(creds).forEach(service => {
        if (service !== 'security') { // security doesn't have configured flag
          expect(creds[service]).toHaveProperty('configured');
          expect(typeof creds[service].configured).toBe('boolean');
        }
      });
    });
  });

  describe('Report Generation', () => {
    test('should provide meaningful report', () => {
      process.env.JIRA_API_KEY = 'token';
      process.env.JIRA_EMAIL = 'test@test.com';

      const loader = new CredentialsLoader({ verbose: true });
      loader.load();

      // Verify report methods exist
      expect(typeof loader.printReport).toBe('function');
      expect(loader.getMissingCredentials).toBeDefined();
      expect(loader.getWarnings).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    test('should handle real-world scenario: partial credentials', () => {
      // Typical development setup
      process.env.JIRA_API_KEY = 'dev_token';
      process.env.JIRA_EMAIL = 'dev@aurigraph.io';
      process.env.GITHUB_TOKEN = 'ghp_dev';
      process.env.NODE_ENV = 'development';

      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(loader.isConfigured('jira')).toBe(true);
      expect(loader.isConfigured('github')).toBe(true);
      expect(loader.isConfigured('docker')).toBe(false);

      const configuredServices = loader.getConfiguredServices();
      expect(configuredServices.length).toBe(2);
    });

    test('should handle real-world scenario: production setup', () => {
      // Full production setup
      process.env.JIRA_API_KEY = 'prod_token';
      process.env.JIRA_EMAIL = 'prod@aurigraph.io';
      process.env.GITHUB_TOKEN = 'ghp_prod';
      process.env.DOCKER_REGISTRY_USERNAME = 'produser';
      process.env.DOCKER_REGISTRY_PASSWORD = 'prodpass';
      process.env.AWS_ACCESS_KEY_ID = 'AKIA_prod';
      process.env.AWS_SECRET_ACCESS_KEY = 'secret_prod';
      process.env.JWT_SECRET = 'jwt_prod_secret';
      process.env.ENCRYPTION_KEY = 'enc_prod_key';
      process.env.MONGODB_URI = 'mongodb+srv://prod:prod@prod.mongodb.net/aurigraph';
      process.env.NODE_ENV = 'production';

      const loader = new CredentialsLoader();
      const creds = loader.load();

      expect(loader.getConfiguredServices().length).toBeGreaterThan(5);
      expect(loader.getWarnings().length).toBe(0);
    });
  });
});

// Run with: npm test -- credentials-loader.test.js
