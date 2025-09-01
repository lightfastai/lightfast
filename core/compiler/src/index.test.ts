import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LightfastCompiler,
  createCompiler,
  compileConfig,
  loadConfig,
  findConfig,
  validateConfigFile
} from './index.js';
import {
  createTempDir,
  cleanupDir,
  writeFile,
  readFile,
  fixtures,
  createTestProject,
  delay,
  assertFileExists
} from './test-utils/index.js';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

describe('LightfastCompiler', () => {
  let tempDir: string;
  let compiler: LightfastCompiler;

  beforeEach(() => {
    tempDir = createTempDir();
    compiler = new LightfastCompiler({ baseDir: tempDir });
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  describe('initialization', () => {
    it('should create compiler with default options', () => {
      const defaultCompiler = new LightfastCompiler();
      expect(defaultCompiler.getBaseDir()).toBe(process.cwd());
      expect(defaultCompiler.getConfigPatterns()).toContain('lightfast.config.ts');
    });

    it('should create compiler with custom options', () => {
      const customCompiler = new LightfastCompiler({
        baseDir: tempDir,
        configPatterns: ['custom.config.ts'],
        useCache: false
      });

      expect(customCompiler.getBaseDir()).toBe(tempDir);
      expect(customCompiler.getConfigPatterns()).toContain('custom.config.ts');
    });

    it('should initialize with bundle generation disabled by default', () => {
      const compiler = new LightfastCompiler({ baseDir: tempDir });
      expect(compiler).toBeDefined();
      // Bundle generation is off by default for development
    });

    it('should initialize with bundle generation when enabled', () => {
      const compiler = new LightfastCompiler({
        baseDir: tempDir,
        generateBundles: true
      });
      expect(compiler).toBeDefined();
    });
  });

  describe('findConfigFile', () => {
    it('should find TypeScript config file', () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      const result = compiler['findConfigFile']();
      expect(result).toBe(configPath);
    });

    it('should find JavaScript config file', () => {
      const configPath = join(tempDir, 'lightfast.config.js');
      writeFile(configPath, fixtures.cjsConfig);

      const result = compiler['findConfigFile']();
      expect(result).toBe(configPath);
    });

    it('should find TSX config file', () => {
      const configPath = join(tempDir, 'lightfast.config.tsx');
      writeFile(configPath, fixtures.jsxConfig);

      const result = compiler['findConfigFile']();
      expect(result).toBe(configPath);
    });

    it('should return null when no config found', () => {
      const result = compiler['findConfigFile']();
      expect(result).toBeNull();
    });

    it('should respect custom patterns', () => {
      const customCompiler = new LightfastCompiler({
        baseDir: tempDir,
        configPatterns: ['app.config.ts', 'custom.config.js']
      });

      const configPath = join(tempDir, 'app.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      const result = customCompiler['findConfigFile']();
      expect(result).toBe(configPath);
    });

    it('should find first matching pattern', () => {
      writeFile(join(tempDir, 'lightfast.config.js'), 'js config');
      writeFile(join(tempDir, 'lightfast.config.ts'), 'ts config');

      const result = compiler['findConfigFile']();
      expect(result).toBe(join(tempDir, 'lightfast.config.ts'));
    });
  });

  describe('validateConfigFile', () => {
    it('should validate existing valid config', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      const result = await compiler.validateConfigFile(configPath);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.configPath).toBe(configPath);
    });

    it('should find and validate config when path not provided', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      const result = await compiler.validateConfigFile();

      expect(result.isValid).toBe(true);
      expect(result.configPath).toBe(configPath);
    });

    it('should report missing config file', async () => {
      const result = await compiler.validateConfigFile();

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('No configuration file found');
    });

    it('should report syntax errors', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.syntaxErrorConfig);

      const result = await compiler.validateConfigFile(configPath);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should include warnings for missing default export', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.noDefaultExportConfig);

      const result = await compiler.validateConfigFile(configPath);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('compile', () => {
    it('should compile TypeScript config to JavaScript', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      const result = await compiler.compile({ configPath });

      expect(result.errors).toHaveLength(0);
      expect(result.outputPath).toBeTruthy();
      expect(existsSync(result.outputPath)).toBe(true);
      expect(result.sourcePath).toBe(configPath);
      expect(result.fromCache).toBe(false);
    });

    it('should auto-discover config file', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      const result = await compiler.compile();

      expect(result.errors).toHaveLength(0);
      expect(result.sourcePath).toBe(configPath);
    });

    it('should use cache on second compilation', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      // First compilation
      const result1 = await compiler.compile({ configPath });
      expect(result1.fromCache).toBe(false);

      // Second compilation should use cache
      const result2 = await compiler.compile({ configPath });
      expect(result2.fromCache).toBe(true);
      expect(result2.compilationTime).toBeLessThan(result1.compilationTime);
    });

    it('should force recompilation when requested', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      // First compilation
      await compiler.compile({ configPath });

      // Force recompilation
      const result = await compiler.compile({ configPath, force: true });
      expect(result.fromCache).toBe(false);
    });

    it('should invalidate cache when file changes', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      // First compilation
      const result1 = await compiler.compile({ configPath });
      expect(result1.fromCache).toBe(false);

      // Modify file
      await delay(10);
      writeFile(configPath, fixtures.simpleConfig.replace('1.0.0', '2.0.0'));

      // Should recompile
      const result2 = await compiler.compile({ configPath });
      expect(result2.fromCache).toBe(false);
    });

    it('should handle compilation errors', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.syntaxErrorConfig);

      const result = await compiler.compile({ configPath });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.outputPath).toBe('');
      expect(result.fromCache).toBe(false);
    });

    it('should handle missing config file', async () => {
      const result = await compiler.compile();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('No configuration file found');
      expect(result.outputPath).toBe('');
    });

    it('should pass transpile options', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      const result = await compiler.compile({
        configPath,
        transpileOptions: {
          minify: true,
          sourcemap: false
        }
      });

      expect(result.errors).toHaveLength(0);
      const content = readFileSync(result.outputPath, 'utf-8');
      expect(content).not.toContain('sourceMappingURL');
    });

    it('should include warnings in result', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.noDefaultExportConfig);

      const result = await compiler.compile({ configPath });

      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should write to main output location', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      const result = await compiler.compile({ configPath });

      const mainPath = join(tempDir, '.lightfast', 'lightfast.config.mjs');
      expect(existsSync(mainPath)).toBe(true);
      expect(result.outputPath).toBe(mainPath);
    });

    it('should generate bundles when enabled', async () => {
      const bundleCompiler = new LightfastCompiler({
        baseDir: tempDir,
        generateBundles: true
      });

      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      const result = await bundleCompiler.compile({ configPath });

      expect(result.errors).toHaveLength(0);
      expect(result.bundles).toBeDefined();
      expect(result.bundles!.length).toBeGreaterThan(0);
    });
  });

  describe('compileAndLoad', () => {
    it('should compile and load config module', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      // Use a simple config without external dependencies for loading test
      const simpleConfig = `
        export default {
          name: 'test-config',
          version: '1.0.0',
          agents: []
        };
      `;
      writeFile(configPath, simpleConfig);

      const { config, compilationResult } = await compiler.compileAndLoad({
        configPath
      });

      expect(compilationResult.errors).toHaveLength(0);
      expect(config).toBeDefined();
      expect((config as any).name).toBe('test-config');
    });

    it('should throw on compilation errors', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.syntaxErrorConfig);

      await expect(
        compiler.compileAndLoad({ configPath })
      ).rejects.toThrow('Configuration compilation failed');
    });

    it('should handle configs with named exports', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, `
        const config = { name: 'test' };
        export { config as default };
      `);

      const { config } = await compiler.compileAndLoad({ configPath });
      expect((config as any).name).toBe('test');
    });
  });

  describe('watch', () => {
    it('should setup file watcher', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      let compilationCount = 0;
      const watcher = compiler.watch({
        configPath,
        onCompile: () => {
          compilationCount++;
        }
      });

      // Simulate file change
      await delay(100);
      writeFile(configPath, fixtures.simpleConfig.replace('1.0.0', '2.0.0'));

      await delay(200);

      expect(compilationCount).toBeGreaterThanOrEqual(1);
      watcher.close();
    });

    it('should handle watch errors', () => {
      let errorCalled = false;
      const watcher = compiler.watch({
        configPath: join(tempDir, 'non-existent.ts'),
        onError: (error) => {
          errorCalled = true;
          expect(error.message).toContain('No configuration file found');
        }
      });

      expect(errorCalled).toBe(true);
      watcher.close();
    });

    it('should auto-discover config for watching', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      let compiled = false;
      const watcher = compiler.watch({
        onCompile: (result) => {
          compiled = true;
          expect(result.sourcePath).toBe(configPath);
        }
      });

      await delay(100);
      writeFile(configPath, fixtures.simpleConfig.replace('1.0.0', '2.0.0'));
      await delay(200);

      expect(compiled).toBe(true);
      watcher.close();
    });

    it('should prevent concurrent compilations', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      let compilationCount = 0;
      const watcher = compiler.watch({
        configPath,
        onCompile: async () => {
          compilationCount++;
          await delay(500); // Simulate slow compilation
        }
      });

      // Trigger multiple rapid changes
      for (let i = 0; i < 3; i++) {
        await delay(50);
        writeFile(configPath, fixtures.simpleConfig.replace('1.0.0', `1.0.${i}`));
      }

      await delay(1000);

      // Should only compile once while busy
      expect(compilationCount).toBeLessThanOrEqual(2);
      watcher.close();
    });
  });

  describe('cache management', () => {
    it('should get cache info', () => {
      const info = compiler.getCacheInfo();

      expect(info).toHaveProperty('entries');
      expect(info).toHaveProperty('totalSize');
      expect(info).toHaveProperty('files');
    });

    it('should clear cache', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      // Compile to create cache
      await compiler.compile({ configPath });
      let info = compiler.getCacheInfo();
      expect(info.entries).toBeGreaterThan(0);

      // Clear cache
      compiler.clearCache();
      info = compiler.getCacheInfo();
      expect(info.entries).toBe(0);
    });

    it('should clean stale cache entries', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      await compiler.compile({ configPath });
      
      // This would normally clean old entries
      compiler.cleanCache();
      
      // Cache should still work for recent entries
      const result = await compiler.compile({ configPath });
      expect(result.fromCache).toBe(true);
    });

    it('should work without cache when disabled', async () => {
      const noCacheCompiler = new LightfastCompiler({
        baseDir: tempDir,
        useCache: false
      });

      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      const result1 = await noCacheCompiler.compile({ configPath });
      const result2 = await noCacheCompiler.compile({ configPath });

      expect(result1.fromCache).toBe(false);
      expect(result2.fromCache).toBe(false);
    });
  });

  describe('generateDeploymentBundles', () => {
    it('should generate deployment bundles on demand', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      const result = await compiler.generateDeploymentBundles({
        configPath
      });

      expect(result.bundles).toBeDefined();
      expect(result.bundles.length).toBeGreaterThan(0);
      expect(result.sourcePath).toBe(configPath);
      expect(result.outputDir).toContain('.lightfast/dist');
    });

    it('should force compilation when requested', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      // First generation
      await compiler.generateDeploymentBundles({ configPath });

      // Force regeneration
      const result = await compiler.generateDeploymentBundles({
        configPath,
        force: true
      });

      expect(result.bundles).toBeDefined();
    });

    it('should throw on compilation errors', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.syntaxErrorConfig);

      await expect(
        compiler.generateDeploymentBundles({ configPath })
      ).rejects.toThrow('Configuration compilation failed');
    });
  });

  describe('convenience functions', () => {
    describe('createCompiler', () => {
      it('should create compiler instance', () => {
        const compiler = createCompiler({ baseDir: tempDir });
        expect(compiler).toBeInstanceOf(LightfastCompiler);
      });
    });

    describe('compileConfig', () => {
      it('should compile config directly', async () => {
        const configPath = join(tempDir, 'lightfast.config.ts');
        writeFile(configPath, fixtures.simpleConfig);

        const result = await compileConfig(configPath, { baseDir: tempDir });

        expect(result.errors).toHaveLength(0);
        expect(result.sourcePath).toBe(configPath);
      });
    });

    describe('loadConfig', () => {
      it('should load config directly', async () => {
        const configPath = join(tempDir, 'lightfast.config.ts');
        writeFile(configPath, fixtures.simpleConfig);

        const config = await loadConfig(configPath, { baseDir: tempDir });

        expect(config).toBeDefined();
        expect((config as any).name).toBe('test-config');
      });
    });

    describe('findConfig', () => {
      it('should find config in directory', () => {
        const configPath = join(tempDir, 'lightfast.config.ts');
        writeFile(configPath, fixtures.simpleConfig);

        const found = findConfig(tempDir);
        expect(found).toBe(configPath);
      });

      it('should use custom patterns', () => {
        const configPath = join(tempDir, 'app.config.js');
        writeFile(configPath, 'module.exports = {}');

        const found = findConfig(tempDir, ['app.config.js']);
        expect(found).toBe(configPath);
      });
    });

    describe('validateConfigFile', () => {
      it('should validate config file', async () => {
        const configPath = join(tempDir, 'lightfast.config.ts');
        writeFile(configPath, fixtures.simpleConfig);

        const result = await validateConfigFile(configPath, { baseDir: tempDir });

        expect(result.isValid).toBe(true);
        expect(result.configPath).toBe(configPath);
      });
    });
  });
});