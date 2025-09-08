import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBundleGenerator, BundleGenerator } from './bundler.js';
import type { TranspileResult } from './transpiler.js';
import { 
  createTempDir, 
  cleanupDir
} from './test-utils/index.js';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

describe('BundleGenerator', () => {
  let tempDir: string;
  let bundleGenerator: BundleGenerator;

  beforeEach(() => {
    tempDir = createTempDir();
    bundleGenerator = new BundleGenerator({
      baseDir: tempDir,
      outputDir: join(tempDir, 'dist'),
      compilerVersion: '1.0.0-test'
    });
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  describe('initialization', () => {
    it('should create output directory on initialization', () => {
      const outputDir = join(tempDir, 'dist');
      expect(existsSync(outputDir)).toBe(true);
    });

    it('should use default compiler version if not provided', () => {
      const _generator = new BundleGenerator({
        baseDir: tempDir
      });
      
      // Should have a default version
      expect(_generator).toBeDefined();
    });

    it('should use custom output directory', () => {
      const customOutputDir = join(tempDir, 'custom-output');
      const _generator = new BundleGenerator({
        baseDir: tempDir,
        outputDir: customOutputDir
      });
      
      expect(existsSync(customOutputDir)).toBe(true);
    });
  });

  describe('generateBundles', () => {
    const mockTranspileResult: TranspileResult = {
      code: `
import { createAgent, gateway } from 'lightfast';

const assistantAgent = createAgent({
  name: 'Assistant Agent',
  description: 'A helpful AI assistant',
  model: gateway('gpt-4'),
  tools: {
    search: searchTool,
    calculate: calcTool
  }
});

export default {
  name: 'test-config',
  version: '1.0.0',
  agents: {
    assistant: assistantAgent
  }
};
      `.trim(),
      warnings: [],
      errors: [],
      metafile: {
        inputs: {
          'lightfast.config.ts': {}
        }
      }
    };

    it('should generate agent-specific bundles for agents', async () => {
      const sourcePath = join(tempDir, 'lightfast.config.ts');
      
      const bundles = await bundleGenerator.generateBundles(
        mockTranspileResult,
        sourcePath
      );
      
      expect(bundles).toHaveLength(1);
      
      const bundle = bundles[0]!;
      expect(bundle.id).toBe('assistant');
      expect(bundle.filename).toMatch(/^assistant\.[a-f0-9]{8}\.js$/);
      expect(existsSync(bundle.filepath)).toBe(true);
      
      const content = readFileSync(bundle.filepath, 'utf-8');
      expect(content).toContain('Lightfast Agent Bundle');
      expect(content).toContain('assistant');
      expect(content).toContain(bundle.hash);
      expect(content).toContain('AST-generated');
    });

    it('should include metadata in bundle', async () => {
      const sourcePath = join(tempDir, 'lightfast.config.ts');
      
      const bundles = await bundleGenerator.generateBundles(
        mockTranspileResult,
        sourcePath
      );
      
      const bundle = bundles[0]!;
      expect(bundle.metadata).toMatchObject({
        id: 'assistant',
        hash: expect.any(String),
        name: 'assistant',
        tools: expect.arrayContaining(['search', 'calculate']),
        models: expect.arrayContaining(['gpt-4']),
        compiledAt: expect.any(String),
        compilerVersion: '1.0.0-test'
      });
    });

    it('should generate consistent hash for same content', async () => {
      const sourcePath = join(tempDir, 'lightfast.config.ts');
      
      const bundles1 = await bundleGenerator.generateBundles(
        mockTranspileResult,
        sourcePath
      );
      
      const bundles2 = await bundleGenerator.generateBundles(
        mockTranspileResult,
        sourcePath
      );
      
      expect(bundles1[0]).toBeDefined();
      expect(bundles2[0]).toBeDefined();
      expect(bundles1[0]?.hash).toBe(bundles2[0]?.hash);
    });

    it('should generate different hash for different content', async () => {
      const sourcePath = join(tempDir, 'lightfast.config.ts');
      
      const result1 = { ...mockTranspileResult, code: 'export default { v: 1 }' };
      const result2 = { ...mockTranspileResult, code: 'export default { v: 2 }' };
      
      const bundles1 = await bundleGenerator.generateBundles(result1, sourcePath);
      const bundles2 = await bundleGenerator.generateBundles(result2, sourcePath);
      
      expect(bundles1[0]).toBeDefined();
      expect(bundles2[0]).toBeDefined();
      expect(bundles1[0]?.hash).not.toBe(bundles2[0]?.hash);
    });

    it('should handle multiple agents in future', async () => {
      const multiAgentResult: TranspileResult = {
        code: `
import { createAgent } from 'lightfast';

const agent1 = createAgent({
  name: 'Agent 1',
  model: 'gpt-4'
});

const agent2 = createAgent({
  name: 'Agent 2', 
  model: 'claude-3'
});

const agent3 = createAgent({
  name: 'Agent 3',
  model: 'gpt-3.5-turbo'
});

export default {
  agents: {
    agent1: agent1,
    agent2: agent2,
    agent3: agent3
  }
};
        `.trim(),
        warnings: [],
        errors: []
      };
      
      const sourcePath = join(tempDir, 'lightfast.config.ts');
      
      // Now generates individual bundles for each agent
      const bundles = await bundleGenerator.generateBundles(
        multiAgentResult,
        sourcePath
      );
      
      expect(bundles).toHaveLength(3);
      expect(bundles.map(b => b.id)).toEqual(['agent1', 'agent2', 'agent3']);
      
      // Each bundle should have the correct metadata
      const agent1Bundle = bundles.find(b => b.id === 'agent1');
      expect(agent1Bundle?.metadata.models).toContain('gpt-4');
      
      const agent2Bundle = bundles.find(b => b.id === 'agent2');
      expect(agent2Bundle?.metadata.models).toContain('claude-3');
    });

    it('should include source map reference if available', async () => {
      const resultWithSourcemap: TranspileResult = {
        ...mockTranspileResult,
        sourcemap: '{"version":3,"sources":["test.ts"]}'
      };
      
      const sourcePath = join(tempDir, 'lightfast.config.ts');
      
      const bundles = await bundleGenerator.generateBundles(
        resultWithSourcemap,
        sourcePath
      );
      
      // Source map should be written as separate file
      const mapPath = bundles[0]!.filepath + '.map';
      expect(existsSync(mapPath)).toBe(true);
      
      const mapContent = readFileSync(mapPath, 'utf-8');
      expect(mapContent).toBe(resultWithSourcemap.sourcemap);
    });

    it('should report bundle size accurately', async () => {
      const sourcePath = join(tempDir, 'lightfast.config.ts');
      
      const bundles = await bundleGenerator.generateBundles(
        mockTranspileResult,
        sourcePath
      );
      
      const bundle = bundles[0]!;
      const actualSize = require('fs').statSync(bundle.filepath).size;
      
      expect(bundle.size).toBe(actualSize);
      expect(bundle.size).toBeGreaterThan(0);
    });

    it('should handle empty transpile result', async () => {
      const emptyResult: TranspileResult = {
        code: '',
        warnings: [],
        errors: []
      };
      
      const sourcePath = join(tempDir, 'lightfast.config.ts');
      
      const bundles = await bundleGenerator.generateBundles(
        emptyResult,
        sourcePath
      );
      
      expect(bundles).toHaveLength(1);
      expect(existsSync(bundles[0]!.filepath)).toBe(true);
    });

    it('should preserve original code in bundle', async () => {
      const sourcePath = join(tempDir, 'lightfast.config.ts');
      
      const bundles = await bundleGenerator.generateBundles(
        mockTranspileResult,
        sourcePath
      );
      
      const content = readFileSync(bundles[0]!.filepath, 'utf-8');
      
      // Should contain the agent-specific code
      expect(content).toContain('assistant');
      expect(content).toContain('Assistant Agent');
      expect(content).toContain('createAgent');
      
      // Should be wrapped in new bundle format
      expect(content).toContain('export const targetAgentId');
      expect(content).toContain('export function getTargetAgent');
      expect(content).toContain('AST-generated');
    });

    it('should include timestamp in metadata', async () => {
      const beforeTime = new Date().toISOString();
      
      const sourcePath = join(tempDir, 'lightfast.config.ts');
      const bundles = await bundleGenerator.generateBundles(
        mockTranspileResult,
        sourcePath
      );
      
      const afterTime = new Date().toISOString();
      
      const compiledAt = bundles[0]!.metadata.compiledAt;
      expect(new Date(compiledAt).getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime());
      expect(new Date(compiledAt).getTime()).toBeLessThanOrEqual(new Date(afterTime).getTime());
    });
  });

  describe('createBundleGenerator', () => {
    it('should create bundle generator with factory function', () => {
      const generator = createBundleGenerator({
        baseDir: tempDir
      });
      
      expect(generator).toBeInstanceOf(BundleGenerator);
    });

    it('should pass options through factory', () => {
      const customDir = join(tempDir, 'custom');
      const _generator = createBundleGenerator({
        baseDir: tempDir,
        outputDir: customDir,
        compilerVersion: '2.0.0'
      });
      
      expect(existsSync(customDir)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle very large transpiled code', async () => {
      const largeCode = 'const x = ' + JSON.stringify('a'.repeat(100000)) + ';';
      const largeResult: TranspileResult = {
        code: largeCode,
        warnings: [],
        errors: []
      };
      
      const sourcePath = join(tempDir, 'large.config.ts');
      
      const bundles = await bundleGenerator.generateBundles(
        largeResult,
        sourcePath
      );
      
      expect(bundles).toHaveLength(1);
      expect(bundles[0]!.size).toBeGreaterThan(100000);
      
      const content = readFileSync(bundles[0]!.filepath, 'utf-8');
      expect(content).toContain('a'.repeat(1000)); // Check partial content
    });

    it('should handle special characters in code', async () => {
      const specialResult: TranspileResult = {
        code: `
export default {
  name: '测试配置 🚀',
  special: '\n\t\r',
  unicode: '€£¥'
};
        `.trim(),
        warnings: [],
        errors: []
      };
      
      const sourcePath = join(tempDir, 'special.config.ts');
      
      const bundles = await bundleGenerator.generateBundles(
        specialResult,
        sourcePath
      );
      
      const content = readFileSync(bundles[0]!.filepath, 'utf-8');
      expect(content).toContain('测试配置 🚀');
      expect(content).toContain('€£¥');
    });

    it('should handle concurrent bundle generation', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        const result: TranspileResult = {
          code: `export default { id: ${i} };`,
          warnings: [],
          errors: []
        };
        
        promises.push(
          bundleGenerator.generateBundles(
            result,
            join(tempDir, `config${i}.ts`)
          )
        );
      }
      
      const allBundles = await Promise.all(promises);
      
      expect(allBundles).toHaveLength(5);
      allBundles.forEach((bundles, i) => {
        expect(bundles).toHaveLength(1);
        const content = readFileSync(bundles[0]!.filepath, 'utf-8');
        expect(content).toContain(`id: ${i}`);
      });
    });

    it('should handle malformed agent configurations gracefully', async () => {
      const result: TranspileResult = {
        code: `
export default {
  agents: {
    'agent/with/slashes': {},
    'agent:with:colons': {},
    'agent with spaces': {}
  }
};
        `.trim(),
        warnings: [],
        errors: []
      };
      
      const sourcePath = join(tempDir, 'config.ts');
      
      const bundles = await bundleGenerator.generateBundles(
        result,
        sourcePath
      );
      
      // Should generate fallback main bundle when no createAgent calls found
      expect(bundles).toHaveLength(1);
      expect(bundles[0]!.id).toBe('main');
      expect(bundles[0]!.filename).toMatch(/^[a-zA-Z0-9._-]+$/);
    });

    it('should handle missing metafile gracefully', async () => {
      const resultNoMeta: TranspileResult = {
        code: `export default { name: 'test-config' };`,
        warnings: [],
        errors: []
        // No metafile
      };
      
      const sourcePath = join(tempDir, 'config.ts');
      
      const bundles = await bundleGenerator.generateBundles(
        resultNoMeta,
        sourcePath
      );
      
      expect(bundles).toHaveLength(1);
      expect(bundles[0]!.metadata).toBeDefined();
    });
  });
});