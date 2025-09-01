import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

/**
 * Creates a unique temporary directory for testing
 */
export function createTempDir(): string {
  const id = randomBytes(8).toString('hex');
  const dir = join(tmpdir(), `lightfast-compiler-test-${id}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Cleans up a directory and all its contents
 */
export function cleanupDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Writes a file ensuring the directory exists
 */
export function writeFile(path: string, content: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, content, 'utf-8');
}

/**
 * Reads a file if it exists
 */
export function readFile(path: string): string | null {
  if (!existsSync(path)) {
    return null;
  }
  return readFileSync(path, 'utf-8');
}

/**
 * Test fixture generators
 */
export const fixtures = {
  /**
   * Simple TypeScript config that exports a default object
   */
  simpleConfig: `
import { createLightfast } from 'lightfast';

export default createLightfast({
  name: 'test-config',
  version: '1.0.0',
  agents: []
});
`.trim(),

  /**
   * TypeScript config with JSX
   */
  jsxConfig: `
import React from 'react';

const Component = () => <div>Test</div>;

export default {
  name: 'jsx-config',
  component: Component
};
`.trim(),

  /**
   * Config with syntax error
   */
  syntaxErrorConfig: `
export default {
  name: 'broken-config'
  version: '1.0.0' // Missing comma above
};
`.trim(),

  /**
   * Config without default export
   */
  noDefaultExportConfig: `
export const config = {
  name: 'no-default',
  version: '1.0.0'
};
`.trim(),

  /**
   * Config with external dependencies
   */
  withDependenciesConfig: `
import { z } from 'zod';
import path from 'node:path';

const schema = z.object({
  name: z.string()
});

export default {
  name: 'with-deps',
  basePath: path.join(__dirname, 'test'),
  schema
};
`.trim(),

  /**
   * Config with relative imports
   */
  withRelativeImportsConfig: `
import { helper } from './helper.js';
import { utils } from './utils/index.js';

export default {
  name: 'with-imports',
  data: helper.getData(),
  processedBy: utils.processor
};
`.trim(),

  /**
   * Helper file for relative imports
   */
  helperFile: `
export const helper = {
  getData: () => ({ test: true })
};
`.trim(),

  /**
   * Utils file for relative imports
   */
  utilsFile: `
export const utils = {
  processor: 'test-processor'
};
`.trim(),

  /**
   * CommonJS format config
   */
  cjsConfig: `
const config = {
  name: 'cjs-config',
  version: '1.0.0'
};

module.exports = config;
`.trim(),

  /**
   * Large config for performance testing
   */
  largeConfig: (() => {
    const agents = Array.from({ length: 100 }, (_, i) => `
  agent${i}: {
    name: 'agent-${i}',
    description: 'Test agent number ${i}',
    tools: ['tool1', 'tool2', 'tool3'],
    model: 'gpt-4'
  }`).join(',\n');
    
    return `
export default {
  name: 'large-config',
  version: '1.0.0',
  agents: {
${agents}
  }
};
`.trim();
  })(),
};

/**
 * Creates a test project structure
 */
export function createTestProject(dir: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    writeFile(join(dir, path), content);
  }
}

/**
 * Waits for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Creates a mock file watcher for testing
 */
export function createMockWatcher() {
  const callbacks: ((eventType: string, filename: string) => void)[] = [];
  
  return {
    on: (event: string, callback: (eventType: string, filename: string) => void) => {
      if (event === 'change') {
        callbacks.push(callback);
      }
    },
    trigger: (filename: string) => {
      callbacks.forEach(cb => cb('change', filename));
    },
    close: () => {
      callbacks.length = 0;
    }
  };
}

/**
 * Asserts that a file exists and optionally checks its content
 */
export function assertFileExists(path: string, expectedContent?: string | RegExp): void {
  if (!existsSync(path)) {
    throw new Error(`Expected file to exist: ${path}`);
  }
  
  if (expectedContent !== undefined) {
    const content = readFileSync(path, 'utf-8');
    if (typeof expectedContent === 'string') {
      if (content !== expectedContent) {
        throw new Error(`File content mismatch at ${path}`);
      }
    } else if (!expectedContent.test(content)) {
      throw new Error(`File content does not match pattern at ${path}`);
    }
  }
}

/**
 * Asserts that a file does not exist
 */
export function assertFileNotExists(path: string): void {
  if (existsSync(path)) {
    throw new Error(`Expected file not to exist: ${path}`);
  }
}

/**
 * Gets the size of a file in bytes
 */
export function getFileSize(path: string): number {
  const stats = require('fs').statSync(path);
  return stats.size;
}

/**
 * Delay execution for testing
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock console methods for testing
 */
export function mockConsole() {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  
  const logs: string[] = [];
  const warns: string[] = [];
  const errors: string[] = [];
  
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  
  console.warn = (...args: unknown[]) => {
    warns.push(args.map(String).join(' '));
  };
  
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  };
  
  return {
    logs,
    warns,
    errors,
    restore: () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }
  };
}

/**
 * Creates a test cache directory structure
 */
export function createCacheStructure(baseDir: string) {
  const cacheDir = join(baseDir, '.lightfast');
  const compiledDir = join(cacheDir, 'compiled');
  const cacheFile = join(cacheDir, 'cache.json');
  
  mkdirSync(compiledDir, { recursive: true });
  
  return {
    cacheDir,
    compiledDir,
    cacheFile,
    addCacheEntry: (entry: Record<string, unknown>) => {
      const existing = existsSync(cacheFile) 
        ? JSON.parse(readFileSync(cacheFile, 'utf-8'))
        : {};
      writeFileSync(cacheFile, JSON.stringify({ ...existing, ...entry }, null, 2));
    }
  };
}