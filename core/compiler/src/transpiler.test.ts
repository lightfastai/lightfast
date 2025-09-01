import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  transpile, 
  transpileConfig, 
  validateConfig, 
  isTranspilable, 
  getOutputExtension 
} from './transpiler.js';
import { 
  createTempDir, 
  cleanupDir, 
  writeFile, 
  fixtures,
  createTestProject 
} from './test-utils/index.js';
import { join } from 'node:path';

describe('transpiler', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  describe('transpile', () => {
    it('should transpile TypeScript to JavaScript', async () => {
      const sourcePath = join(tempDir, 'test.ts');
      writeFile(sourcePath, fixtures.simpleConfig);

      const result = await transpile({
        sourcePath,
        bundle: true
      });

      expect(result.errors).toHaveLength(0);
      expect(result.code).toBeTruthy();
      expect(result.code).toMatch(/export default|test_default/);
      expect(result.code).toContain('test-config');
    });

    it('should generate source maps when enabled', async () => {
      const sourcePath = join(tempDir, 'test.ts');
      writeFile(sourcePath, fixtures.simpleConfig);

      const result = await transpile({
        sourcePath,
        sourcemap: true,
        bundle: true
      });

      expect(result.errors).toHaveLength(0);
      expect(result.sourcemap).toBeTruthy();
      expect(result.code).toContain('sourceMappingURL');
    });

    it('should not generate source maps when disabled', async () => {
      const sourcePath = join(tempDir, 'test.ts');
      writeFile(sourcePath, fixtures.simpleConfig);

      const result = await transpile({
        sourcePath,
        sourcemap: false,
        bundle: true
      });

      expect(result.errors).toHaveLength(0);
      expect(result.sourcemap).toBeUndefined();
      expect(result.code).not.toContain('sourceMappingURL');
    });

    it('should handle ESM format', async () => {
      const sourcePath = join(tempDir, 'test.ts');
      writeFile(sourcePath, fixtures.simpleConfig);

      const result = await transpile({
        sourcePath,
        format: 'esm',
        bundle: true
      });

      expect(result.errors).toHaveLength(0);
      expect(result.code).toMatch(/export default|test_default/);
    });

    it('should handle CJS format', async () => {
      const sourcePath = join(tempDir, 'test.js');
      writeFile(sourcePath, fixtures.cjsConfig);

      const result = await transpile({
        sourcePath,
        format: 'cjs',
        bundle: true
      });

      expect(result.errors).toHaveLength(0);
      expect(result.code).toBeTruthy();
    });

    it('should handle JSX/TSX files', async () => {
      const sourcePath = join(tempDir, 'test.tsx');
      writeFile(sourcePath, fixtures.jsxConfig);

      const result = await transpile({
        sourcePath,
        bundle: true
      });

      expect(result.errors).toHaveLength(0);
      expect(result.code).toBeTruthy();
      expect(result.code).toContain('jsx-config');
    });

    it('should return errors for invalid syntax', async () => {
      const sourcePath = join(tempDir, 'test.ts');
      writeFile(sourcePath, fixtures.syntaxErrorConfig);

      const result = await transpile({
        sourcePath,
        bundle: true
      });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.code).toBe('');
    });

    it('should return error for non-existent file', async () => {
      const sourcePath = join(tempDir, 'non-existent.ts');

      const result = await transpile({
        sourcePath
      });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Source file not found');
      expect(result.code).toBe('');
    });

    it('should minify output when enabled', async () => {
      const sourcePath = join(tempDir, 'test.ts');
      writeFile(sourcePath, fixtures.simpleConfig);

      const normalResult = await transpile({
        sourcePath,
        minify: false,
        bundle: true
      });

      const minifiedResult = await transpile({
        sourcePath,
        minify: true,
        bundle: true
      });

      expect(minifiedResult.errors).toHaveLength(0);
      expect(minifiedResult.code.length).toBeLessThan(normalResult.code.length);
    });

    it('should keep imports external with packages: external', async () => {
      const sourcePath = join(tempDir, 'test.ts');
      writeFile(sourcePath, fixtures.withDependenciesConfig);

      const result = await transpile({
        sourcePath,
        bundle: true // This enables packages: 'external'
      });

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('import');
      expect(result.code).toContain('zod');
    });

    it('should handle relative imports', async () => {
      createTestProject(tempDir, {
        'config.ts': fixtures.withRelativeImportsConfig,
        'helper.js': fixtures.helperFile,
        'utils/index.js': fixtures.utilsFile
      });

      const result = await transpile({
        sourcePath: join(tempDir, 'config.ts'),
        bundle: true
      });

      expect(result.errors).toHaveLength(0);
      expect(result.code).toBeTruthy();
      expect(result.code).toContain('with-imports');
    });

    it('should include metafile in result', async () => {
      const sourcePath = join(tempDir, 'test.ts');
      writeFile(sourcePath, fixtures.simpleConfig);

      const result = await transpile({
        sourcePath,
        bundle: true
      });

      expect(result.errors).toHaveLength(0);
      expect(result.metafile).toBeTruthy();
      expect(result.metafile).toHaveProperty('inputs');
    });

    it('should apply custom target version', async () => {
      const sourcePath = join(tempDir, 'test.ts');
      writeFile(sourcePath, `
        const asyncFunc = async () => {
          const { default: mod } = await import('./module');
          return mod;
        };
        export default asyncFunc;
      `);

      const result = await transpile({
        sourcePath,
        target: 'es2018',
        bundle: true
      });

      expect(result.errors).toHaveLength(0);
      expect(result.code).toBeTruthy();
    });
  });

  describe('transpileConfig', () => {
    it('should transpile config file with proper defaults', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      const result = await transpileConfig(configPath);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('// Generated by Lightfast CLI');
      expect(result.code).toContain('test-config');
      expect(result.code).toMatch(/export.*default|lightfast_config_default/);
    });

    it('should warn about missing default export', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.noDefaultExportConfig);

      const result = await transpileConfig(configPath);

      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("doesn't have a default export");
    });

    it('should use ESM format by default', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      const result = await transpileConfig(configPath);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toMatch(/export.*default|lightfast_config_default/);
    });

    it('should respect custom options', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      const result = await transpileConfig(configPath, {
        minify: true,
        sourcemap: false
      });

      expect(result.errors).toHaveLength(0);
      expect(result.code).toBeTruthy();
      expect(result.code).not.toContain('sourceMappingURL');
    });

    it('should handle large config files', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.largeConfig);

      const result = await transpileConfig(configPath);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('large-config');
      expect(result.code).toContain('agent99');
    });
  });

  describe('validateConfig', () => {
    it('should validate existing config file', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.simpleConfig);

      const result = await validateConfig(configPath);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report non-existent file as invalid', async () => {
      const configPath = join(tempDir, 'non-existent.ts');

      const result = await validateConfig(configPath);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Configuration file not found');
    });

    it('should report syntax errors as invalid', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.syntaxErrorConfig);

      const result = await validateConfig(configPath);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should include warnings for missing default export', async () => {
      const configPath = join(tempDir, 'lightfast.config.ts');
      writeFile(configPath, fixtures.noDefaultExportConfig);

      const result = await validateConfig(configPath);

      expect(result.isValid).toBe(true); // Still valid, just warning
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('isTranspilable', () => {
    it('should return true for TypeScript files', () => {
      const tsFile = join(tempDir, 'test.ts');
      writeFile(tsFile, 'const a = 1;');
      
      expect(isTranspilable(tsFile)).toBe(true);
    });

    it('should return true for TSX files', () => {
      const tsxFile = join(tempDir, 'test.tsx');
      writeFile(tsxFile, 'const a = <div />;');
      
      expect(isTranspilable(tsxFile)).toBe(true);
    });

    it('should return true for JavaScript files', () => {
      const jsFile = join(tempDir, 'test.js');
      writeFile(jsFile, 'const a = 1;');
      
      expect(isTranspilable(jsFile)).toBe(true);
    });

    it('should return true for JSX files', () => {
      const jsxFile = join(tempDir, 'test.jsx');
      writeFile(jsxFile, 'const a = <div />;');
      
      expect(isTranspilable(jsxFile)).toBe(true);
    });

    it('should return false for non-transpilable files', () => {
      const mdFile = join(tempDir, 'test.md');
      writeFile(mdFile, '# Test');
      
      expect(isTranspilable(mdFile)).toBe(false);
    });

    it('should return false for non-existent files', () => {
      const nonExistent = join(tempDir, 'non-existent.ts');
      
      expect(isTranspilable(nonExistent)).toBe(false);
    });
  });

  describe('getOutputExtension', () => {
    it('should return .mjs for ESM format', () => {
      expect(getOutputExtension('test.ts', 'esm')).toBe('.mjs');
    });

    it('should return .cjs for CJS format', () => {
      expect(getOutputExtension('test.ts', 'cjs')).toBe('.cjs');
    });

    it('should default to .mjs when format not specified', () => {
      expect(getOutputExtension('test.ts')).toBe('.mjs');
    });
  });

  describe('edge cases', () => {
    it('should handle empty file', async () => {
      const sourcePath = join(tempDir, 'empty.ts');
      writeFile(sourcePath, '');

      const result = await transpile({
        sourcePath,
        bundle: true
      });

      expect(result.errors).toHaveLength(0);
      expect(result.code).toBeTruthy();
    });

    it('should handle file with only comments', async () => {
      const sourcePath = join(tempDir, 'comments.ts');
      writeFile(sourcePath, `
        // This is a comment
        /* Multi-line
           comment */
        // Another comment
      `);

      const result = await transpile({
        sourcePath,
        bundle: true
      });

      expect(result.errors).toHaveLength(0);
      expect(result.code).toBeTruthy();
    });

    it('should handle Unicode characters', async () => {
      const sourcePath = join(tempDir, 'unicode.ts');
      writeFile(sourcePath, `
        export default {
          name: '测试配置',
          emoji: '🚀',
          special: '€£¥'
        };
      `);

      const result = await transpile({
        sourcePath,
        bundle: true
      });

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('测试配置');
      expect(result.code).toContain('🚀');
    });
  });
});