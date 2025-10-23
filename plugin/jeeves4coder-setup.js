#!/usr/bin/env node

/**
 * Jeeves4Coder - Project Setup & Infrastructure Builder
 * Automatically creates project structure, SPARC framework, and deployment infrastructure
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

class Jeeves4CoderSetup {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.config = {
      projectName: '',
      projectPath: '',
      githubRepo: '',
      githubToken: '',
      jiraUrl: '',
      jiraToken: '',
      deploymentEnv: 'aws',
      sshKeyPath: '',
      architecture: {},
      sparc: {
        phase: 'specification',
        status: 'in-progress'
      }
    };

    this.colors = {
      reset: '\x1b[0m',
      green: '\x1b[32m',
      blue: '\x1b[36m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      bold: '\x1b[1m'
    };
  }

  /**
   * Main setup flow
   */
  async run() {
    console.log(this.colors.bold + this.colors.blue + '\n🎩 Jeeves4Coder Project Setup\n' + this.colors.reset);

    try {
      // Step 1: Gather project information
      await this.gatherProjectInfo();

      // Step 2: Create project structure
      await this.createProjectStructure();

      // Step 3: Initialize SPARC framework
      await this.initializeSPARC();

      // Step 4: Setup GitHub integration
      await this.setupGithub();

      // Step 5: Setup JIRA integration
      await this.setupJira();

      // Step 6: Setup SSH & Deployment
      await this.setupDeployment();

      // Step 7: Create project documentation
      await this.createDocumentation();

      // Step 8: Final summary
      this.printSummary();

    } catch (error) {
      console.error(this.colors.red + 'Setup failed: ' + error.message + this.colors.reset);
      process.exit(1);
    }

    this.rl.close();
  }

  /**
   * Gather project information from user
   */
  async gatherProjectInfo() {
    console.log(this.colors.bold + '📋 Project Information' + this.colors.reset);

    this.config.projectName = await this.question('Project name: ');
    this.config.projectPath = await this.question('Project path (default: ./): ') || './';
    this.config.githubRepo = await this.question('GitHub repository URL: ');
    this.config.githubToken = await this.question('GitHub personal access token: ');
    this.config.jiraUrl = await this.question('JIRA instance URL: ');
    this.config.jiraToken = await this.question('JIRA API token: ');

    console.log(this.colors.green + '✓ Project information gathered\n' + this.colors.reset);
  }

  /**
   * Create project directory structure
   */
  async createProjectStructure() {
    console.log(this.colors.bold + '📁 Creating Project Structure' + this.colors.reset);

    const directories = [
      'src',
      'src/components',
      'src/services',
      'src/utils',
      'src/styles',
      'tests',
      'tests/unit',
      'tests/integration',
      'docs',
      'docs/architecture',
      'docs/api',
      'config',
      'deploy',
      'deploy/aws',
      'deploy/docker',
      '.github',
      '.github/workflows',
      '.ssh',
      'prd',
      'sparc'
    ];

    directories.forEach(dir => {
      const fullPath = path.join(this.config.projectPath, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(this.colors.green + '  ✓ ' + dir + this.colors.reset);
      }
    });

    console.log(this.colors.green + '✓ Project structure created\n' + this.colors.reset);
  }

  /**
   * Initialize SPARC framework
   */
  async initializeSPARC() {
    console.log(this.colors.bold + '🏗️  Initializing SPARC Framework' + this.colors.reset);

    const sparcPath = path.join(this.config.projectPath, 'sparc');

    // Phase 1: Specification
    const specFile = path.join(sparcPath, 'PHASE_1_SPECIFICATION.md');
    fs.writeFileSync(specFile, this.generateSpecification());
    console.log(this.colors.green + '  ✓ Phase 1: Specification' + this.colors.reset);

    // Phase 2: Pseudocode (placeholder)
    const pseudoFile = path.join(sparcPath, 'PHASE_2_PSEUDOCODE.md');
    fs.writeFileSync(pseudoFile, this.generatePseudocode());
    console.log(this.colors.green + '  ✓ Phase 2: Pseudocode (placeholder)' + this.colors.reset);

    // Phase 3: Architecture (placeholder)
    const archFile = path.join(sparcPath, 'PHASE_3_ARCHITECTURE.md');
    fs.writeFileSync(archFile, this.generateArchitecture());
    console.log(this.colors.green + '  ✓ Phase 3: Architecture (placeholder)' + this.colors.reset);

    // SPARC Progress tracker
    const sparceProgFile = path.join(sparcPath, 'PROGRESS.md');
    fs.writeFileSync(sparceProgFile, this.generateSPARCProgress());
    console.log(this.colors.green + '  ✓ SPARC Progress tracker' + this.colors.reset);

    console.log(this.colors.green + '✓ SPARC framework initialized\n' + this.colors.reset);
  }

  /**
   * Setup GitHub integration
   */
  async setupGithub() {
    console.log(this.colors.bold + '🐙 Setting Up GitHub Integration' + this.colors.reset);

    // Create GitHub workflows
    const workflowPath = path.join(this.config.projectPath, '.github/workflows');

    // CI/CD Pipeline
    const cicdFile = path.join(workflowPath, 'ci-cd.yml');
    fs.writeFileSync(cicdFile, this.generateGithubWorkflow());
    console.log(this.colors.green + '  ✓ CI/CD workflow' + this.colors.reset);

    // Code review workflow
    const reviewFile = path.join(workflowPath, 'code-review.yml');
    fs.writeFileSync(reviewFile, this.generateCodeReviewWorkflow());
    console.log(this.colors.green + '  ✓ Code review workflow' + this.colors.reset);

    // Create .gitignore
    const gitignorePath = path.join(this.config.projectPath, '.gitignore');
    fs.writeFileSync(gitignorePath, this.generateGitignore());
    console.log(this.colors.green + '  ✓ .gitignore file' + this.colors.reset);

    // Create GitHub Actions secrets template
    const secretsFile = path.join(this.config.projectPath, 'docs/GITHUB_SECRETS.md');
    fs.writeFileSync(secretsFile, this.generateGithubSecrets());
    console.log(this.colors.green + '  ✓ GitHub Secrets configuration' + this.colors.reset);

    console.log(this.colors.green + '✓ GitHub integration setup\n' + this.colors.reset);
  }

  /**
   * Setup JIRA integration
   */
  async setupJira() {
    console.log(this.colors.bold + '🔗 Setting Up JIRA Integration' + this.colors.reset);

    // Create JIRA configuration
    const jiraConfig = path.join(this.config.projectPath, 'config/jira.config.json');
    fs.writeFileSync(jiraConfig, this.generateJiraConfig());
    console.log(this.colors.green + '  ✓ JIRA configuration' + this.colors.reset);

    // Create JIRA automation workflows
    const jiraWorkflows = path.join(this.config.projectPath, 'docs/JIRA_WORKFLOWS.md');
    fs.writeFileSync(jiraWorkflows, this.generateJiraWorkflows());
    console.log(this.colors.green + '  ✓ JIRA workflow automation' + this.colors.reset);

    // Create issue templates
    const issueTemplate = path.join(this.config.projectPath, '.github/ISSUE_TEMPLATE');
    if (!fs.existsSync(issueTemplate)) {
      fs.mkdirSync(issueTemplate, { recursive: true });
    }
    fs.writeFileSync(path.join(issueTemplate, 'feature.md'), this.generateIssueTemplate('feature'));
    fs.writeFileSync(path.join(issueTemplate, 'bug.md'), this.generateIssueTemplate('bug'));
    console.log(this.colors.green + '  ✓ Issue templates' + this.colors.reset);

    console.log(this.colors.green + '✓ JIRA integration setup\n' + this.colors.reset);
  }

  /**
   * Setup SSH & Deployment infrastructure
   */
  async setupDeployment() {
    console.log(this.colors.bold + '🚀 Setting Up SSH & Deployment' + this.colors.reset);

    // Create SSH key placeholder
    const sshPath = path.join(this.config.projectPath, '.ssh');
    const sshKeysFile = path.join(sshPath, 'SSH_SETUP.md');
    fs.writeFileSync(sshKeysFile, this.generateSSHSetup());
    console.log(this.colors.green + '  ✓ SSH setup guide' + this.colors.reset);

    // Create deployment configurations
    const deployPath = path.join(this.config.projectPath, 'deploy');

    // AWS deployment
    const awsConfig = path.join(deployPath, 'aws/aws-deployment.yml');
    fs.writeFileSync(awsConfig, this.generateAWSDeployment());
    console.log(this.colors.green + '  ✓ AWS deployment configuration' + this.colors.reset);

    // Docker configuration
    const dockerfile = path.join(deployPath, 'docker/Dockerfile');
    fs.writeFileSync(dockerfile, this.generateDockerfile());
    const dockerCompose = path.join(deployPath, 'docker/docker-compose.yml');
    fs.writeFileSync(dockerCompose, this.generateDockerCompose());
    console.log(this.colors.green + '  ✓ Docker configuration' + this.colors.reset);

    // Environment files
    const envTemplate = path.join(this.config.projectPath, '.env.example');
    fs.writeFileSync(envTemplate, this.generateEnvTemplate());
    console.log(this.colors.green + '  ✓ Environment configuration template' + this.colors.reset);

    console.log(this.colors.green + '✓ Deployment infrastructure setup\n' + this.colors.reset);
  }

  /**
   * Create project documentation
   */
  async createDocumentation() {
    console.log(this.colors.bold + '📚 Creating Project Documentation' + this.colors.reset);

    const docsPath = path.join(this.config.projectPath, 'docs');

    // README
    const readme = path.join(this.config.projectPath, 'README.md');
    fs.writeFileSync(readme, this.generateREADME());
    console.log(this.colors.green + '  ✓ README.md' + this.colors.reset);

    // ARCHITECTURE.md
    const archDoc = path.join(docsPath, 'ARCHITECTURE.md');
    fs.writeFileSync(archDoc, this.generateArchitectureDoc());
    console.log(this.colors.green + '  ✓ Architecture documentation' + this.colors.reset);

    // DEVELOPMENT.md
    const devDoc = path.join(docsPath, 'DEVELOPMENT.md');
    fs.writeFileSync(devDoc, this.generateDevelopmentGuide());
    console.log(this.colors.green + '  ✓ Development guide' + this.colors.reset);

    // DEPLOYMENT.md
    const deployDoc = path.join(docsPath, 'DEPLOYMENT.md');
    fs.writeFileSync(deployDoc, this.generateDeploymentGuide());
    console.log(this.colors.green + '  ✓ Deployment guide' + this.colors.reset);

    // Context file
    const context = path.join(this.config.projectPath, 'CONTEXT.md');
    fs.writeFileSync(context, this.generateContext());
    console.log(this.colors.green + '  ✓ Project context' + this.colors.reset);

    console.log(this.colors.green + '✓ Project documentation created\n' + this.colors.reset);
  }

  /**
   * Print setup summary
   */
  printSummary() {
    console.log(this.colors.bold + '✅ Setup Complete!\n' + this.colors.reset);
    console.log(this.colors.blue + 'Project: ' + this.config.projectName + this.colors.reset);
    console.log(this.colors.blue + 'Path: ' + this.config.projectPath + this.colors.reset);
    console.log(this.colors.blue + 'GitHub: ' + this.config.githubRepo + this.colors.reset);
    console.log(this.colors.blue + 'JIRA: ' + this.config.jiraUrl + this.colors.reset);

    console.log('\n' + this.colors.bold + 'Next Steps:' + this.colors.reset);
    console.log('1. Review SPARC framework in sparc/ directory');
    console.log('2. Configure GitHub secrets (see docs/GITHUB_SECRETS.md)');
    console.log('3. Configure JIRA integration (see docs/JIRA_WORKFLOWS.md)');
    console.log('4. Setup SSH keys (see .ssh/SSH_SETUP.md)');
    console.log('5. Review deployment configuration (see docs/DEPLOYMENT.md)');
    console.log('6. Initialize git repository and push to GitHub');
    console.log('7. Start implementation from PRD and Architecture documents\n');

    console.log(this.colors.green + '🎩 Ready to start development with Jeeves4Coder!' + this.colors.reset);
  }

  /**
   * Utility: Ask question via readline
   */
  question(query) {
    return new Promise(resolve => {
      this.rl.question(query, resolve);
    });
  }

  // ============================================================================
  // Template Generators
  // ============================================================================

  generateSpecification() {
    return `# Phase 1: Specification - ${this.config.projectName}

## Project Overview
${this.config.projectName} is a comprehensive project designed to [PROJECT_DESCRIPTION].

## Features
- [ ] Feature 1
- [ ] Feature 2
- [ ] Feature 3

## Requirements
### Functional Requirements
- User authentication and authorization
- Data management and persistence
- API endpoints for all operations
- Real-time updates and notifications

### Non-Functional Requirements
- Performance: < 100ms response time
- Scalability: Support 10,000 concurrent users
- Security: OWASP Top 10 compliance
- Availability: 99.9% uptime

## Technology Stack
- Frontend: React/TypeScript
- Backend: Node.js/Express or Python/FastAPI
- Database: PostgreSQL/MongoDB
- Deployment: Docker/Kubernetes
- Cloud: AWS/GCP/Azure

## Timeline
- Phase 1 (Specification): 1 week
- Phase 2 (Pseudocode): 1-2 weeks
- Phase 3 (Architecture): 1-2 weeks
- Phase 4 (Refinement): 1 week
- Phase 5 (Implementation): 4-6 weeks

## Success Criteria
- [ ] All requirements met
- [ ] 80%+ code coverage
- [ ] Performance targets achieved
- [ ] Security audit passed
- [ ] Documentation complete
`;
  }

  generatePseudocode() {
    return `# Phase 2: Pseudocode - ${this.config.projectName}

## Algorithm Overview
This document contains pseudocode for core algorithms and flows.

## Main Flows
### User Authentication Flow
\`\`\`
1. User enters credentials
2. Validate input
3. Query database for user
4. Hash password and compare
5. Generate JWT token
6. Return token to client
\`\`\`

### Data Processing Flow
\`\`\`
1. Receive data from client
2. Validate data format
3. Check permissions
4. Process data
5. Store in database
6. Return confirmation
\`\`\`

## Implementation Notes
- [Add specific algorithms]
- [Add validation rules]
- [Add error handling]
`;
  }

  generateArchitecture() {
    return `# Phase 3: Architecture - ${this.config.projectName}

## System Architecture

### C4 Model
#### Context Diagram
- User/Client
- System
- External Services

#### Container Diagram
- Web Application
- API Server
- Database
- Cache

#### Component Diagram
- Controllers
- Services
- Repositories
- Utilities

## Design Patterns
- MVC/MVVM for application structure
- Factory pattern for object creation
- Observer pattern for events
- Strategy pattern for algorithms

## Database Schema
### Users Table
- id (UUID)
- email (string)
- password_hash (string)
- created_at (timestamp)
- updated_at (timestamp)

## API Endpoints
\`\`\`
GET /api/users - Get all users
POST /api/users - Create user
PUT /api/users/:id - Update user
DELETE /api/users/:id - Delete user
\`\`\`

## Deployment Architecture
- Load Balancer
- API Servers (auto-scaling)
- Database
- Cache Layer
- CDN
`;
  }

  generateSPARCProgress() {
    return `# SPARC Framework Progress

## Phase 1: Specification
- Status: IN_PROGRESS
- Due: [DATE]
- Tasks:
  - [ ] Gather requirements
  - [ ] Write specification
  - [ ] Review with stakeholders

## Phase 2: Pseudocode
- Status: PENDING
- Due: [DATE]
- Tasks:
  - [ ] Write algorithms
  - [ ] Document flows
  - [ ] Code review

## Phase 3: Architecture
- Status: PENDING
- Due: [DATE]
- Tasks:
  - [ ] Design system architecture
  - [ ] Create database schema
  - [ ] Design API

## Phase 4: Refinement
- Status: PENDING
- Due: [DATE]
- Tasks:
  - [ ] Performance optimization
  - [ ] Security hardening
  - [ ] Testing strategy

## Phase 5: Implementation
- Status: PENDING
- Due: [DATE]
- Tasks:
  - [ ] Develop core features
  - [ ] Write tests
  - [ ] Deploy to production
`;
  }

  generateGithubWorkflow() {
    return `name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Deploy
        if: github.ref == 'refs/heads/main'
        run: npm run deploy
        env:
          DEPLOY_KEY: \${{ secrets.DEPLOY_KEY }}
`;
  }

  generateCodeReviewWorkflow() {
    return `name: Code Review

on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Jeeves4Coder Review
        run: |
          npm install @aurigraph/jeeves4coder-plugin
          node -e "
            const Jeeves4Coder = require('@aurigraph/jeeves4coder-plugin');
            const plugin = new Jeeves4Coder();
            // Review code changes
          "
`;
  }

  generateGitignore() {
    return `# Dependencies
node_modules/
package-lock.json
yarn.lock

# Environment
.env
.env.local
.env.*.local

# Build outputs
dist/
build/
.next/
.nuxt/
out/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*

# SSH
.ssh/*
!.ssh/SSH_SETUP.md

# Secrets
credentials.json
.pem
`;
  }

  generateGithubSecrets() {
    return `# GitHub Secrets Configuration

Add the following secrets to your GitHub repository settings:

## Required Secrets
- DEPLOY_KEY: SSH private key for deployment
- DOCKER_USERNAME: Docker Hub username
- DOCKER_PASSWORD: Docker Hub password
- AWS_ACCESS_KEY_ID: AWS access key
- AWS_SECRET_ACCESS_KEY: AWS secret key
- JIRA_API_TOKEN: JIRA API token
- SLACK_WEBHOOK: Slack webhook for notifications

## Setup Steps
1. Go to Settings > Secrets and variables > Actions
2. Click "New repository secret"
3. Add each secret with its value
4. Reference in workflows: \${{ secrets.SECRET_NAME }}
`;
  }

  generateJiraConfig() {
    return JSON.stringify({
      host: this.config.jiraUrl,
      username: 'jira-bot@company.com',
      apiToken: 'YOUR_JIRA_API_TOKEN',
      projects: [{
        name: this.config.projectName,
        key: this.config.projectName.substring(0, 3).toUpperCase(),
        template: 'software'
      }],
      workflows: {
        createIssueOnPR: true,
        syncLabels: true,
        autoCloseOnMerge: true
      }
    }, null, 2);
  }

  generateJiraWorkflows() {
    return `# JIRA Integration Workflows

## Automated Workflows

### PR to JIRA Issue
- Trigger: GitHub PR created
- Action: Create JIRA issue
- Fields: Title, Description, Epic Link

### Branch Naming Convention
- Format: \`[PROJECT]-[ISSUE_ID]-description\`
- Example: \`PROJ-123-add-user-authentication\`

### Commit Message Convention
- Format: \`[ISSUE-ID] Commit message\`
- Example: \`[PROJ-123] Add user authentication\`

### Auto Close Issue
- Trigger: PR merged
- Action: Close JIRA issue
- Comment: Link to merged PR
`;
  }

  generateIssueTemplate(type) {
    if (type === 'feature') {
      return `---
name: Feature Request
about: Suggest a new feature
title: '[FEATURE] '
labels: ['enhancement']
---

## Description
[Brief description of the feature]

## Use Case
[Why is this feature needed?]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Implementation Notes
[Any relevant implementation details]
`;
    } else {
      return `---
name: Bug Report
about: Report a bug
title: '[BUG] '
labels: ['bug']
---

## Description
[Brief description of the bug]

## Steps to Reproduce
1. [First step]
2. [Second step]
3. [Expected behavior]
4. [Actual behavior]

## Environment
- OS: [e.g., Ubuntu 20.04]
- Browser: [if applicable]
- Node.js version: [e.g., 18.0.0]

## Error Message
\`\`\`
[Paste error message or stack trace]
\`\`\`
`;
    }
  }

  generateSSHSetup() {
    return `# SSH Setup Guide

## Generating SSH Keys

### Step 1: Generate Key Pair
\`\`\`bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/${this.config.projectName}_deploy -C "deploy@${this.config.projectName}"
\`\`\`

### Step 2: Secure Private Key
\`\`\`bash
chmod 600 ~/.ssh/${this.config.projectName}_deploy
chmod 644 ~/.ssh/${this.config.projectName}_deploy.pub
\`\`\`

### Step 3: Add to GitHub
1. Go to GitHub Settings > Deploy keys
2. Paste contents of \`${this.config.projectName}_deploy.pub\`
3. Enable "Allow write access"

### Step 4: Add to GitHub Secrets
1. Go to Settings > Secrets
2. Create secret: \`DEPLOY_KEY\`
3. Paste contents of \`${this.config.projectName}_deploy\`

## Using in Workflows
\`\`\`yaml
- name: Deploy with SSH
  uses: webfactory/ssh-agent@v0.5.4
  with:
    ssh-private-key: \${{ secrets.DEPLOY_KEY }}

- name: Deploy
  run: |
    ssh-keyscan github.com >> ~/.ssh/known_hosts
    git clone git@github.com:org/repo.git
    # ... deployment commands
\`\`\`
`;
  }

  generateAWSDeployment() {
    return `# AWS Deployment Configuration

AWSTemplateFormatVersion: '2010-09-09'
Description: ${this.config.projectName} AWS Infrastructure

Resources:
  EC2Instance:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: ami-0c55b159cbfafe1f0
      InstanceType: t3.medium
      KeyName: ${this.config.projectName}
      SecurityGroups:
        - default
      Tags:
        - Key: Name
          Value: ${this.config.projectName}

  RDSDatabase:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: ${this.config.projectName}-db
      Engine: postgres
      DBInstanceClass: db.t3.micro
      AllocatedStorage: 20
      MasterUsername: admin
      MasterUserPassword: !Sub '{{resolve:secretsmanager:${this.config.projectName}/db:SecretString:password}}'

  S3Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: ${this.config.projectName}-bucket
      VersioningConfiguration:
        Status: Enabled
`;
  }

  generateDockerfile() {
    return `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
`;
  }

  generateDockerCompose() {
    return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://user:pass@db:5432/${this.config.projectName}
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=${this.config.projectName}
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
`;
  }

  generateEnvTemplate() {
    return `# Application
NODE_ENV=development
PORT=3000
PROJECT_NAME=${this.config.projectName}

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/${this.config.projectName}
DB_HOST=localhost
DB_PORT=5432
DB_USER=user
DB_PASSWORD=password

# GitHub
GITHUB_TOKEN=your_github_token
GITHUB_REPO=${this.config.githubRepo}

# JIRA
JIRA_URL=${this.config.jiraUrl}
JIRA_API_TOKEN=your_jira_token

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret

# Deployment
DEPLOY_ENV=staging
DEPLOY_KEY_PATH=.ssh/${this.config.projectName}_deploy
`;
  }

  generateREADME() {
    return `# ${this.config.projectName}

## Overview
[Project description]

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL or MongoDB
- Docker (optional)

### Installation
\`\`\`bash
npm install
cp .env.example .env
npm run dev
\`\`\`

### Database Setup
\`\`\`bash
npm run db:migrate
npm run db:seed
\`\`\`

## Development

### Project Structure
\`\`\`
src/
├── components/
├── services/
├── utils/
└── styles/
tests/
docs/
\`\`\`

### Available Scripts
- \`npm start\` - Start production server
- \`npm run dev\` - Start development server
- \`npm test\` - Run tests
- \`npm run build\` - Build for production
- \`npm run lint\` - Lint code
- \`npm run format\` - Format code

## Deployment

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for deployment instructions.

## Documentation
- [Architecture](docs/ARCHITECTURE.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [SPARC Framework](sparc/)

## Contributing
See [CONTRIBUTING.md](docs/CONTRIBUTING.md)

## License
Proprietary
`;
  }

  generateArchitectureDoc() {
    return `# Architecture - ${this.config.projectName}

## System Overview
[System architecture description]

## Components
- Frontend: React application
- Backend: API server
- Database: PostgreSQL
- Cache: Redis (optional)
- Message Queue: RabbitMQ (optional)

## Data Flow
[Describe how data flows through the system]

## Security Architecture
- Authentication: JWT
- Authorization: Role-based access control
- Encryption: AES-256 for sensitive data
- TLS 1.3 for transport security

## Scalability Considerations
- Horizontal scaling for API servers
- Database replication and clustering
- CDN for static assets
- Caching strategy

## Performance Targets
- API response time: < 100ms
- Page load time: < 2 seconds
- Database query time: < 50ms
`;
  }

  generateDevelopmentGuide() {
    return `# Development Guide - ${this.config.projectName}

## Code Standards
- Use TypeScript for type safety
- Follow ESLint configuration
- Write meaningful comments
- Keep functions small and focused

## Git Workflow
1. Create feature branch: \`git checkout -b feature/PROJ-123-description\`
2. Make commits with clear messages
3. Push to GitHub and create PR
4. Request code review
5. Merge after approval

## Testing
- Write unit tests for functions
- Integration tests for APIs
- E2E tests for user flows
- Target: 80%+ coverage

## Code Review Checklist
- [ ] Code follows standards
- [ ] Tests are included
- [ ] Documentation is updated
- [ ] No breaking changes
- [ ] Security implications considered
`;
  }

  generateDeploymentGuide() {
    return `# Deployment Guide - ${this.config.projectName}

## Deployment Environments
- Development: Local development
- Staging: Staging environment
- Production: Production environment

## Deployment Steps
1. Merge PR to main branch
2. CI/CD pipeline runs tests
3. Build Docker image
4. Push to registry
5. Deploy to AWS
6. Run smoke tests
7. Monitor logs

## Rollback Procedure
1. Identify issue
2. Revert to previous version
3. Deploy previous version
4. Verify stability
5. Investigate root cause

## Monitoring
- Application logs
- Performance metrics
- Error tracking
- Uptime monitoring
`;
  }

  generateContext() {
    return `# Project Context - ${this.config.projectName}

## Project Information
- Name: ${this.config.projectName}
- GitHub: ${this.config.githubRepo}
- JIRA: ${this.config.jiraUrl}
- Status: IN_PROGRESS

## Team
- Project Lead: [NAME]
- Lead Developer: [NAME]
- DevOps Engineer: [NAME]
- QA Engineer: [NAME]

## Key Dates
- Start Date: [DATE]
- MVP Target: [DATE]
- Final Release: [DATE]

## Success Metrics
- [ ] All features implemented
- [ ] 80%+ test coverage
- [ ] Performance targets met
- [ ] Zero critical security issues
- [ ] Production deployment

## Current Phase
- SPARC Phase: 1 (Specification)
- Status: IN_PROGRESS
- Next Milestone: Phase 2 (Pseudocode)
`;
  }
}

// ============================================================================
// Main Execution
// ============================================================================

if (require.main === module) {
  const setup = new Jeeves4CoderSetup();
  setup.run().catch(error => {
    console.error('Setup error:', error);
    process.exit(1);
  });
}

module.exports = Jeeves4CoderSetup;
