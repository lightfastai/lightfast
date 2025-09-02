import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CacheManager, createCacheManager } from './cache.js';
import { 
  createTempDir, 
  cleanupDir, 
  writeFile, 
  delay
} from './test-utils/index.js';
import { join } from 'node:path';
import { existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs';

describe('CacheManager', () => {
  let tempDir: string;
  let cacheManager: CacheManager;

  beforeEach(() => {
    tempDir = createTempDir();
    cacheManager = new CacheManager({ baseDir: tempDir });
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  describe('initialization', () => {
    it('should create cache directories on initialization', () => {
      const cacheDir = join(tempDir, '.lightfast');
      const compiledDir = join(cacheDir, 'compiled');
      
      expect(existsSync(cacheDir)).toBe(true);
      expect(existsSync(compiledDir)).toBe(true);
    });

    it('should use custom cache directory name', () => {
      const _customCacheManager = new CacheManager({
        baseDir: tempDir,
        cacheDir: '.custom-cache'
      });
      
      const cacheDir = join(tempDir, '.custom-cache');
      expect(existsSync(cacheDir)).toBe(true);
    });

    it('should handle existing cache directories', () => {
      // Create directories manually first
      const cacheDir = join(tempDir, '.lightfast');
      const compiledDir = join(cacheDir, 'compiled');
      mkdirSync(compiledDir, { recursive: true });
      
      // Should not throw when directories already exist
      const _manager = new CacheManager({ baseDir: tempDir });
      expect(existsSync(cacheDir)).toBe(true);
    });
  });

  describe('cache operations', () => {
    it('should check if file is cached', () => {
      const sourcePath = join(tempDir, 'test.ts');
      writeFile(sourcePath, 'const a = 1;');
      
      // Initially not cached
      expect(cacheManager.isCached(sourcePath)).toBe(false);
      
      // Cache the file
      cacheManager.setCached(sourcePath, 'var a = 1;');
      
      // Now it should be cached
      expect(cacheManager.isCached(sourcePath)).toBe(true);
    });

    it('should store and retrieve cached files', () => {
      const sourcePath = join(tempDir, 'test.ts');
      const compiledCode = 'var a = 1;';
      const sourceMap = '{"version":3}';
      
      writeFile(sourcePath, 'const a = 1;');
      
      const cachedPath = cacheManager.setCached(
        sourcePath, 
        compiledCode, 
        sourceMap
      );
      
      expect(existsSync(cachedPath)).toBe(true);
      
      const content = readFileSync(cachedPath, 'utf-8');
      expect(content).toBe(compiledCode);
      
      // Check source map
      const mapPath = cachedPath + '.map';
      expect(existsSync(mapPath)).toBe(true);
      const mapContent = readFileSync(mapPath, 'utf-8');
      expect(mapContent).toBe(sourceMap);
    });

    it('should invalidate cache when source file changes', async () => {
      const sourcePath = join(tempDir, 'test.ts');
      writeFile(sourcePath, 'const a = 1;');
      
      // Cache the file
      cacheManager.setCached(sourcePath, 'var a = 1;');
      expect(cacheManager.isCached(sourcePath)).toBe(true);
      
      // Wait a bit to ensure different timestamp
      await delay(10);
      
      // Modify the source file
      writeFile(sourcePath, 'const a = 2;');
      
      // Cache should be invalidated
      expect(cacheManager.isCached(sourcePath)).toBe(false);
    });

    it('should track dependencies in metafile', () => {
      const sourcePath = join(tempDir, 'main.ts');
      const depPath = join(tempDir, 'dep.ts');
      
      writeFile(sourcePath, 'import "./dep";');
      writeFile(depPath, 'export const x = 1;');
      
      const metafile = {
        inputs: {
          'main.ts': {},
          'dep.ts': {}
        }
      };
      
      // Cache with dependencies
      cacheManager.setCached(sourcePath, 'code', undefined, metafile);
      
      // Should be cached with valid dependencies
      expect(cacheManager.isCached(sourcePath, metafile)).toBe(true);
    });

    it('should invalidate cache when dependency changes', async () => {
      const sourcePath = join(tempDir, 'main.ts');
      const depPath = join(tempDir, 'dep.ts');
      
      writeFile(sourcePath, 'import "./dep";');
      writeFile(depPath, 'export const x = 1;');
      
      const metafile = {
        inputs: {
          [sourcePath]: {},
          [depPath]: {}
        }
      };
      
      // Cache with dependencies
      cacheManager.setCached(sourcePath, 'code', undefined, metafile);
      expect(cacheManager.isCached(sourcePath, metafile)).toBe(true);
      
      // Wait and modify dependency
      await delay(10);
      writeFile(depPath, 'export const x = 2;');
      
      // Cache should be invalidated
      expect(cacheManager.isCached(sourcePath, metafile)).toBe(false);
    });

    it('should get cached output path', () => {
      const sourcePath = join(tempDir, 'test.ts');
      writeFile(sourcePath, 'const a = 1;');
      
      // Before caching
      expect(cacheManager.getCachedOutputPath(sourcePath)).toBeNull();
      
      // After caching
      const cachedPath = cacheManager.setCached(sourcePath, 'var a = 1;');
      expect(cacheManager.getCachedOutputPath(sourcePath)).toBe(cachedPath);
    });

    it('should write main output file', () => {
      const code = 'export default { test: true };';
      cacheManager.writeMainOutput(code);
      
      const mainPath = cacheManager.getMainOutputPath();
      expect(existsSync(mainPath)).toBe(true);
      expect(readFileSync(mainPath, 'utf-8')).toBe(code);
    });
  });

  describe('cache management', () => {
    it('should clear all cache', () => {
      const sourcePath1 = join(tempDir, 'test1.ts');
      const sourcePath2 = join(tempDir, 'test2.ts');
      
      writeFile(sourcePath1, 'const a = 1;');
      writeFile(sourcePath2, 'const b = 2;');
      
      cacheManager.setCached(sourcePath1, 'var a = 1;');
      cacheManager.setCached(sourcePath2, 'var b = 2;');
      
      expect(cacheManager.isCached(sourcePath1)).toBe(true);
      expect(cacheManager.isCached(sourcePath2)).toBe(true);
      
      cacheManager.clearCache();
      
      expect(cacheManager.isCached(sourcePath1)).toBe(false);
      expect(cacheManager.isCached(sourcePath2)).toBe(false);
    });

    it('should get cache statistics', () => {
      const sourcePath1 = join(tempDir, 'test1.ts');
      const sourcePath2 = join(tempDir, 'test2.ts');
      
      writeFile(sourcePath1, 'const a = 1;');
      writeFile(sourcePath2, 'const b = 2;');
      
      cacheManager.setCached(sourcePath1, 'var a = 1;');
      cacheManager.setCached(sourcePath2, 'var b = 2;');
      
      const stats = cacheManager.getCacheStats();
      
      expect(stats.entries).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.oldestEntry).toBeLessThanOrEqual(Date.now());
      expect(stats.newestEntry).toBeLessThanOrEqual(Date.now());
      expect(stats.files).toHaveLength(2);
    });

    it('should clean stale cache entries', async () => {
      const sourcePath1 = join(tempDir, 'test1.ts');
      const sourcePath2 = join(tempDir, 'test2.ts');
      
      writeFile(sourcePath1, 'const a = 1;');
      writeFile(sourcePath2, 'const b = 2;');
      
      // Cache first file
      cacheManager.setCached(sourcePath1, 'var a = 1;');
      
      // Wait a bit to ensure different timestamps
      await delay(50);
      
      // Cache second file
      cacheManager.setCached(sourcePath2, 'var b = 2;');
      
      // Override the max age for testing (40ms - between the two files)
      const originalMaxAge = (cacheManager as any).maxCacheAge;
      (cacheManager as any).maxCacheAge = 40;
      
      // Wait just a bit more so first is older than 40ms but second is not
      await delay(5);
      
      cacheManager.cleanStaleEntries();
      
      // First should be cleaned (>40ms old), second should remain (<40ms old)
      expect(cacheManager.isCached(sourcePath1)).toBe(false);
      expect(cacheManager.isCached(sourcePath2)).toBe(true);
      
      // Restore max age
      (cacheManager as any).maxCacheAge = originalMaxAge;
    });

    it('should handle corrupted cache file', () => {
      const cacheFile = join(tempDir, '.lightfast', 'cache.json');
      writeFile(cacheFile, 'invalid json {]');
      
      // Should handle gracefully and start fresh
      const manager = new CacheManager({ baseDir: tempDir });
      
      const sourcePath = join(tempDir, 'test.ts');
      writeFile(sourcePath, 'const a = 1;');
      
      expect(manager.isCached(sourcePath)).toBe(false);
      
      // Should be able to cache normally
      manager.setCached(sourcePath, 'var a = 1;');
      expect(manager.isCached(sourcePath)).toBe(true);
    });
  });

  describe('file operations', () => {
    it('should handle source files with special characters', () => {
      const sourcePath = join(tempDir, 'test-file_2024.ts');
      writeFile(sourcePath, 'const a = 1;');
      
      const cachedPath = cacheManager.setCached(sourcePath, 'var a = 1;');
      expect(existsSync(cachedPath)).toBe(true);
      expect(cacheManager.isCached(sourcePath)).toBe(true);
    });

    it('should handle deep directory structures', () => {
      const sourcePath = join(tempDir, 'src', 'components', 'ui', 'button.ts');
      writeFile(sourcePath, 'const a = 1;');
      
      const cachedPath = cacheManager.setCached(sourcePath, 'var a = 1;');
      expect(existsSync(cachedPath)).toBe(true);
      expect(cacheManager.isCached(sourcePath)).toBe(true);
    });

    it('should handle concurrent cache operations', async () => {
      const promises: Promise<string>[] = [];
      
      for (let i = 0; i < 10; i++) {
        const sourcePath = join(tempDir, `test${i}.ts`);
        writeFile(sourcePath, `const a = ${i};`);
        
        promises.push(
          new Promise((resolve) => {
            const path = cacheManager.setCached(sourcePath, `var a = ${i};`);
            resolve(path);
          })
        );
      }
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach(path => {
        expect(existsSync(path)).toBe(true);
      });
    });
  });

  describe('createCacheManager', () => {
    it('should create cache manager with default options', () => {
      const manager = createCacheManager();
      expect(manager).toBeInstanceOf(CacheManager);
    });

    it('should create cache manager with custom options', () => {
      const manager = createCacheManager({
        baseDir: tempDir,
        cacheDir: '.custom'
      });
      
      expect(manager).toBeInstanceOf(CacheManager);
      expect(existsSync(join(tempDir, '.custom'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty compiled code', () => {
      const sourcePath = join(tempDir, 'test.ts');
      writeFile(sourcePath, 'const a = 1;');
      
      const cachedPath = cacheManager.setCached(sourcePath, '');
      expect(existsSync(cachedPath)).toBe(true);
      expect(readFileSync(cachedPath, 'utf-8')).toBe('');
    });

    it('should handle very large files', () => {
      const sourcePath = join(tempDir, 'large.ts');
      const largeContent = 'const a = 1;\n'.repeat(10000);
      writeFile(sourcePath, largeContent);
      
      const compiledContent = 'var a = 1;\n'.repeat(10000);
      const cachedPath = cacheManager.setCached(sourcePath, compiledContent);
      
      expect(existsSync(cachedPath)).toBe(true);
      expect(readFileSync(cachedPath, 'utf-8')).toBe(compiledContent);
    });

    it('should handle rapid cache invalidation', async () => {
      const sourcePath = join(tempDir, 'test.ts');
      
      for (let i = 0; i < 5; i++) {
        writeFile(sourcePath, `const a = ${i};`);
        cacheManager.setCached(sourcePath, `var a = ${i};`);
        await delay(10);
      }
      
      // Should have the latest version cached
      expect(cacheManager.isCached(sourcePath)).toBe(true);
    });

    it('should handle missing source file in cache check', () => {
      const sourcePath = join(tempDir, 'non-existent.ts');
      
      // Should return false for non-existent source
      expect(cacheManager.isCached(sourcePath)).toBe(false);
    });

    it('should handle cache directory deletion during runtime', () => {
      const sourcePath = join(tempDir, 'test.ts');
      writeFile(sourcePath, 'const a = 1;');
      
      cacheManager.setCached(sourcePath, 'var a = 1;');
      expect(cacheManager.isCached(sourcePath)).toBe(true);
      
      // Delete cache directory
      const cacheDir = join(tempDir, '.lightfast');
      rmSync(cacheDir, { recursive: true, force: true });
      
      // Should handle gracefully
      expect(cacheManager.isCached(sourcePath)).toBe(false);
      
      // Should recreate and work normally
      cacheManager.setCached(sourcePath, 'var a = 2;');
      expect(cacheManager.isCached(sourcePath)).toBe(true);
    });
  });
});