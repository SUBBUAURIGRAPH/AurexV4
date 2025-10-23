/**
 * Unit tests for Language Detector
 *
 * @module language-detector.test
 */

const LanguageDetector = require('../language-detector');
const fs = require('fs');
const path = require('path');

// Mock fs module
jest.mock('fs');

describe('LanguageDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new LanguageDetector();
    jest.clearAllMocks();
  });

  describe('detectLanguageFromFile', () => {
    test('should detect JavaScript from .js file', () => {
      const metadata = detector.detectLanguageFromFile('/path/to/app.js');

      expect(metadata.language).toBe('javascript');
      expect(metadata.type).toBe('script');
      expect(metadata.runtime).toBe('node');
      expect(metadata.extension).toBe('.js');
    });

    test('should detect TypeScript from .ts file', () => {
      const metadata = detector.detectLanguageFromFile('/path/to/app.ts');

      expect(metadata.language).toBe('typescript');
      expect(metadata.type).toBe('script');
      expect(metadata.runtime).toBe('node');
    });

    test('should detect Python from .py file', () => {
      const metadata = detector.detectLanguageFromFile('/path/to/script.py');

      expect(metadata.language).toBe('python');
      expect(metadata.type).toBe('script');
      expect(metadata.runtime).toBe('python');
    });

    test('should detect Java from .java file', () => {
      const metadata = detector.detectLanguageFromFile('/path/to/Main.java');

      expect(metadata.language).toBe('java');
      expect(metadata.type).toBe('class');
      expect(metadata.runtime).toBe('jvm');
    });

    test('should detect SQL from .sql file', () => {
      const metadata = detector.detectLanguageFromFile('/path/to/queries.sql');

      expect(metadata.language).toBe('sql');
      expect(metadata.type).toBe('query');
    });

    test('should detect Protobuf from .proto file', () => {
      const metadata = detector.detectLanguageFromFile('/path/to/user.proto');

      expect(metadata.language).toBe('protobuf');
      expect(metadata.type).toBe('definition');
    });

    test('should detect Go from .go file', () => {
      const metadata = detector.detectLanguageFromFile('/path/to/main.go');

      expect(metadata.language).toBe('go');
      expect(metadata.type).toBe('package');
    });

    test('should detect Rust from .rs file', () => {
      const metadata = detector.detectLanguageFromFile('/path/to/lib.rs');

      expect(metadata.language).toBe('rust');
      expect(metadata.type).toBe('module');
    });

    test('should detect C++ from .cpp file', () => {
      const metadata = detector.detectLanguageFromFile('/path/to/main.cpp');

      expect(metadata.language).toBe('cpp');
      expect(metadata.type).toBe('source');
      expect(metadata.runtime).toBe('native');
    });

    test('should return unknown for unrecognized extensions', () => {
      const metadata = detector.detectLanguageFromFile('/path/to/file.xyz');

      expect(metadata.language).toBe('unknown');
      expect(metadata.type).toBe('file');
    });

    test('should include file path and name in metadata', () => {
      const filePath = '/path/to/app.js';
      const metadata = detector.detectLanguageFromFile(filePath);

      expect(metadata.path).toBe(filePath);
      expect(metadata.filename).toBe('app.js');
    });
  });

  describe('detectProjectType', () => {
    test('should detect Node.js project from package.json', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockImplementation((path) => path.includes('package.json'));
      fs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { react: '^18.0.0', express: '^4.18.0' }
      }));

      const metadata = detector.detectProjectType(projectRoot);

      expect(metadata.primaryLanguage).toBe('javascript');
      expect(metadata.projectType).toBe('node');
      expect(metadata.buildSystem).toBe('npm');
      expect(metadata.frameworks).toContain('react');
      expect(metadata.frameworks).toContain('express');
    });

    test('should detect Python project from pyproject.toml', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockImplementation((path) => path.includes('pyproject.toml'));

      const metadata = detector.detectProjectType(projectRoot);

      expect(metadata.primaryLanguage).toBe('python');
      expect(metadata.projectType).toBe('python');
      expect(metadata.buildSystem).toBe('pip');
    });

    test('should detect Java Maven project from pom.xml', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockImplementation((path) => path.includes('pom.xml'));
      fs.readFileSync.mockReturnValue('<project><dependencies><dependency>spring-boot</dependency></dependencies></project>');

      const metadata = detector.detectProjectType(projectRoot);

      expect(metadata.primaryLanguage).toBe('java');
      expect(metadata.projectType).toBe('java');
      expect(metadata.buildSystem).toBe('maven');
      expect(metadata.frameworks).toContain('spring-boot');
    });

    test('should detect Java Gradle project from build.gradle', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockImplementation((path) => path.includes('build.gradle'));

      const metadata = detector.detectProjectType(projectRoot);

      expect(metadata.primaryLanguage).toBe('java');
      expect(metadata.buildSystem).toBe('gradle');
    });

    test('should detect Go project from go.mod', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockImplementation((path) => path.includes('go.mod'));

      const metadata = detector.detectProjectType(projectRoot);

      expect(metadata.primaryLanguage).toBe('go');
      expect(metadata.projectType).toBe('go');
      expect(metadata.buildSystem).toBe('go-modules');
    });

    test('should detect Rust project from Cargo.toml', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockImplementation((path) => path.includes('Cargo.toml'));

      const metadata = detector.detectProjectType(projectRoot);

      expect(metadata.primaryLanguage).toBe('rust');
      expect(metadata.projectType).toBe('rust');
      expect(metadata.buildSystem).toBe('cargo');
    });

    test('should detect monorepo from lerna.json', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockImplementation((path) =>
        path.includes('lerna.json') || path.includes('package.json')
      );
      fs.readFileSync.mockReturnValue(JSON.stringify({}));

      const metadata = detector.detectProjectType(projectRoot);

      expect(metadata.isMonorepo).toBe(true);
    });

    test('should detect Python frameworks from requirements.txt', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockImplementation((path) =>
        path.includes('requirements.txt') || path.includes('setup.py')
      );
      fs.readFileSync.mockReturnValue('django==4.0\nflask==2.0\nfastapi==0.95');

      const metadata = detector.detectProjectType(projectRoot);

      expect(metadata.frameworks).toContain('django');
      expect(metadata.frameworks).toContain('flask');
      expect(metadata.frameworks).toContain('fastapi');
    });

    test('should use cache for repeated calls', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockReturnValue(false);

      detector.detectProjectType(projectRoot);
      detector.detectProjectType(projectRoot);

      // Should only call fs operations once due to caching
      expect(fs.existsSync).toHaveBeenCalled();
    });
  });

  describe('detectTestFramework', () => {
    test('should detect Jest from package.json', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockImplementation((path) => path.includes('package.json'));
      fs.readFileSync.mockReturnValue(JSON.stringify({
        devDependencies: { jest: '^29.0.0' }
      }));

      const framework = detector.detectTestFramework(projectRoot);

      expect(framework).toBe('jest');
    });

    test('should detect Mocha from .mocharc.json', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockImplementation((path) =>
        path.includes('package.json') || path.includes('.mocharc.json')
      );
      fs.readFileSync.mockReturnValue(JSON.stringify({
        devDependencies: { mocha: '^10.0.0' }
      }));

      const framework = detector.detectTestFramework(projectRoot);

      expect(framework).toBe('mocha');
    });

    test('should detect pytest from pytest.ini', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockImplementation((path) => path.includes('pytest.ini'));

      const framework = detector.detectTestFramework(projectRoot);

      expect(framework).toBe('pytest');
    });

    test('should detect JUnit from pom.xml', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockImplementation((path) => path.includes('pom.xml'));
      fs.readFileSync.mockReturnValue('<project><dependencies><dependency>junit-jupiter</dependency></dependencies></project>');

      const framework = detector.detectTestFramework(projectRoot);

      expect(framework).toBe('junit5');
    });

    test('should detect go-test for Go projects', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockImplementation((path) => path.includes('go.mod'));

      const framework = detector.detectTestFramework(projectRoot);

      expect(framework).toBe('go-test');
    });

    test('should detect cargo-test for Rust projects', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockImplementation((path) => path.includes('Cargo.toml'));

      const framework = detector.detectTestFramework(projectRoot);

      expect(framework).toBe('cargo-test');
    });

    test('should return null for projects without test frameworks', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockReturnValue(false);

      const framework = detector.detectTestFramework(projectRoot);

      expect(framework).toBeNull();
    });
  });

  describe('detectBuildSystem', () => {
    test('should detect npm from package.json', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockImplementation((path) => path.includes('package.json'));

      const buildSystem = detector.detectBuildSystem(projectRoot);

      expect(buildSystem).toBe('npm');
    });

    test('should detect maven from pom.xml', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockImplementation((path) => path.includes('pom.xml'));

      const buildSystem = detector.detectBuildSystem(projectRoot);

      expect(buildSystem).toBe('maven');
    });

    test('should detect gradle from build.gradle', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockImplementation((path) => path.includes('build.gradle'));

      const buildSystem = detector.detectBuildSystem(projectRoot);

      expect(buildSystem).toBe('gradle');
    });

    test('should detect cargo from Cargo.toml', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockImplementation((path) => path.includes('Cargo.toml'));

      const buildSystem = detector.detectBuildSystem(projectRoot);

      expect(buildSystem).toBe('cargo');
    });

    test('should return null when no build system detected', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockReturnValue(false);

      const buildSystem = detector.detectBuildSystem(projectRoot);

      expect(buildSystem).toBeNull();
    });
  });

  describe('analyzeDirectory', () => {
    test('should analyze directory and count files by language', () => {
      const dirPath = '/path/to/project';

      fs.readdirSync.mockReturnValue([
        { name: 'app.js', isDirectory: () => false, isFile: () => true },
        { name: 'test.py', isDirectory: () => false, isFile: () => true },
        { name: 'Main.java', isDirectory: () => false, isFile: () => true }
      ]);

      const stats = detector.analyzeDirectory(dirPath);

      expect(stats.totalFiles).toBe(3);
      expect(stats.languages.javascript).toBe(1);
      expect(stats.languages.python).toBe(1);
      expect(stats.languages.java).toBe(1);
    });

    test('should skip hidden directories and node_modules', () => {
      const dirPath = '/path/to/project';

      fs.readdirSync.mockReturnValue([
        { name: '.git', isDirectory: () => true, isFile: () => false },
        { name: 'node_modules', isDirectory: () => true, isFile: () => false },
        { name: 'app.js', isDirectory: () => false, isFile: () => true }
      ]);

      const stats = detector.analyzeDirectory(dirPath);

      expect(stats.totalFiles).toBe(1);
    });

    test('should calculate language percentages', () => {
      const dirPath = '/path/to/project';

      fs.readdirSync.mockReturnValue([
        { name: 'app1.js', isDirectory: () => false, isFile: () => true },
        { name: 'app2.js', isDirectory: () => false, isFile: () => true },
        { name: 'test.py', isDirectory: () => false, isFile: () => true }
      ]);

      const stats = detector.analyzeDirectory(dirPath);

      expect(stats.languagePercentages.javascript).toBe('66.67%');
      expect(stats.languagePercentages.python).toBe('33.33%');
    });
  });

  describe('cache management', () => {
    test('should clear cache', () => {
      const projectRoot = '/path/to/project';
      fs.existsSync.mockReturnValue(false);

      detector.detectProjectType(projectRoot);
      detector.clearCache();

      // After clearing cache, should make new fs calls
      detector.detectProjectType(projectRoot);

      expect(fs.existsSync).toHaveBeenCalled();
    });
  });
});
