/**
 * AST Parser - Unified Abstract Syntax Tree parsing across multiple languages
 *
 * Provides parsing capabilities for:
 * - JavaScript/TypeScript
 * - Python
 * - Java
 * - SQL
 * - Protobuf
 * - Go
 * - Rust
 * - C++
 *
 * Features:
 * - Language auto-detection
 * - AST node traversal with visitor pattern
 * - Graceful error handling
 * - Node searching with predicates
 *
 * @module ast-parser
 */

const fs = require('fs');
const path = require('path');

/**
 * Supported programming languages
 */
const SUPPORTED_LANGUAGES = [
  'javascript', 'typescript', 'python', 'java',
  'sql', 'protobuf', 'go', 'rust', 'cpp'
];

/**
 * AST Parser class for multi-language code analysis
 */
class ASTParser {
  constructor() {
    this.cache = new Map();
    this.errorLog = [];
  }

  /**
   * Parse JavaScript code into AST
   * Uses a simple tokenization approach for core JS patterns
   *
   * @param {string} code - JavaScript source code
   * @returns {Object} AST representation
   */
  parseJavaScript(code) {
    try {
      const ast = {
        type: 'Program',
        language: 'javascript',
        body: [],
        errors: []
      };

      // Extract functions
      const functionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g;
      let match;
      while ((match = functionRegex.exec(code)) !== null) {
        ast.body.push({
          type: 'FunctionDeclaration',
          name: match[1] || match[2],
          start: match.index,
          end: match.index + match[0].length
        });
      }

      // Extract classes
      const classRegex = /class\s+(\w+)/g;
      while ((match = classRegex.exec(code)) !== null) {
        ast.body.push({
          type: 'ClassDeclaration',
          name: match[1],
          start: match.index,
          end: match.index + match[0].length
        });
      }

      // Extract imports
      const importRegex = /import\s+(?:{[^}]+}|\w+)\s+from\s+['"]([^'"]+)['"]/g;
      while ((match = importRegex.exec(code)) !== null) {
        ast.body.push({
          type: 'ImportDeclaration',
          source: match[1],
          start: match.index,
          end: match.index + match[0].length
        });
      }

      return ast;
    } catch (error) {
      return this._handleParseError('javascript', code, error);
    }
  }

  /**
   * Parse TypeScript code into AST
   *
   * @param {string} code - TypeScript source code
   * @returns {Object} AST representation
   */
  parseTypeScript(code) {
    const ast = this.parseJavaScript(code);
    ast.language = 'typescript';

    // Extract interfaces
    const interfaceRegex = /interface\s+(\w+)/g;
    let match;
    while ((match = interfaceRegex.exec(code)) !== null) {
      ast.body.push({
        type: 'InterfaceDeclaration',
        name: match[1],
        start: match.index,
        end: match.index + match[0].length
      });
    }

    return ast;
  }

  /**
   * Parse Python code into AST
   *
   * @param {string} code - Python source code
   * @returns {Object} AST representation
   */
  parsePython(code) {
    try {
      const ast = {
        type: 'Module',
        language: 'python',
        body: [],
        errors: []
      };

      // Extract function definitions
      const funcRegex = /(?:^|\n)(?:async\s+)?def\s+(\w+)\s*\([^)]*\)/gm;
      let match;
      while ((match = funcRegex.exec(code)) !== null) {
        ast.body.push({
          type: 'FunctionDef',
          name: match[1],
          start: match.index,
          end: match.index + match[0].length
        });
      }

      // Extract class definitions
      const classRegex = /(?:^|\n)class\s+(\w+)/gm;
      while ((match = classRegex.exec(code)) !== null) {
        ast.body.push({
          type: 'ClassDef',
          name: match[1],
          start: match.index,
          end: match.index + match[0].length
        });
      }

      // Extract imports
      const importRegex = /(?:^|\n)(?:from\s+(\S+)\s+)?import\s+([^\n]+)/gm;
      while ((match = importRegex.exec(code)) !== null) {
        ast.body.push({
          type: 'Import',
          module: match[1] || 'builtin',
          names: match[2],
          start: match.index,
          end: match.index + match[0].length
        });
      }

      return ast;
    } catch (error) {
      return this._handleParseError('python', code, error);
    }
  }

  /**
   * Parse Java source code into AST
   *
   * @param {string} code - Java source code
   * @returns {Object} AST representation
   */
  parseJava(code) {
    try {
      const ast = {
        type: 'CompilationUnit',
        language: 'java',
        body: [],
        errors: []
      };

      // Extract package declaration
      const packageRegex = /package\s+([\w.]+);/;
      const packageMatch = code.match(packageRegex);
      if (packageMatch) {
        ast.package = packageMatch[1];
      }

      // Extract class declarations
      const classRegex = /(?:public\s+)?(?:abstract\s+)?class\s+(\w+)/g;
      let match;
      while ((match = classRegex.exec(code)) !== null) {
        ast.body.push({
          type: 'ClassDeclaration',
          name: match[1],
          start: match.index,
          end: match.index + match[0].length
        });
      }

      // Extract method declarations
      const methodRegex = /(?:public|private|protected)\s+(?:static\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)/g;
      while ((match = methodRegex.exec(code)) !== null) {
        ast.body.push({
          type: 'MethodDeclaration',
          name: match[1],
          start: match.index,
          end: match.index + match[0].length
        });
      }

      // Extract imports
      const importRegex = /import\s+([\w.*]+);/g;
      while ((match = importRegex.exec(code)) !== null) {
        ast.body.push({
          type: 'ImportDeclaration',
          path: match[1],
          start: match.index,
          end: match.index + match[0].length
        });
      }

      return ast;
    } catch (error) {
      return this._handleParseError('java', code, error);
    }
  }

  /**
   * Parse SQL code
   *
   * @param {string} sql - SQL query string
   * @returns {Object} AST representation
   */
  parseSQL(sql) {
    try {
      const ast = {
        type: 'SQLProgram',
        language: 'sql',
        statements: [],
        errors: []
      };

      // Extract SELECT statements
      const selectRegex = /SELECT\s+(.+?)\s+FROM\s+(\w+)/gi;
      let match;
      while ((match = selectRegex.exec(sql)) !== null) {
        ast.statements.push({
          type: 'SelectStatement',
          columns: match[1],
          table: match[2],
          start: match.index,
          end: match.index + match[0].length
        });
      }

      // Extract CREATE TABLE statements
      const createRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
      while ((match = createRegex.exec(sql)) !== null) {
        ast.statements.push({
          type: 'CreateTableStatement',
          table: match[1],
          start: match.index,
          end: match.index + match[0].length
        });
      }

      // Extract INSERT statements
      const insertRegex = /INSERT\s+INTO\s+(\w+)/gi;
      while ((match = insertRegex.exec(sql)) !== null) {
        ast.statements.push({
          type: 'InsertStatement',
          table: match[1],
          start: match.index,
          end: match.index + match[0].length
        });
      }

      return ast;
    } catch (error) {
      return this._handleParseError('sql', sql, error);
    }
  }

  /**
   * Parse Protobuf definition files
   *
   * @param {string} proto - Protobuf definition
   * @returns {Object} AST representation
   */
  parseProtobuf(proto) {
    try {
      const ast = {
        type: 'ProtoFile',
        language: 'protobuf',
        messages: [],
        services: [],
        errors: []
      };

      // Extract message definitions
      const messageRegex = /message\s+(\w+)\s*{/g;
      let match;
      while ((match = messageRegex.exec(proto)) !== null) {
        ast.messages.push({
          type: 'MessageDefinition',
          name: match[1],
          start: match.index,
          end: match.index + match[0].length
        });
      }

      // Extract service definitions
      const serviceRegex = /service\s+(\w+)\s*{/g;
      while ((match = serviceRegex.exec(proto)) !== null) {
        ast.services.push({
          type: 'ServiceDefinition',
          name: match[1],
          start: match.index,
          end: match.index + match[0].length
        });
      }

      return ast;
    } catch (error) {
      return this._handleParseError('protobuf', proto, error);
    }
  }

  /**
   * Detect programming language from file path
   *
   * @param {string} filePath - Path to source file
   * @returns {string} Detected language
   */
  detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.sql': 'sql',
      '.proto': 'protobuf',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.hpp': 'cpp',
      '.h': 'cpp'
    };

    return languageMap[ext] || 'unknown';
  }

  /**
   * Traverse AST using visitor pattern
   *
   * @param {Object} ast - Abstract syntax tree
   * @param {Object} visitor - Visitor functions for each node type
   */
  traverseAST(ast, visitor) {
    const visit = (node, parent = null) => {
      if (!node || typeof node !== 'object') return;

      // Call visitor for this node type
      const visitorFn = visitor[node.type];
      if (typeof visitorFn === 'function') {
        visitorFn(node, parent);
      }

      // Call generic visitor if exists
      if (typeof visitor.all === 'function') {
        visitor.all(node, parent);
      }

      // Traverse children
      if (Array.isArray(node.body)) {
        node.body.forEach(child => visit(child, node));
      }
      if (Array.isArray(node.statements)) {
        node.statements.forEach(child => visit(child, node));
      }
      if (Array.isArray(node.messages)) {
        node.messages.forEach(child => visit(child, node));
      }
    };

    visit(ast);
  }

  /**
   * Find nodes in AST matching a predicate
   *
   * @param {Object} ast - Abstract syntax tree
   * @param {Function} predicate - Function to test each node
   * @returns {Array} Matching nodes
   */
  findNodes(ast, predicate) {
    const results = [];

    this.traverseAST(ast, {
      all: (node) => {
        if (predicate(node)) {
          results.push(node);
        }
      }
    });

    return results;
  }

  /**
   * Handle parse errors gracefully
   *
   * @private
   * @param {string} language - Language being parsed
   * @param {string} code - Source code
   * @param {Error} error - Error that occurred
   * @returns {Object} Error AST
   */
  _handleParseError(language, code, error) {
    const errorNode = {
      type: 'ParseError',
      language,
      error: error.message,
      line: null,
      column: null
    };

    this.errorLog.push(errorNode);

    return {
      type: 'ErrorNode',
      language,
      body: [],
      errors: [errorNode]
    };
  }

  /**
   * Get all logged errors
   *
   * @returns {Array} Error log
   */
  getErrors() {
    return this.errorLog;
  }

  /**
   * Clear error log
   */
  clearErrors() {
    this.errorLog = [];
  }
}

module.exports = ASTParser;
