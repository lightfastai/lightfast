import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LightfastCompiler } from '../index.js';
import { transpileConfig } from '../transpiler.js';
import { CacheManager } from '../cache.js';
import { BundleGenerator } from '../bundler.js';
import {
  createTempDir,
  cleanupDir,
  writeFile,
  createTestProject,
  delay
} from '../test-utils/index.js';
import { join } from 'node:path';
import { chmod, constants } from 'node:fs';
import { promisify } from 'node:util';

const chmodAsync = promisify(chmod);

describe('Error Scenarios', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  describe('File System Errors', () => {
    it('should handle missing configuration file', async () => {
      const compiler = new LightfastCompiler({ baseDir: tempDir });
      const result = await compiler.compile();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('No configuration file found');
      expect(result.outputPath).toBe('');
    });

    it('should handle non-existent config path', async () => {
      const compiler = new LightfastCompiler({ baseDir: tempDir });
      const result = await compiler.compile({
        configPath: join(tempDir, 'non-existent.ts')
      });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.fromCache).toBe(false);
    });

    it('should handle permission errors gracefully', async function() {
      // Skip on Windows as permission handling is different
      if (process.platform === 'win32') {
        this.skip();
        return;
      }

      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, 'export default { name: "test" };');

      // Remove read permission
      await chmodAsync(configPath, 0o000);

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      const result = await compiler.validateConfigFile(configPath);

      expect(result.isValid).toBe(false);

      // Restore permissions for cleanup
      await chmodAsync(configPath, 0o644);
    });

    it('should handle cache directory creation failure', () => {
      // Mock file system to simulate failure
      const originalMkdirSync = require('fs').mkdirSync;
      require('fs').mkdirSync = vi.fn().mockImplementation((path: string) => {
        if (path.includes('.lightfast')) {
          throw new Error('Permission denied');
        }
        return originalMkdirSync(path);
      });

      expect(() => {
        new CacheManager({ baseDir: tempDir });
      }).toThrow();

      // Restore
      require('fs').mkdirSync = originalMkdirSync;
    });
  });

  describe('Syntax and Compilation Errors', () => {
    it('should handle TypeScript syntax errors', async () => {
      const invalidConfig = `
        export default {
          name: 'broken'
          version: '1.0.0' // Missing comma above
        };
      `;

      writeFile(join(tempDir, 'lightfast.config.ts'), invalidConfig);

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      const result = await compiler.compile();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.outputPath).toBe('');
      expect(result.transpileResult.errors.length).toBeGreaterThan(0);
    });

    it('should handle missing imports', async () => {
      const configWithMissingImport = `
        import { nonExistent } from './missing-module.js';
        
        export default {
          name: 'config',
          data: nonExistent()
        };
      `;

      writeFile(join(tempDir, 'lightfast.config.ts'), configWithMissingImport);

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      const result = await compiler.compile();

      expect(result.outputPath).toBeTruthy(); // Should still compile
      // Runtime error would occur when loading
    });

    it('should handle invalid JSX syntax', async () => {
      const invalidJSX = `
        const Component = () => <div>Unclosed
        
        export default {
          name: 'jsx-error',
          component: Component
        };
      `;

      writeFile(join(tempDir, 'lightfast.config.tsx'), invalidJSX);

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      const result = await compiler.compile();

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle type errors in strict mode', async () => {
      const typeErrorConfig = `
        interface Config {
          name: string;
          version: number;
        }
        
        const config: Config = {
          name: 'test',
          version: '1.0.0' // Type error: string instead of number
        };
        
        export default config;
      `;

      writeFile(join(tempDir, 'lightfast.config.ts'), typeErrorConfig);

      // TypeScript compilation doesn't enforce types by default in esbuild
      // This would compile but potentially cause runtime issues
      const compiler = new LightfastCompiler({ baseDir: tempDir });
      const result = await compiler.compile();

      // esbuild doesn't do type checking, so this should compile
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Cache Errors', () => {
    it('should handle corrupted cache JSON', async () => {
      const cacheFile = join(tempDir, '.lightfast', 'cache.json');
      const cacheDir = join(tempDir, '.lightfast');
      require('fs').mkdirSync(cacheDir, { recursive: true });
      writeFile(cacheFile, 'invalid json {]');

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      
      writeFile(join(tempDir, 'lightfast.config.ts'), 'export default { name: "test" };');
      
      const result = await compiler.compile();
      expect(result.errors).toHaveLength(0);
      expect(result.fromCache).toBe(false);
    });

    it('should handle missing cached files', async () => {
      const compiler = new LightfastCompiler({ baseDir: tempDir });
      
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, 'export default { name: "test" };');

      // First compilation
      await compiler.compile();

      // Delete cached output file
      const cacheDir = join(tempDir, '.lightfast', 'compiled');
      require('fs').rmSync(cacheDir, { recursive: true, force: true });

      // Should recompile when cached file is missing
      const result = await compiler.compile();
      expect(result.fromCache).toBe(false);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle cache write failures', () => {
      const originalWriteFileSync = require('fs').writeFileSync;
      require('fs').writeFileSync = vi.fn().mockImplementation((path: string) => {
        if (path.includes('cache.json')) {
          throw new Error('Disk full');
        }
        return originalWriteFileSync(path);
      });

      const cacheManager = new CacheManager({ baseDir: tempDir });
      const sourcePath = join(tempDir, 'test.ts');
      writeFile(sourcePath, 'const a = 1;');

      // Should handle write failure gracefully
      expect(() => {
        cacheManager.setCached(sourcePath, 'var a = 1;');
      }).toThrow();

      // Restore
      require('fs').writeFileSync = originalWriteFileSync;
    });
  });

  describe('Bundle Generation Errors', () => {
    it('should handle bundle generation failure', async () => {
      const compiler = new LightfastCompiler({
        baseDir: tempDir,
        generateBundles: true
      });

      // Mock bundle generator to throw error
      const originalGenerate = BundleGenerator.prototype.generateBundles;
      BundleGenerator.prototype.generateBundles = vi.fn().mockRejectedValue(
        new Error('Bundle generation failed')
      );

      writeFile(join(tempDir, 'lightfast.config.ts'), 'export default { name: "test" };');

      const result = await compiler.compile();

      // Should continue without bundles
      expect(result.errors).toHaveLength(0);
      expect(result.bundles).toBeUndefined();

      // Restore
      BundleGenerator.prototype.generateBundles = originalGenerate;
    });

    it('should handle output directory creation failure', () => {
      const originalMkdirSync = require('fs').mkdirSync;
      require('fs').mkdirSync = vi.fn().mockImplementation((path: string) => {
        if (path.includes('dist')) {
          throw new Error('Permission denied');
        }
        return originalMkdirSync(path);
      });

      expect(() => {
        new BundleGenerator({
          baseDir: tempDir,
          outputDir: join(tempDir, 'dist')
        });
      }).toThrow();

      // Restore
      require('fs').mkdirSync = originalMkdirSync;
    });
  });

  describe('Watch Mode Errors', () => {
    it('should handle watch setup failure', () => {
      const compiler = new LightfastCompiler({ baseDir: tempDir });

      let errorCaught = false;
      const watcher = compiler.watch({
        configPath: join(tempDir, 'non-existent.ts'),
        onError: (error) => {
          errorCaught = true;
          expect(error.message).toContain('No configuration file found');
        }
      });

      expect(errorCaught).toBe(true);
      watcher.close();
    });

    it('should handle compilation errors during watch', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, 'export default { name: "valid" };');

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      
      let errorCount = 0;
      const watcher = compiler.watch({
        configPath,
        onError: () => {
          errorCount++;
        }
      });

      // Change to invalid syntax
      await delay(100);
      writeFile(configPath, 'export default { name: "invalid"');

      await delay(200);

      expect(errorCount).toBeGreaterThan(0);
      watcher.close();
    });
  });

  describe('Loading Errors', () => {
    it('should throw when loading fails after compilation', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, 'export default { name: "test" };');

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      
      // Mock dynamic import to fail
      const originalImport = (global as any).import;
      (global as any).import = vi.fn().mockRejectedValue(new Error('Module not found'));

      await expect(
        compiler.compileAndLoad({ configPath })
      ).rejects.toThrow('Failed to load compiled configuration');

      // Restore
      (global as any).import = originalImport;
    });

    it('should handle configs without default export when loading', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, 'export const config = { name: "no-default" };');

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      
      // Should compile successfully
      const compileResult = await compiler.compile({ configPath });
      expect(compileResult.warnings.length).toBeGreaterThan(0);
      
      // Loading would work but might not get expected structure
      // This is a warning, not an error
    });
  });

  describe('Concurrent Operation Errors', () => {
    it('should handle concurrent compilation requests', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, 'export default { name: "test" };');

      const compiler = new LightfastCompiler({ baseDir: tempDir });

      // Launch multiple compilations simultaneously
      const promises = Array(10).fill(null).map(() => 
        compiler.compile({ configPath })
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.errors).toHaveLength(0);
      });

      // Most should be from cache (except first)
      const cachedCount = results.filter(r => r.fromCache).length;
      expect(cachedCount).toBeGreaterThan(5);
    });

    it('should handle concurrent cache operations', async () => {
      const cacheManager = new CacheManager({ baseDir: tempDir });

      const promises = Array(20).fill(null).map((_, i) => {
        const sourcePath = join(tempDir, `test${i}.ts`);
        writeFile(sourcePath, `const a = ${i};`);
        
        return new Promise<void>((resolve) => {
          cacheManager.setCached(sourcePath, `var a = ${i};`);
          resolve();
        });
      });

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });

  describe('Edge Case Errors', () => {
    it('should handle extremely long file paths', async () => {
      const deepPath = join(tempDir, ...Array(20).fill('very-long-directory-name'));
      const configPath = join(deepPath, 'lightfast.config.ts');
      
      createTestProject(deepPath, {
        'lightfast.config.ts': 'export default { name: "deep" };'
      });

      const compiler = new LightfastCompiler({ baseDir: deepPath });
      const result = await compiler.compile();

      expect(result.errors).toHaveLength(0);
    });

    it('should handle special characters in paths', async () => {
      const specialDir = join(tempDir, 'special-chars-@#$%');
      const configPath = join(specialDir, 'lightfast.config.ts');
      
      createTestProject(specialDir, {
        'lightfast.config.ts': 'export default { name: "special" };'
      });

      const compiler = new LightfastCompiler({ baseDir: specialDir });
      const result = await compiler.compile();

      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty configuration patterns', () => {
      const compiler = new LightfastCompiler({
        baseDir: tempDir,
        configPatterns: []
      });

      expect(compiler.getConfigPatterns()).toHaveLength(0);
    });

    it('should handle very large configurations', async () => {
      const largeConfig = `
        export default {
          name: 'large',
          data: '${String("x").repeat(1000000)}'
        };
      `;

      writeFile(join(tempDir, 'lightfast.config.ts'), largeConfig);

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      const result = await compiler.compile();

      expect(result.errors).toHaveLength(0);
      expect(result.outputPath).toBeTruthy();
    });

    it('should handle compilation with circular references in config', async () => {
      const circularConfig = `
        const obj: any = { name: 'circular' };
        obj.self = obj;
        
        export default obj;
      `;

      writeFile(join(tempDir, 'lightfast.config.ts'), circularConfig);

      const compiler = new LightfastCompiler({ baseDir: tempDir });
      const result = await compiler.compile();

      // Should compile (circular reference is a runtime issue)
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Recovery and Resilience', () => {
    it('should recover from transient file system errors', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, 'export default { name: "test" };');

      const compiler = new LightfastCompiler({ baseDir: tempDir });

      // First compilation succeeds
      const result1 = await compiler.compile();
      expect(result1.errors).toHaveLength(0);

      // Temporarily delete config
      require('fs').unlinkSync(configPath);

      // Should fail
      const result2 = await compiler.compile();
      expect(result2.errors.length).toBeGreaterThan(0);

      // Restore config
      writeFile(configPath, 'export default { name: "restored" };');

      // Should work again
      const result3 = await compiler.compile();
      expect(result3.errors).toHaveLength(0);
    });

    it('should continue after bundle generation warning', async () => {
      const compiler = new LightfastCompiler({
        baseDir: tempDir,
        generateBundles: true
      });

      // Mock console.warn to capture warning
      const originalWarn = console.warn;
      let warnCalled = false;
      console.warn = () => {
        warnCalled = true;
      };

      // Mock bundle generator to throw
      const originalGenerate = BundleGenerator.prototype.generateBundles;
      BundleGenerator.prototype.generateBundles = vi.fn().mockRejectedValue(
        new Error('Bundle warning')
      );

      writeFile(join(tempDir, 'lightfast.config.ts'), 'export default { name: "test" };');

      const result = await compiler.compile();

      expect(result.errors).toHaveLength(0);
      expect(warnCalled).toBe(true);

      // Restore
      console.warn = originalWarn;
      BundleGenerator.prototype.generateBundles = originalGenerate;
    });
  });
});