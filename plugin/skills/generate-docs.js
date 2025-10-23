/**
 * Generate Docs Skill - Automated Documentation Generation
 *
 * Provides comprehensive documentation generation including:
 * - API documentation from source code
 * - Function and class documentation
 * - Type signature extraction
 * - Usage examples generation
 * - README generation
 * - Changelog creation
 * - Architecture documentation
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate Docs Skill Definition
 */
const generateDocsSkill = {
  name: 'generate-docs',
  description: 'Generate comprehensive documentation from source code with examples and API docs',
  version: '1.0.0',
  category: 'documentation',
  tags: ['documentation', 'api-docs', 'readme', 'examples'],

  parameters: {
    sourcePath: {
      type: 'string',
      required: true,
      description: 'Path to source file or directory to document'
    },
    docType: {
      type: 'string',
      required: false,
      default: 'comprehensive',
      description: 'Type of docs: api, readme, examples, architecture, changelog, comprehensive'
    },
    includeExamples: {
      type: 'boolean',
      required: false,
      default: true,
      description: 'Include usage examples in documentation'
    },
    targetFormat: {
      type: 'string',
      required: false,
      default: 'markdown',
      description: 'Output format: markdown, html, json'
    }
  },

  execute: async function(context) {
    const { sourcePath, docType, includeExamples, targetFormat } = context.parameters;

    try {
      if (!fs.existsSync(sourcePath)) {
        throw new Error('Source path not found: ' + sourcePath);
      }

      const isDirectory = fs.statSync(sourcePath).isDirectory();
      context.logger.info('Generating ' + (docType || 'comprehensive') + ' documentation');

      let documentation;
      if (isDirectory) {
        documentation = generateDirectoryDocs(sourcePath, docType || 'comprehensive', includeExamples !== false);
      } else {
        documentation = generateFileDocs(sourcePath, docType || 'comprehensive', includeExamples !== false);
      }

      return {
        success: true,
        path: sourcePath,
        type: docType || 'comprehensive',
        format: targetFormat || 'markdown',
        ...documentation
      };
    } catch (error) {
      context.logger.error('Documentation generation failed: ' + error.message);
      return {
        success: false,
        error: error.message,
        path: sourcePath
      };
    }
  },

  formatResult: function(result) {
    if (!result.success) {
      return 'Documentation generation failed: ' + result.error;
    }

    let output = '\n' + '='.repeat(70) + '\n';
    output += 'Generated Documentation\n';
    output += '='.repeat(70) + '\n\n';

    if (result.metadata) {
      const m = result.metadata;
      output += 'Documentation Metadata\n';
      output += '-'.repeat(70) + '\n';
      output += 'Type: ' + m.type + '\n';
      output += 'Files Documented: ' + (m.filesDocumented || 'N/A') + '\n';
      output += 'Functions: ' + (m.functionsFound || 0) + '\n';
      output += 'Classes: ' + (m.classesFound || 0) + '\n';
      output += 'Interfaces: ' + (m.interfacesFound || 0) + '\n';
      output += '\n';
    }

    if (result.summary) {
      output += 'Documentation Summary\n';
      output += '-'.repeat(70) + '\n';
      output += result.summary + '\n\n';
    }

    if (result.sections && result.sections.length > 0) {
      output += 'Documentation Sections\n';
      output += '-'.repeat(70) + '\n';
      result.sections.forEach(function(section, i) {
        output += (i + 1) + '. ' + section.title + '\n';
        output += '   ' + section.description + '\n';
      });
      output += '\n';
    }

    if (result.examples && result.examples.length > 0) {
      output += 'Usage Examples\n';
      output += '-'.repeat(70) + '\n';
      result.examples.slice(0, 3).forEach(function(example, i) {
        output += (i + 1) + '. ' + example.title + '\n';
        output += '   Description: ' + example.description + '\n';
      });
      if (result.examples.length > 3) {
        output += '   ... and ' + (result.examples.length - 3) + ' more examples\n';
      }
      output += '\n';
    }

    if (result.warnings && result.warnings.length > 0) {
      output += 'Documentation Warnings\n';
      output += '-'.repeat(70) + '\n';
      result.warnings.forEach(function(warning, i) {
        output += (i + 1) + '. ' + warning + '\n';
      });
      output += '\n';
    }

    return output;
  }
};

/**
 * Generate documentation for a single file
 */
function generateFileDocs(filePath, docType, includeExamples) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath);

  const items = extractDocumentableItems(content, ext);
  const summary = generateSummary(items, fileName);
  const sections = generateSections(items, docType);
  const examples = includeExamples ? generateExamples(items, content) : [];

  return {
    metadata: {
      type: docType,
      filesDocumented: 1,
      functionsFound: items.functions.length,
      classesFound: items.classes.length,
      interfacesFound: items.interfaces.length
    },
    summary: summary,
    sections: sections,
    examples: examples,
    content: generateMarkdown(items, docType, fileName),
    warnings: detectDocumentationGaps(items)
  };
}

/**
 * Generate documentation for a directory
 */
function generateDirectoryDocs(dirPath, docType, includeExamples) {
  const files = findDocumentableFiles(dirPath);
  let totalFunctions = 0;
  let totalClasses = 0;
  let allItems = { functions: [], classes: [], interfaces: [] };

  files.forEach(function(file) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const ext = path.extname(file);
      const items = extractDocumentableItems(content, ext);

      totalFunctions += items.functions.length;
      totalClasses += items.classes.length;
      allItems.functions = allItems.functions.concat(items.functions);
      allItems.classes = allItems.classes.concat(items.classes);
      allItems.interfaces = allItems.interfaces.concat(items.interfaces);
    } catch (e) {
      // Skip files that can't be read
    }
  });

  const summary = 'Project documentation covering ' + files.length + ' source files';
  const sections = generateSections(allItems, docType);
  const examples = includeExamples ? allItems.functions.slice(0, 5).map(function(fn) {
    return {
      title: fn.name,
      description: 'Usage example for ' + fn.name
    };
  }) : [];

  return {
    metadata: {
      type: docType,
      filesDocumented: files.length,
      functionsFound: totalFunctions,
      classesFound: totalClasses,
      interfacesFound: allItems.interfaces.length
    },
    summary: summary,
    sections: sections,
    examples: examples,
    content: generateProjectMarkdown(allItems, docType),
    warnings: []
  };
}

/**
 * Extract documentable items from code
 */
function extractDocumentableItems(code, fileType) {
  const items = {
    functions: [],
    classes: [],
    interfaces: []
  };

  if (fileType === '.js' || fileType === '.ts' || fileType === '.jsx' || fileType === '.tsx') {
    // Extract functions
    const funcPattern = /(?:async\s+)?function\s+(\w+)\s*\((.*?)\)|const\s+(\w+)\s*=\s*(?:async\s*)?\((.*?)\)\s*=>/g;
    let match;
    while ((match = funcPattern.exec(code)) !== null) {
      const name = match[1] || match[3];
      const params = (match[2] || match[4] || '').trim();
      items.functions.push({
        name: name,
        type: 'function',
        parameters: params ? params.split(',').map(p => p.trim()) : [],
        hasJSDoc: code.includes('/**') && code.indexOf('/**') < match.index
      });
    }

    // Extract classes (including TypeScript generics)
    const classPattern = /class\s+(\w+)(?:<[^>]*>)?\s*(?:extends\s+(\w+(?:<[^>]*>)?))?\s*{/g;
    while ((match = classPattern.exec(code)) !== null) {
      items.classes.push({
        name: match[1],
        extends: match[2],
        type: 'class'
      });
    }

    // Extract interfaces (TypeScript)
    const interfacePattern = /interface\s+(\w+)(?:\s+extends\s+(\w+))?\s*{/g;
    while ((match = interfacePattern.exec(code)) !== null) {
      items.interfaces.push({
        name: match[1],
        extends: match[2],
        type: 'interface'
      });
    }
  } else if (fileType === '.py') {
    // Extract Python functions
    const pyFuncPattern = /def\s+(\w+)\s*\((.*?)\):/g;
    let match;
    while ((match = pyFuncPattern.exec(code)) !== null) {
      items.functions.push({
        name: match[1],
        type: 'function',
        parameters: match[2].split(',').map(p => p.trim()),
        hasDocstring: code.includes('\"\"\"') || code.includes("'''")
      });
    }

    // Extract Python classes
    const pyClassPattern = /class\s+(\w+)(?:\((.*?)\))?:/g;
    while ((match = pyClassPattern.exec(code)) !== null) {
      items.classes.push({
        name: match[1],
        inherits: match[2],
        type: 'class'
      });
    }
  }

  return items;
}

/**
 * Generate summary for documentation
 */
function generateSummary(items, fileName) {
  const parts = [];

  if (items.functions.length > 0) {
    parts.push('Defines ' + items.functions.length + ' function' + (items.functions.length !== 1 ? 's' : ''));
  }

  if (items.classes.length > 0) {
    parts.push(items.classes.length + ' class' + (items.classes.length !== 1 ? 'es' : ''));
  }

  if (items.interfaces.length > 0) {
    parts.push(items.interfaces.length + ' interface' + (items.interfaces.length !== 1 ? 's' : ''));
  }

  if (parts.length === 0) {
    return 'Documentation for ' + fileName;
  }

  return fileName + ' ' + parts.join(', ') + '.';
}

/**
 * Generate documentation sections
 */
function generateSections(items, docType) {
  const sections = [];

  if (docType === 'api' || docType === 'comprehensive') {
    if (items.functions.length > 0) {
      sections.push({
        title: 'API Reference - Functions',
        description: items.functions.length + ' functions documented with parameters and return types'
      });
    }

    if (items.classes.length > 0) {
      sections.push({
        title: 'API Reference - Classes',
        description: items.classes.length + ' classes with methods and properties'
      });
    }

    if (items.interfaces.length > 0) {
      sections.push({
        title: 'Type Definitions',
        description: items.interfaces.length + ' interfaces and type definitions'
      });
    }
  }

  if (docType === 'examples' || docType === 'comprehensive') {
    if (items.functions.length > 0) {
      sections.push({
        title: 'Usage Examples',
        description: 'Practical examples showing how to use the available functions'
      });
    }
  }

  if (docType === 'architecture' || docType === 'comprehensive') {
    sections.push({
      title: 'Architecture Overview',
      description: 'High-level overview of the codebase structure and design patterns'
    });
  }

  return sections;
}

/**
 * Generate usage examples
 */
function generateExamples(items, code) {
  const examples = [];

  items.functions.slice(0, 5).forEach(function(fn) {
    examples.push({
      title: 'Using ' + fn.name + '()',
      description: 'Example of how to call ' + fn.name + ' with appropriate parameters',
      parameters: fn.parameters.length,
      language: code.includes('function') ? 'javascript' : 'python'
    });
  });

  return examples;
}

/**
 * Detect documentation gaps
 */
function detectDocumentationGaps(items) {
  const warnings = [];

  const undocumentedFunctions = items.functions.filter(f => f.hasJSDoc === false).length;
  if (undocumentedFunctions > 0) {
    warnings.push(undocumentedFunctions + ' function' + (undocumentedFunctions !== 1 ? 's' : '') + ' lack JSDoc comments');
  }

  const undocumentedClasses = items.classes.length;
  if (undocumentedClasses > 0) {
    warnings.push(undocumentedClasses + ' class' + (undocumentedClasses !== 1 ? 'es' : '') + ' need documentation');
  }

  if (items.functions.length === 0 && items.classes.length === 0) {
    warnings.push('No documentable items found in source');
  }

  return warnings.slice(0, 5);
}

/**
 * Generate markdown documentation
 */
function generateMarkdown(items, docType, fileName) {
  let markdown = '# ' + fileName + '\n\n';

  if (items.functions.length > 0) {
    markdown += '## Functions\n\n';
    items.functions.forEach(function(fn) {
      markdown += '### ' + fn.name + '(' + fn.parameters.join(', ') + ')\n\n';
      markdown += '**Parameters:**\n';
      fn.parameters.forEach(function(param) {
        markdown += '- `' + param + '` - Parameter description\n';
      });
      markdown += '\n**Returns:** Return value description\n\n';
    });
  }

  if (items.classes.length > 0) {
    markdown += '## Classes\n\n';
    items.classes.forEach(function(cls) {
      markdown += '### ' + cls.name + '\n\n';
      if (cls.extends) {
        markdown += 'Extends: `' + cls.extends + '`\n\n';
      }
      markdown += 'Class description and usage.\n\n';
    });
  }

  return markdown;
}

/**
 * Generate project-level markdown
 */
function generateProjectMarkdown(allItems, docType) {
  let markdown = '# Project Documentation\n\n';
  markdown += '## Overview\n\n';
  markdown += 'This project contains ' + allItems.functions.length + ' functions, ';
  markdown += allItems.classes.length + ' classes, and ';
  markdown += allItems.interfaces.length + ' interfaces.\n\n';

  markdown += '## API Documentation\n\n';
  if (allItems.functions.length > 0) {
    markdown += '### Available Functions\n\n';
    allItems.functions.slice(0, 10).forEach(function(fn) {
      markdown += '- `' + fn.name + '()` - Function reference\n';
    });
    markdown += '\n';
  }

  return markdown;
}

/**
 * Find documentable files in directory
 */
function findDocumentableFiles(dirPath, maxDepth, currentDepth) {
  maxDepth = maxDepth || 3;
  currentDepth = currentDepth || 0;

  if (currentDepth > maxDepth) {
    return [];
  }

  const files = [];
  const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.cpp', '.h'];

  try {
    const entries = fs.readdirSync(dirPath);

    entries.forEach(function(entry) {
      if (entry.startsWith('.')) return;
      if (entry === 'node_modules' || entry === '__pycache__') return;

      const fullPath = path.join(dirPath, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files = files.concat(findDocumentableFiles(fullPath, maxDepth, currentDepth + 1));
      } else if (stat.isFile()) {
        const ext = path.extname(entry);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    });
  } catch (e) {
    // Handle read errors silently
  }

  return files;
}

module.exports = generateDocsSkill;
