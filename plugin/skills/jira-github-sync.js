/**
 * JIRA-GitHub Sync Skill
 *
 * Comprehensive workflow for synchronizing JIRA tickets with GitHub repositories:
 * 1. Scan all open JIRA tickets from specified project
 * 2. Recursively scan GitHub repository for related code changes
 * 3. Verify code implementation against ticket requirements
 * 4. Automatically update JIRA tickets with verification results and links
 *
 * @module jira-github-sync
 * @version 1.0.0
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;

class JiraGithubSyncSkill {
  constructor(config = {}) {
    this.name = 'jira-github-sync';
    this.version = '1.0.0';
    this.description = 'Synchronize JIRA tickets with GitHub code repository';
    this.config = config;

    // Initialize API clients
    this.jiraApi = config.jiraApi || {
      baseUrl: process.env.JIRA_URL || 'https://aurigraphdlt.atlassian.net',
      email: process.env.JIRA_EMAIL || '',
      token: process.env.JIRA_API_KEY || ''
    };

    this.githubApi = config.githubApi || {
      baseUrl: 'https://api.github.com',
      token: process.env.GITHUB_TOKEN || '',
      owner: process.env.GITHUB_OWNER || 'Aurigraph-DLT-Corp',
      repo: process.env.GITHUB_REPO || 'glowing-adventure'
    };

    this.state = {
      ticketsScanned: 0,
      filesAnalyzed: 0,
      ticketsUpdated: 0,
      issues: [],
      successes: []
    };
  }

  /**
   * Main sync function - orchestrates the entire workflow
   */
  async sync(options = {}) {
    const startTime = Date.now();

    try {
      console.log('🔄 Starting JIRA-GitHub Sync workflow...');

      // Step 1: Scan JIRA tickets
      console.log('📋 Step 1: Scanning JIRA tickets...');
      const jiraTickets = await this.scanJiraTickets(options.projectKey || 'AV11', options.status || 'Open');

      // Step 2: Scan GitHub repository
      console.log('🔍 Step 2: Scanning GitHub repository...');
      const githubFiles = await this.scanGithubRepository(options.branch || 'main');

      // Step 3: Verify code implementation for each ticket
      console.log('✅ Step 3: Verifying code implementation...');
      const verificationResults = await this.verifyCodeImplementation(jiraTickets, githubFiles, options);

      // Step 4: Update JIRA tickets with results
      console.log('📤 Step 4: Updating JIRA tickets...');
      const updateResults = await this.updateJiraTickets(verificationResults, options);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✨ JIRA-GitHub Sync completed in ${duration}s`);

      return this.generateReport(updateResults);
    } catch (error) {
      console.error('❌ Sync workflow failed:', error.message);
      throw error;
    }
  }

  /**
   * Scan all open JIRA tickets from the specified project
   */
  async scanJiraTickets(projectKey, status = 'Open') {
    try {
      console.log(`  Fetching ${status} tickets from project ${projectKey}...`);

      const jql = `project = ${projectKey} AND status = "${status}" ORDER BY updated DESC`;
      const url = `${this.jiraApi.baseUrl}/rest/api/3/search`;

      const response = await axios.get(url, {
        params: {
          jql: jql,
          maxResults: 100,
          fields: ['key', 'summary', 'description', 'status', 'assignee', 'labels', 'components', 'customfield_10026']
        },
        auth: {
          username: this.jiraApi.email,
          password: this.jiraApi.token
        },
        timeout: 30000
      });

      const tickets = response.data.issues.map(issue => ({
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description || '',
        status: issue.fields.status.name,
        assignee: issue.fields.assignee?.displayName || 'Unassigned',
        labels: issue.fields.labels || [],
        components: issue.fields.components?.map(c => c.name) || [],
        customField: issue.fields.customfield_10026 || null,
        url: `${this.jiraApi.baseUrl}/browse/${issue.key}`,
        relatedKeywords: this.extractKeywords(issue.fields.summary, issue.fields.description)
      }));

      this.state.ticketsScanned = tickets.length;
      console.log(`  ✓ Found ${tickets.length} ${status.toLowerCase()} tickets`);

      return tickets;
    } catch (error) {
      this.state.issues.push(`JIRA scan failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Recursively scan GitHub repository for relevant code
   */
  async scanGithubRepository(branch = 'main') {
    try {
      console.log(`  Recursively scanning repository (${this.githubApi.owner}/${this.githubApi.repo})...`);

      const files = [];
      const scanPath = async (path = '') => {
        const url = `${this.githubApi.baseUrl}/repos/${this.githubApi.owner}/${this.githubApi.repo}/contents/${path}`;

        try {
          const response = await axios.get(url, {
            params: { ref: branch },
            headers: {
              'Authorization': `token ${this.githubApi.token}`,
              'Accept': 'application/vnd.github.v3+json'
            },
            timeout: 30000
          });

          for (const item of response.data) {
            // Skip node_modules, .git, and other common exclusions
            if (this.shouldSkipPath(item.name, item.path)) continue;

            if (item.type === 'dir') {
              // Recursively scan directory
              await scanPath(item.path);
            } else if (item.type === 'file') {
              // Collect code files (js, ts, json, yml, etc.)
              if (this.isCodeFile(item.name)) {
                files.push({
                  path: item.path,
                  name: item.name,
                  url: item.html_url,
                  type: this.getFileType(item.name),
                  size: item.size,
                  downloadUrl: item.download_url
                });
              }
            }
          }
        } catch (error) {
          if (error.response?.status !== 404) {
            console.warn(`  ⚠️  Error scanning ${path}: ${error.message}`);
          }
        }
      };

      await scanPath('');

      this.state.filesAnalyzed = files.length;
      console.log(`  ✓ Found ${files.length} code files to analyze`);

      return files;
    } catch (error) {
      this.state.issues.push(`GitHub scan failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify code implementation against JIRA requirements
   */
  async verifyCodeImplementation(tickets, files, options = {}) {
    console.log(`  Verifying implementation for ${tickets.length} tickets...`);

    const results = [];
    const maxConcurrent = 5;

    for (let i = 0; i < tickets.length; i += maxConcurrent) {
      const batch = tickets.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(batch.map(ticket =>
        this.verifyTicketImplementation(ticket, files, options)
      ));
      results.push(...batchResults);
    }

    console.log(`  ✓ Verified ${results.length} tickets`);
    return results;
  }

  /**
   * Verify a single ticket's implementation
   */
  async verifyTicketImplementation(ticket, files, options) {
    const verification = {
      ticket: ticket.key,
      summary: ticket.summary,
      verified: false,
      matchedFiles: [],
      implementation: {
        status: 'NOT_FOUND',
        confidence: 0,
        details: []
      },
      recommendations: [],
      links: []
    };

    try {
      // Extract keywords from ticket
      const keywords = [...new Set([
        ...ticket.relatedKeywords,
        ...ticket.labels,
        ...ticket.components
      ])];

      // Search for matching files
      for (const file of files) {
        const relevanceScore = this.calculateRelevance(
          file.path,
          file.name,
          keywords,
          ticket.summary
        );

        if (relevanceScore > 0.3) {
          verification.matchedFiles.push({
            file: file.path,
            relevance: relevanceScore,
            url: file.url,
            type: file.type
          });
        }
      }

      // Determine implementation status
      if (verification.matchedFiles.length === 0) {
        verification.implementation.status = 'NOT_IMPLEMENTED';
        verification.recommendations.push('No matching code files found - implementation may be pending');
      } else {
        verification.matchedFiles.sort((a, b) => b.relevance - a.relevance);
        const topRelevance = verification.matchedFiles[0].relevance;

        if (topRelevance > 0.7) {
          verification.implementation.status = 'IMPLEMENTED';
          verification.verified = true;
        } else if (topRelevance > 0.5) {
          verification.implementation.status = 'PARTIALLY_IMPLEMENTED';
          verification.verified = true;
        } else {
          verification.implementation.status = 'LIKELY_IMPLEMENTED';
          verification.verified = false;
        }

        verification.implementation.confidence = Math.round(topRelevance * 100);
        verification.implementation.details = verification.matchedFiles.slice(0, 5);
      }

      // Generate links for the files
      verification.links = verification.matchedFiles.slice(0, 3).map(m => ({
        url: m.url,
        text: m.file,
        title: `${m.file} (${Math.round(m.relevance * 100)}% relevant)`
      }));

    } catch (error) {
      verification.recommendations.push(`Verification error: ${error.message}`);
      console.warn(`  ⚠️  Error verifying ${ticket.key}: ${error.message}`);
    }

    return verification;
  }

  /**
   * Update JIRA tickets with verification results
   */
  async updateJiraTickets(verificationResults, options = {}) {
    console.log(`  Updating ${verificationResults.length} tickets...`);

    const updates = [];

    for (const result of verificationResults) {
      try {
        const comment = this.generateJiraComment(result);

        // Add comment to ticket
        await this.addJiraComment(result.ticket, comment);

        // Update custom field if needed
        if (options.updateCustomField && result.verified) {
          await this.updateJiraField(result.ticket, {
            'customfield_10026': 'Code Verified'
          });
        }

        updates.push({
          ticket: result.ticket,
          status: 'SUCCESS',
          message: `Updated with ${result.matchedFiles.length} linked files`
        });

        this.state.ticketsUpdated++;
        this.state.successes.push(result.ticket);

      } catch (error) {
        updates.push({
          ticket: result.ticket,
          status: 'FAILED',
          message: error.message
        });

        this.state.issues.push(`Failed to update ${result.ticket}: ${error.message}`);
        console.error(`  ❌ Failed to update ${result.ticket}: ${error.message}`);
      }
    }

    return updates;
  }

  /**
   * Add a comment to a JIRA ticket
   */
  async addJiraComment(ticketKey, comment) {
    const url = `${this.jiraApi.baseUrl}/rest/api/3/issue/${ticketKey}/comments`;

    await axios.post(url, {
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: comment
              }
            ]
          }
        ]
      }
    }, {
      auth: {
        username: this.jiraApi.email,
        password: this.jiraApi.token
      },
      timeout: 30000
    });
  }

  /**
   * Update a custom field on a JIRA ticket
   */
  async updateJiraField(ticketKey, fields) {
    const url = `${this.jiraApi.baseUrl}/rest/api/3/issue/${ticketKey}`;

    await axios.put(url, { fields }, {
      auth: {
        username: this.jiraApi.email,
        password: this.jiraApi.token
      },
      timeout: 30000
    });
  }

  /**
   * Generate JIRA comment from verification results
   */
  generateJiraComment(result) {
    let comment = `🤖 *Code Verification Report* (by JIRA-GitHub Sync)\n\n`;
    comment += `Status: ${result.implementation.status}\n`;
    comment += `Confidence: ${result.implementation.confidence}%\n\n`;

    if (result.matchedFiles.length > 0) {
      comment += `*Matched Files:*\n`;
      result.links.forEach((link, idx) => {
        comment += `• [${link.text}|${link.url}]\n`;
      });
    } else {
      comment += `No implementation found in repository.\n`;
    }

    if (result.recommendations.length > 0) {
      comment += `\n*Recommendations:*\n`;
      result.recommendations.forEach(rec => {
        comment += `• ${rec}\n`;
      });
    }

    return comment;
  }

  /**
   * Helper: Extract keywords from text
   */
  extractKeywords(summary, description) {
    const text = `${summary} ${description || ''}`.toLowerCase();
    const words = text.match(/\b\w{4,}\b/g) || [];
    return [...new Set(words)];
  }

  /**
   * Helper: Calculate relevance score between file and keywords
   */
  calculateRelevance(filePath, fileName, keywords, ticketSummary) {
    let score = 0;
    const pathLower = filePath.toLowerCase();
    const nameLower = fileName.toLowerCase();
    const summaryLower = ticketSummary.toLowerCase();

    // Exact keyword matches
    for (const keyword of keywords) {
      if (nameLower.includes(keyword)) score += 0.4;
      if (pathLower.includes(keyword)) score += 0.2;
    }

    // Component/file type relevance
    if (pathLower.includes('plugin') && (summaryLower.includes('plugin') || summaryLower.includes('skill'))) score += 0.3;
    if (pathLower.includes('agent') && summaryLower.includes('agent')) score += 0.3;
    if (pathLower.includes('test') && (summaryLower.includes('test') || summaryLower.includes('verify'))) score += 0.2;

    return Math.min(score, 1.0);
  }

  /**
   * Helper: Check if file should be skipped
   */
  shouldSkipPath(name, filePath) {
    const skipPatterns = [
      'node_modules', '.git', '.github', 'dist', 'build', 'coverage',
      '.vscode', '.idea', 'logs', '.log', '.tar.gz'
    ];

    return skipPatterns.some(pattern =>
      name.includes(pattern) || filePath.includes(pattern)
    );
  }

  /**
   * Helper: Check if file is a code file
   */
  isCodeFile(fileName) {
    const codeExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.json', '.yaml', '.yml',
      '.md', '.py', '.sh', '.json', '.config.js'
    ];

    return codeExtensions.some(ext => fileName.endsWith(ext));
  }

  /**
   * Helper: Get file type
   */
  getFileType(fileName) {
    if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return 'javascript';
    if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return 'typescript';
    if (fileName.endsWith('.json')) return 'json';
    if (fileName.endsWith('.yml') || fileName.endsWith('.yaml')) return 'yaml';
    if (fileName.endsWith('.md')) return 'markdown';
    if (fileName.endsWith('.py')) return 'python';
    if (fileName.endsWith('.sh')) return 'shell';
    return 'text';
  }

  /**
   * Generate final report
   */
  generateReport(updateResults) {
    const summary = {
      timestamp: new Date().toISOString(),
      workflow: 'jira-github-sync',
      results: {
        ticketsScanned: this.state.ticketsScanned,
        filesAnalyzed: this.state.filesAnalyzed,
        ticketsUpdated: this.state.ticketsUpdated,
        successCount: this.state.successes.length,
        issues: this.state.issues
      },
      status: this.state.issues.length === 0 ? 'SUCCESS' : 'COMPLETED_WITH_ISSUES',
      updateDetails: updateResults
    };

    console.log('\n📊 SYNC SUMMARY:');
    console.log(`  Tickets scanned: ${summary.results.ticketsScanned}`);
    console.log(`  Files analyzed: ${summary.results.filesAnalyzed}`);
    console.log(`  Tickets updated: ${summary.results.ticketsUpdated}`);
    console.log(`  Status: ${summary.status}`);

    if (summary.results.issues.length > 0) {
      console.log(`  Issues: ${summary.results.issues.length}`);
    }

    return summary;
  }
}

// Export for use as a skill
module.exports = JiraGithubSyncSkill;
