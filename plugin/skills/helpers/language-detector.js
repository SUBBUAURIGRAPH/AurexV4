/**
 * Language Detector - Detect programming languages and project types
 *
 * Capabilities:
 * - File extension detection
 * - Project configuration parsing (package.json, pom.xml, pyproject.toml, etc.)
 * - Test framework detection (Jest, Mocha, JUnit, pytest, etc.)
 * - Build system detection (Maven, Gradle, npm, pip, cargo, etc.)
 * - Framework detection (Spring, Django, Express, React, etc.)
 * - Monorepo detection
 * - Language metadata extraction
 *
 * @module language-detector
 */

const fs = require('fs');
const path = require('path');

/**
 * Language and project type detector
 */
class LanguageDetector {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Detect programming language from file path
   *
   * @param {string} filePath - Path to source file
   * @returns {Object} Language metadata
   */
  detectLanguageFromFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath);

    const languageMap = {
      // JavaScript/TypeScript
      '.js': { language: 'javascript', type: 'script', runtime: 'node' },
      '.jsx': { language: 'javascript', type: 'react', runtime: 'node' },
      '.ts': { language: 'typescript', type: 'script', runtime: 'node' },
      '.tsx': { language: 'typescript', type: 'react', runtime: 'node' },
      '.mjs': { language: 'javascript', type: 'module', runtime: 'node' },

      // Python
      '.py': { language: 'python', type: 'script', runtime: 'python' },
      '.pyw': { language: 'python', type: 'windows', runtime: 'python' },
      '.pyx': { language: 'python', type: 'cython', runtime: 'python' },

      // Java
      '.java': { language: 'java', type: 'class', runtime: 'jvm' },
      '.kt': { language: 'kotlin', type: 'class', runtime: 'jvm' },
      '.scala': { language: 'scala', type: 'class', runtime: 'jvm' },

      // SQL
      '.sql': { language: 'sql', type: 'query', runtime: 'database' },

      // Protobuf
      '.proto': { language: 'protobuf', type: 'definition', runtime: 'grpc' },

      // Go
      '.go': { language: 'go', type: 'package', runtime: 'go' },

      // Rust
      '.rs': { language: 'rust', type: 'module', runtime: 'rust' },

      // C++
      '.cpp': { language: 'cpp', type: 'source', runtime: 'native' },
      '.cc': { language: 'cpp', type: 'source', runtime: 'native' },
      '.cxx': { language: 'cpp', type: 'source', runtime: 'native' },
      '.hpp': { language: 'cpp', type: 'header', runtime: 'native' },
      '.h': { language: 'cpp', type: 'header', runtime: 'native' },

      // C
      '.c': { language: 'c', type: 'source', runtime: 'native' },

      // Shell
      '.sh': { language: 'shell', type: 'script', runtime: 'bash' },
      '.bash': { language: 'shell', type: 'script', runtime: 'bash' },
    };

    const metadata = languageMap[ext] || { language: 'unknown', type: 'file', runtime: 'unknown' };

    return {
      ...metadata,
      extension: ext,
      filename: basename,
      path: filePath
    };
  }

  /**
   * Detect project type from project root directory
   *
   * @param {string} projectRoot - Path to project root
   * @returns {Object} Project metadata
   */
  detectProjectType(projectRoot) {
    const cacheKey = `project:${projectRoot}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const metadata = {
      languages: [],
      primaryLanguage: null,
      projectType: null,
      frameworks: [],
      buildSystem: null,
      testFramework: null,
      isMonorepo: false
    };

    try {
      // Check for Node.js project
      if (this._fileExists(projectRoot, 'package.json')) {
        const packageJson = this._readJSON(path.join(projectRoot, 'package.json'));
        metadata.languages.push('javascript');
        metadata.primaryLanguage = 'javascript';
        metadata.buildSystem = 'npm';
        metadata.projectType = 'node';

        // Detect frameworks from dependencies
        if (packageJson.dependencies || packageJson.devDependencies) {
          const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
          if (deps.react) metadata.frameworks.push('react');
          if (deps.vue) metadata.frameworks.push('vue');
          if (deps.angular || deps['@angular/core']) metadata.frameworks.push('angular');
          if (deps.express) metadata.frameworks.push('express');
          if (deps.next) metadata.frameworks.push('nextjs');
        }
      }

      // Check for Python project
      if (this._fileExists(projectRoot, 'pyproject.toml') ||
          this._fileExists(projectRoot, 'setup.py') ||
          this._fileExists(projectRoot, 'requirements.txt')) {
        metadata.languages.push('python');
        if (!metadata.primaryLanguage) metadata.primaryLanguage = 'python';
        metadata.buildSystem = 'pip';
        metadata.projectType = 'python';

        // Detect Python frameworks
        const reqsPath = path.join(projectRoot, 'requirements.txt');
        if (fs.existsSync(reqsPath)) {
          const reqs = fs.readFileSync(reqsPath, 'utf8');
          if (reqs.includes('django')) metadata.frameworks.push('django');
          if (reqs.includes('flask')) metadata.frameworks.push('flask');
          if (reqs.includes('fastapi')) metadata.frameworks.push('fastapi');
        }
      }

      // Check for Java project
      if (this._fileExists(projectRoot, 'pom.xml')) {
        metadata.languages.push('java');
        if (!metadata.primaryLanguage) metadata.primaryLanguage = 'java';
        metadata.buildSystem = 'maven';
        metadata.projectType = 'java';

        const pomContent = fs.readFileSync(path.join(projectRoot, 'pom.xml'), 'utf8');
        if (pomContent.includes('spring-boot')) metadata.frameworks.push('spring-boot');
        if (pomContent.includes('spring-framework')) metadata.frameworks.push('spring');
      }

      if (this._fileExists(projectRoot, 'build.gradle') ||
          this._fileExists(projectRoot, 'build.gradle.kts')) {
        metadata.languages.push('java');
        if (!metadata.primaryLanguage) metadata.primaryLanguage = 'java';
        metadata.buildSystem = 'gradle';
        metadata.projectType = 'java';
      }

      // Check for Go project
      if (this._fileExists(projectRoot, 'go.mod')) {
        metadata.languages.push('go');
        if (!metadata.primaryLanguage) metadata.primaryLanguage = 'go';
        metadata.buildSystem = 'go-modules';
        metadata.projectType = 'go';
      }

      // Check for Rust project
      if (this._fileExists(projectRoot, 'Cargo.toml')) {
        metadata.languages.push('rust');
        if (!metadata.primaryLanguage) metadata.primaryLanguage = 'rust';
        metadata.buildSystem = 'cargo';
        metadata.projectType = 'rust';
      }

      // Check for monorepo indicators
      if (this._fileExists(projectRoot, 'lerna.json') ||
          this._fileExists(projectRoot, 'nx.json') ||
          this._fileExists(projectRoot, 'pnpm-workspace.yaml')) {
        metadata.isMonorepo = true;
      }

      this.cache.set(cacheKey, metadata);
      return metadata;
    } catch (error) {
      return metadata;
    }
  }

  /**
   * Detect test framework from project configuration
   *
   * @param {string} projectRoot - Path to project root
   * @returns {string|null} Test framework name
   */
  detectTestFramework(projectRoot) {
    try {
      // Node.js test frameworks
      if (this._fileExists(projectRoot, 'package.json')) {
        const packageJson = this._readJSON(path.join(projectRoot, 'package.json'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        if (deps.jest || this._fileExists(projectRoot, 'jest.config.js')) return 'jest';
        if (deps.mocha || this._fileExists(projectRoot, '.mocharc.json')) return 'mocha';
        if (deps.jasmine) return 'jasmine';
        if (deps.vitest) return 'vitest';
        if (deps['@playwright/test']) return 'playwright';
      }

      // Python test frameworks
      if (this._fileExists(projectRoot, 'pytest.ini') ||
          this._fileExists(projectRoot, 'setup.cfg')) {
        return 'pytest';
      }

      // Java test frameworks
      if (this._fileExists(projectRoot, 'pom.xml')) {
        const pomContent = fs.readFileSync(path.join(projectRoot, 'pom.xml'), 'utf8');
        if (pomContent.includes('junit-jupiter')) return 'junit5';
        if (pomContent.includes('junit')) return 'junit4';
        if (pomContent.includes('testng')) return 'testng';
      }

      // Go test framework (built-in)
      if (this._fileExists(projectRoot, 'go.mod')) {
        return 'go-test';
      }

      // Rust test framework (built-in)
      if (this._fileExists(projectRoot, 'Cargo.toml')) {
        return 'cargo-test';
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Detect build system from project configuration
   *
   * @param {string} projectRoot - Path to project root
   * @returns {string|null} Build system name
   */
  detectBuildSystem(projectRoot) {
    const buildSystems = [
      { file: 'package.json', system: 'npm' },
      { file: 'pom.xml', system: 'maven' },
      { file: 'build.gradle', system: 'gradle' },
      { file: 'Cargo.toml', system: 'cargo' },
      { file: 'go.mod', system: 'go' },
      { file: 'CMakeLists.txt', system: 'cmake' },
      { file: 'Makefile', system: 'make' },
      { file: 'pyproject.toml', system: 'poetry' }
    ];

    for (const { file, system } of buildSystems) {
      if (this._fileExists(projectRoot, file)) {
        return system;
      }
    }

    return null;
  }

  /**
   * Detect frameworks used in project
   *
   * @param {string} projectRoot - Path to project root
   * @returns {Array<string>} List of detected frameworks
   */
  detectFrameworks(projectRoot) {
    const projectMeta = this.detectProjectType(projectRoot);
    return projectMeta.frameworks;
  }

  /**
   * Analyze directory for language statistics
   *
   * @param {string} dirPath - Path to directory
   * @returns {Object} Directory analysis
   */
  analyzeDirectory(dirPath) {
    const stats = {
      totalFiles: 0,
      languages: {},
      extensions: {}
    };

    const analyzeRecursive = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Skip node_modules and hidden directories
          if (entry.name.startsWith('.') || entry.name === 'node_modules') {
            continue;
          }

          if (entry.isDirectory()) {
            analyzeRecursive(fullPath);
          } else if (entry.isFile()) {
            stats.totalFiles++;

            const meta = this.detectLanguageFromFile(fullPath);
            const lang = meta.language;
            const ext = meta.extension;

            stats.languages[lang] = (stats.languages[lang] || 0) + 1;
            stats.extensions[ext] = (stats.extensions[ext] || 0) + 1;
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    analyzeRecursive(dirPath);

    // Calculate percentages
    stats.languagePercentages = {};
    for (const [lang, count] of Object.entries(stats.languages)) {
      stats.languagePercentages[lang] = ((count / stats.totalFiles) * 100).toFixed(2) + '%';
    }

    return stats;
  }

  /**
   * Check if file exists in directory
   *
   * @private
   * @param {string} dir - Directory path
   * @param {string} filename - File name
   * @returns {boolean}
   */
  _fileExists(dir, filename) {
    return fs.existsSync(path.join(dir, filename));
  }

  /**
   * Read and parse JSON file
   *
   * @private
   * @param {string} filePath - Path to JSON file
   * @returns {Object}
   */
  _readJSON(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return {};
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = LanguageDetector;
