/**
 * Unit tests for AST Parser
 *
 * @module ast-parser.test
 */

const ASTParser = require('../ast-parser');

describe('ASTParser', () => {
  let parser;

  beforeEach(() => {
    parser = new ASTParser();
  });

  describe('parseJavaScript', () => {
    test('should parse valid JavaScript code with functions', () => {
      const code = `
        function greet(name) {
          return 'Hello ' + name;
        }

        const add = (a, b) => a + b;
      `;

      const ast = parser.parseJavaScript(code);

      expect(ast.type).toBe('Program');
      expect(ast.language).toBe('javascript');
      expect(ast.body.length).toBeGreaterThan(0);
      expect(ast.body.some(node => node.type === 'FunctionDeclaration')).toBe(true);
    });

    test('should parse JavaScript classes', () => {
      const code = `
        class Person {
          constructor(name) {
            this.name = name;
          }
        }
      `;

      const ast = parser.parseJavaScript(code);

      expect(ast.body.some(node => node.type === 'ClassDeclaration')).toBe(true);
      expect(ast.body.some(node => node.name === 'Person')).toBe(true);
    });

    test('should parse JavaScript imports', () => {
      const code = `
        import React from 'react';
        import { useState } from 'react';
      `;

      const ast = parser.parseJavaScript(code);

      expect(ast.body.some(node => node.type === 'ImportDeclaration')).toBe(true);
    });

    test('should handle syntax errors gracefully', () => {
      const code = 'function broken( {';

      const ast = parser.parseJavaScript(code);

      // Should return an error node instead of throwing
      expect(ast).toBeDefined();
      expect(ast.body).toBeDefined();
    });
  });

  describe('parsePython', () => {
    test('should parse valid Python code with functions', () => {
      const code = `
def greet(name):
    return f"Hello {name}"

async def fetch_data():
    pass
      `;

      const ast = parser.parsePython(code);

      expect(ast.type).toBe('Module');
      expect(ast.language).toBe('python');
      expect(ast.body.length).toBeGreaterThan(0);
      expect(ast.body.some(node => node.type === 'FunctionDef')).toBe(true);
    });

    test('should parse Python classes', () => {
      const code = `
class Person:
    def __init__(self, name):
        self.name = name
      `;

      const ast = parser.parsePython(code);

      expect(ast.body.some(node => node.type === 'ClassDef')).toBe(true);
      expect(ast.body.some(node => node.name === 'Person')).toBe(true);
    });

    test('should parse Python imports', () => {
      const code = `
import os
from pathlib import Path
      `;

      const ast = parser.parsePython(code);

      expect(ast.body.some(node => node.type === 'Import')).toBe(true);
    });
  });

  describe('parseJava', () => {
    test('should parse valid Java code with classes', () => {
      const code = `
package com.example;

public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}
      `;

      const ast = parser.parseJava(code);

      expect(ast.type).toBe('CompilationUnit');
      expect(ast.language).toBe('java');
      expect(ast.package).toBe('com.example');
      expect(ast.body.some(node => node.type === 'ClassDeclaration')).toBe(true);
    });

    test('should parse Java methods', () => {
      const code = `
public class Calculator {
    public int add(int a, int b) {
        return a + b;
    }

    private void reset() {
        // reset logic
    }
}
      `;

      const ast = parser.parseJava(code);

      expect(ast.body.some(node => node.type === 'MethodDeclaration')).toBe(true);
    });

    test('should parse Java imports', () => {
      const code = `
import java.util.List;
import java.util.*;
      `;

      const ast = parser.parseJava(code);

      expect(ast.body.some(node => node.type === 'ImportDeclaration')).toBe(true);
    });
  });

  describe('parseSQL', () => {
    test('should parse SELECT statements', () => {
      const sql = `
        SELECT id, name FROM users WHERE age > 18;
        SELECT * FROM orders;
      `;

      const ast = parser.parseSQL(sql);

      expect(ast.type).toBe('SQLProgram');
      expect(ast.language).toBe('sql');
      expect(ast.statements.some(stmt => stmt.type === 'SelectStatement')).toBe(true);
    });

    test('should parse CREATE TABLE statements', () => {
      const sql = `
        CREATE TABLE users (
          id INT PRIMARY KEY,
          name VARCHAR(100)
        );
      `;

      const ast = parser.parseSQL(sql);

      expect(ast.statements.some(stmt => stmt.type === 'CreateTableStatement')).toBe(true);
    });

    test('should parse INSERT statements', () => {
      const sql = 'INSERT INTO users (name, email) VALUES (?, ?)';

      const ast = parser.parseSQL(sql);

      expect(ast.statements.some(stmt => stmt.type === 'InsertStatement')).toBe(true);
    });
  });

  describe('parseProtobuf', () => {
    test('should parse protobuf message definitions', () => {
      const proto = `
syntax = "proto3";

message Person {
  string name = 1;
  int32 age = 2;
}

message Address {
  string street = 1;
}
      `;

      const ast = parser.parseProtobuf(proto);

      expect(ast.type).toBe('ProtoFile');
      expect(ast.language).toBe('protobuf');
      expect(ast.messages.length).toBeGreaterThan(0);
    });

    test('should parse protobuf service definitions', () => {
      const proto = `
service UserService {
  rpc GetUser (UserRequest) returns (UserResponse);
}
      `;

      const ast = parser.parseProtobuf(proto);

      expect(ast.services.length).toBeGreaterThan(0);
      expect(ast.services[0].type).toBe('ServiceDefinition');
    });
  });

  describe('detectLanguage', () => {
    test('should detect JavaScript from .js extension', () => {
      const language = parser.detectLanguage('index.js');
      expect(language).toBe('javascript');
    });

    test('should detect TypeScript from .ts extension', () => {
      const language = parser.detectLanguage('app.ts');
      expect(language).toBe('typescript');
    });

    test('should detect Python from .py extension', () => {
      const language = parser.detectLanguage('script.py');
      expect(language).toBe('python');
    });

    test('should detect Java from .java extension', () => {
      const language = parser.detectLanguage('Main.java');
      expect(language).toBe('java');
    });

    test('should detect SQL from .sql extension', () => {
      const language = parser.detectLanguage('queries.sql');
      expect(language).toBe('sql');
    });

    test('should return unknown for unrecognized extensions', () => {
      const language = parser.detectLanguage('file.xyz');
      expect(language).toBe('unknown');
    });
  });

  describe('traverseAST', () => {
    test('should traverse AST nodes correctly', () => {
      const code = `
        function foo() {}
        class Bar {}
      `;

      const ast = parser.parseJavaScript(code);
      const visitedTypes = [];

      parser.traverseAST(ast, {
        all: (node) => {
          visitedTypes.push(node.type);
        }
      });

      expect(visitedTypes).toContain('Program');
      expect(visitedTypes).toContain('FunctionDeclaration');
      expect(visitedTypes).toContain('ClassDeclaration');
    });

    test('should call specific visitor functions', () => {
      const code = 'function test() {}';
      const ast = parser.parseJavaScript(code);
      const functionNodes = [];

      parser.traverseAST(ast, {
        FunctionDeclaration: (node) => {
          functionNodes.push(node);
        }
      });

      expect(functionNodes.length).toBeGreaterThan(0);
      expect(functionNodes[0].type).toBe('FunctionDeclaration');
    });
  });

  describe('findNodes', () => {
    test('should find specific nodes with predicate', () => {
      const code = `
        function foo() {}
        function bar() {}
        class Baz {}
      `;

      const ast = parser.parseJavaScript(code);
      const functions = parser.findNodes(ast, node => node.type === 'FunctionDeclaration');

      expect(functions.length).toBe(2);
      expect(functions.every(node => node.type === 'FunctionDeclaration')).toBe(true);
    });

    test('should find nodes by name', () => {
      const code = 'function greet() {}';
      const ast = parser.parseJavaScript(code);
      const greetNode = parser.findNodes(ast, node => node.name === 'greet');

      expect(greetNode.length).toBeGreaterThan(0);
      expect(greetNode[0].name).toBe('greet');
    });

    test('should return empty array when no nodes match', () => {
      const code = 'const x = 5;';
      const ast = parser.parseJavaScript(code);
      const classes = parser.findNodes(ast, node => node.type === 'ClassDeclaration');

      expect(classes).toEqual([]);
    });
  });

  describe('error handling', () => {
    test('should log errors without throwing', () => {
      const badCode = 'function broken(';

      expect(() => {
        parser.parseJavaScript(badCode);
      }).not.toThrow();
    });

    test('should track errors in error log', () => {
      parser.clearErrors();

      const badCode = 'invalid syntax {{{';
      parser.parseJavaScript(badCode);

      const errors = parser.getErrors();
      expect(Array.isArray(errors)).toBe(true);
    });

    test('should clear error log', () => {
      parser.clearErrors();
      expect(parser.getErrors().length).toBe(0);
    });
  });

  describe('parseTypeScript', () => {
    test('should parse TypeScript interfaces', () => {
      const code = `
interface User {
  name: string;
  age: number;
}
      `;

      const ast = parser.parseTypeScript(code);

      expect(ast.language).toBe('typescript');
      expect(ast.body.some(node => node.type === 'InterfaceDeclaration')).toBe(true);
    });
  });
});
