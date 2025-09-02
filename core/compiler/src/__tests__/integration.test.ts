import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LightfastCompiler } from '../index.js';
import {
  createTempDir,
  cleanupDir,
  writeFile,
  fixtures,
  delay,
  waitFor,
  createTestProject
} from '../test-utils/index.js';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

describe('Integration Tests', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  describe('End-to-End Compilation Flow', () => {
    it('should compile a complete project with dependencies', async () => {
      // Create a project structure
      createTestProject(tempDir, {
        'lightfast.config.ts': fixtures.withRelativeImportsConfig,
        'helper.js': fixtures.helperFile,
        'utils/index.js': fixtures.utilsFile
      });

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      const result = await compiler.compile();

      expect(result.errors).toHaveLength(0);
      expect(result.outputPath).toBeTruthy();
      
      // Verify output contains all expected content
      const output = readFileSync(result.outputPath, 'utf-8');
      expect(output).toContain('with-imports');
      expect(output).toContain('helper.getData');
      expect(output).toContain('utils.processor');
    });

    it('should handle multi-file watch with cache invalidation', async () => {
      createTestProject(tempDir, {
        'lightfast.config.ts': fixtures.withRelativeImportsConfig,
        'helper.js': fixtures.helperFile,
        'utils/index.js': fixtures.utilsFile
      });

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      
      // Initial compilation
      const result1 = await compiler.compile();
      expect(result1.fromCache).toBe(false);

      // Second compilation should use cache
      const result2 = await compiler.compile();
      expect(result2.fromCache).toBe(true);

      // Modify a dependency
      await delay(10);
      writeFile(
        join(tempDir, 'helper.js'),
        fixtures.helperFile.replace('test: true', 'test: false')
      );

      // Should invalidate cache and recompile
      const result3 = await compiler.compile();
      expect(result3.fromCache).toBe(false);
    });

    it('should compile and bundle for deployment', async () => {
      const compiler = new LightfastCompiler({
        baseDir: tempDir,
        generateBundles: true
      });

      writeFile(
        join(tempDir, 'lightfast.config.ts'),
        fixtures.simpleConfig
      );

      const result = await compiler.compile();

      expect(result.errors).toHaveLength(0);
      expect(result.bundles).toBeDefined();
      expect(result.bundles!.length).toBeGreaterThan(0);

      // Verify bundle structure
      const bundle = result.bundles![0]!;
      expect(bundle.id).toBe('main');
      expect(existsSync(bundle.filepath)).toBe(true);

      const bundleContent = readFileSync(bundle.filepath, 'utf-8');
      expect(bundleContent).toContain('Lightfast Agent Bundle');
      expect(bundleContent).toContain('test-config');
    });

    it('should handle TypeScript with complex types', async () => {
      const complexConfig = `
        interface AgentConfig {
          name: string;
          tools: string[];
          model: 'gpt-4' | 'claude-3';
        }

        const createAgent = (config: AgentConfig) => config;

        export default {
          name: 'typed-config',
          agent: createAgent({
            name: 'Assistant',
            tools: ['search', 'calculate'],
            model: 'gpt-4'
          })
        };
      `;

      writeFile(join(tempDir, 'lightfast.config.ts'), complexConfig);

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      const result = await compiler.compile();

      expect(result.errors).toHaveLength(0);
      
      const output = readFileSync(result.outputPath, 'utf-8');
      expect(output).toContain('typed-config');
      expect(output).toContain('Assistant');
    });

    it('should compile JSX/TSX configurations', async () => {
      writeFile(
        join(tempDir, 'lightfast.config.tsx'),
        fixtures.jsxConfig
      );

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      const result = await compiler.compile();

      expect(result.errors).toHaveLength(0);
      expect(result.outputPath).toContain('.mjs');
      
      const output = readFileSync(result.outputPath, 'utf-8');
      expect(output).toContain('jsx-config');
    });

    it('should handle environment-specific configurations', async () => {
      const envConfig = `
        const isDev = process.env.NODE_ENV === 'development';
        
        export default {
          name: isDev ? 'dev-config' : 'prod-config',
          debug: isDev,
          apiUrl: process.env.API_URL || 'https://api.example.com'
        };
      `;

      writeFile(join(tempDir, 'lightfast.config.ts'), envConfig);

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      const result = await compiler.compile();

      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Cache Behavior Integration', () => {
    it('should maintain cache consistency across compilations', async () => {
      const compiler = new LightfastCompiler({ baseDir: tempDir });
      
      writeFile(
        join(tempDir, 'lightfast.config.ts'),
        fixtures.simpleConfig
      );

      // Multiple compilations
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(await compiler.compile());
      }

      // First should compile, rest should use cache
      expect(results[0]!.fromCache).toBe(false);
      results.slice(1).forEach(result => {
        expect(result.fromCache).toBe(true);
      });

      // All should produce the same output
      const outputs = results.map(r => readFileSync(r.outputPath, 'utf-8'));
      outputs.forEach(output => {
        expect(output).toBe(outputs[0]);
      });
    });

    it('should share cache between compiler instances', async () => {
      writeFile(
        join(tempDir, 'lightfast.config.ts'),
        fixtures.simpleConfig
      );

      // First compiler instance
      const compiler1 = new LightfastCompiler({ baseDir: tempDir });
      const result1 = await compiler1.compile();
      expect(result1.fromCache).toBe(false);

      // Second compiler instance should use cache from first
      const compiler2 = new LightfastCompiler({ baseDir: tempDir });
      const result2 = await compiler2.compile();
      expect(result2.fromCache).toBe(true);
    });

    it('should handle cache corruption gracefully', async () => {
      const compiler = new LightfastCompiler({ baseDir: tempDir });
      
      writeFile(
        join(tempDir, 'lightfast.config.ts'),
        fixtures.simpleConfig
      );

      // First compilation
      await compiler.compile();

      // Corrupt the cache file
      const cacheFile = join(tempDir, '.lightfast', 'cache-metadata.json');
      writeFile(cacheFile, 'corrupted {]');

      // Should recover and recompile
      const result = await compiler.compile();
      expect(result.errors).toHaveLength(0);
      expect(result.fromCache).toBe(false);
    });
  });

  describe('Watch Mode Integration', () => {
    it('should detect and recompile on config changes', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      
      const compilations: any[] = [];
      const watcher = compiler.watch({
        onCompile: (result) => {
          compilations.push(result);
        }
      });

      // Trigger changes
      await delay(100);
      writeFile(configPath, fixtures.simpleConfig.replace('1.0.0', '1.0.1'));
      
      await delay(100);
      writeFile(configPath, fixtures.simpleConfig.replace('1.0.0', '1.0.2'));

      await waitFor(() => compilations.length >= 2, 1000);

      expect(compilations.length).toBeGreaterThanOrEqual(2);
      compilations.forEach(result => {
        expect(result.errors).toHaveLength(0);
      });

      watcher.close();
    });

    it('should handle rapid file changes efficiently', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      
      let compilationCount = 0;
      let lastResult: any;
      
      const watcher = compiler.watch({
        onCompile: (result) => {
          compilationCount++;
          lastResult = result;
        }
      });

      // Rapid changes
      for (let i = 0; i < 10; i++) {
        await delay(10);
        writeFile(configPath, fixtures.simpleConfig.replace('1.0.0', `1.0.${i}`));
      }

      await delay(500);

      // Should batch/debounce changes
      expect(compilationCount).toBeLessThan(10);
      expect(lastResult.errors).toHaveLength(0);

      watcher.close();
    });
  });

  describe('Bundle Generation Integration', () => {
    it('should generate complete deployment package', async () => {
      const compiler = new LightfastCompiler({
        baseDir: tempDir,
        generateBundles: false // Start without bundles
      });

      writeFile(
        join(tempDir, 'lightfast.config.ts'),
        fixtures.largeConfig
      );

      // First compile without bundles
      const compileResult = await compiler.compile();
      expect(compileResult.bundles).toBeUndefined();

      // Then generate bundles on demand
      const bundleResult = await compiler.generateDeploymentBundles();

      expect(bundleResult.bundles).toBeDefined();
      expect(bundleResult.bundles.length).toBeGreaterThan(0);
      expect(bundleResult.outputDir).toContain('.lightfast/dist');

      // Verify bundle integrity
      const bundle = bundleResult.bundles[0];
      expect(bundle).toBeDefined();
      const bundleContent = readFileSync(bundle!.filepath, 'utf-8');
      
      expect(bundleContent).toContain('large-config');
      expect(bundleContent).toContain('agent99');
      expect(bundleContent).toContain(bundle!.hash);
    });

    it('should generate consistent bundles across compilations', async () => {
      writeFile(
        join(tempDir, 'lightfast.config.ts'),
        fixtures.simpleConfig
      );

      const compiler = new LightfastCompiler({ baseDir: tempDir });

      // Generate bundles multiple times
      const result1 = await compiler.generateDeploymentBundles();
      const result2 = await compiler.generateDeploymentBundles();

      // Should produce identical bundles
      expect(result1.bundles[0]).toBeDefined();
      expect(result2.bundles[0]).toBeDefined();
      expect(result1.bundles[0]?.hash).toBe(result2.bundles[0]?.hash);
      expect(result1.bundles[0]?.metadata.id).toBe(result2.bundles[0]?.metadata.id);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle monorepo with shared dependencies', async () => {
      createTestProject(tempDir, {
        'packages/shared/index.ts': `
          export const sharedConfig = {
            version: '1.0.0',
            features: ['auth', 'logging']
          };
        `,
        'packages/shared/utils.ts': `
          export const formatName = (name: string) => name.toUpperCase();
        `,
        'apps/main/lightfast.config.ts': `
          import { sharedConfig } from '../../packages/shared/index.js';
          import { formatName } from '../../packages/shared/utils.js';
          
          export default {
            name: formatName('main-app'),
            ...sharedConfig
          };
        `
      });

      const compiler = new LightfastCompiler({
        baseDir: join(tempDir, 'apps/main')
      });

      const result = await compiler.compile();
      
      expect(result.errors).toHaveLength(0);
      const output = readFileSync(result.outputPath, 'utf-8');
      // The compiled output should contain the formatName function call
      // but not the executed result (that happens at runtime)
      expect(output).toContain('formatName');
      expect(output).toContain('main-app');
      expect(output).toContain('sharedConfig');
    });

    it('should compile with async configuration', async () => {
      const asyncConfig = `
        const loadConfig = async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return {
            name: 'async-config',
            loaded: true
          };
        };
        
        export default await loadConfig();
      `;

      writeFile(join(tempDir, 'lightfast.config.ts'), asyncConfig);

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      const result = await compiler.compile();

      expect(result.errors).toHaveLength(0);
    });

    it('should handle circular dependencies gracefully', async () => {
      createTestProject(tempDir, {
        'lightfast.config.ts': `
          import { helperA } from './a.js';
          export default { name: 'circular', data: helperA() };
        `,
        'a.js': `
          import { helperB } from './b.js';
          export const helperA = () => ({ a: true, b: helperB() });
        `,
        'b.js': `
          import { helperA } from './a.js';
          export const helperB = () => ({ b: true });
        `
      });

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      const result = await compiler.compile();

      // Should compile despite circular dependency
      expect(result.outputPath).toBeTruthy();
    });

    it('should compile with dynamic imports', async () => {
      // Note: Dynamic imports with runtime-computed paths are preserved in output
      // but the paths themselves aren't resolved during compilation
      const dynamicConfig = `
        const loadFeature = async (name: string) => {
          // Dynamic import is preserved as-is in the output
          const module = await import('./features/' + name + '.js');
          return module.default;
        };
        
        export default {
          name: 'dynamic-config',
          loadFeature
        };
      `;

      writeFile(join(tempDir, 'lightfast.config.ts'), dynamicConfig);

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      const result = await compiler.compile();

      // Dynamic imports with string concatenation are marked as external
      // This produces an error but still generates output
      expect(result.outputPath).toBeTruthy();
      
      if (result.outputPath) {
        const output = readFileSync(result.outputPath, 'utf-8');
        expect(output).toContain('dynamic-config');
        expect(output).toContain('loadFeature');
        // The dynamic import with concatenation is preserved
        expect(output).toMatch(/import.*\+/);
      }
    });
  });
});