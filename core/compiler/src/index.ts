import { existsSync, watch } from 'node:fs';
import { resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { CacheManager} from './cache.js';
import { createCacheManager } from './cache.js';
import { transpileConfig, validateConfig   } from './transpiler.js';
import type {TranspileOptions, TranspileResult} from './transpiler.js';
import { createBundleGenerator } from './bundler.js';
import type { BundleGenerator, BundleOutput } from './bundler.js';

const DEFAULT_CONFIG_PATTERNS = [
  'lightfast.config.ts',
  'lightfast.config.tsx',
  'lightfast.config.js',
  'lightfast.config.jsx',
  'lightfast.config.mjs'
];

export interface CompilerOptions {
  /**
   * Base directory to search for configuration files
   * @default process.cwd()
   */
  baseDir?: string;
  
  /**
   * Custom cache manager instance
   */
  cacheManager?: CacheManager;
  
  /**
   * Configuration file patterns to search for
   * @default ['lightfast.config.ts', 'lightfast.config.js']
   */
  configPatterns?: string[];
  
  /**
   * Whether to use caching
   * @default true
   */
  useCache?: boolean;
  
  /**
   * Whether to force recompilation even if cache is valid
   * @default false
   */
  force?: boolean;
  
  /**
   * Additional transpile options
   */
  transpileOptions?: Partial<TranspileOptions>;
}

export interface CompilationResult {
  /**
   * Path to the compiled configuration file
   */
  outputPath: string;
  
  /**
   * Whether the compilation was served from cache
   */
  fromCache: boolean;
  
  /**
   * Compilation time in milliseconds
   */
  compilationTime: number;
  
  /**
   * Source configuration file that was compiled
   */
  sourcePath: string;
  
  /**
   * Transpilation result details
   */
  transpileResult: TranspileResult;
  
  /**
   * Generated bundles (when bundling is enabled)
   */
  bundles?: BundleOutput[];
  
  /**
   * Any warnings or errors encountered
   */
  warnings: string[];
  errors: string[];
}

/**
 * Main TypeScript configuration compiler class
 */
export class LightfastCompiler {
  private readonly baseDir: string;
  private readonly cacheManager: CacheManager;
  private readonly bundleGenerator: BundleGenerator;
  private readonly configPatterns: string[];
  private readonly useCache: boolean;

  constructor(options: CompilerOptions = {}) {
    this.baseDir = options.baseDir ?? process.cwd();
    this.cacheManager = options.cacheManager ?? createCacheManager({ baseDir: this.baseDir });
    this.bundleGenerator = createBundleGenerator({ 
      baseDir: this.baseDir,
      outputDir: join(this.baseDir, '.lightfast/dist')
    });
    this.configPatterns = options.configPatterns ?? DEFAULT_CONFIG_PATTERNS;
    this.useCache = options.useCache !== false;
  }

  /**
   * Finds the configuration file in the base directory
   */
  private findConfigFile(): string | null {
    for (const pattern of this.configPatterns) {
      const configPath = join(this.baseDir, pattern);
      if (existsSync(configPath)) {
        return configPath;
      }
    }
    return null;
  }

  /**
   * Validates that the configuration file exists and is accessible
   */
  async validateConfigFile(configPath?: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    configPath?: string;
  }> {
    const resolvedConfigPath = configPath ?? this.findConfigFile();
    
    if (!resolvedConfigPath) {
      return {
        isValid: false,
        errors: [
          `No configuration file found. Searched for: ${this.configPatterns.join(', ')}`,
          `Search directory: ${this.baseDir}`
        ],
        warnings: []
      };
    }

    const validation = await validateConfig(resolvedConfigPath);
    
    return {
      ...validation,
      configPath: resolvedConfigPath
    };
  }

  /**
   * Compiles the TypeScript configuration to JavaScript
   */
  async compile(options: {
    configPath?: string;
    force?: boolean;
    transpileOptions?: Partial<TranspileOptions>;
  } = {}): Promise<CompilationResult> {
    const startTime = performance.now();
    
    // Find configuration file
    const configPath = options.configPath ?? this.findConfigFile();
    if (!configPath) {
      const endTime = performance.now();
      return {
        outputPath: '',
        fromCache: false,
        compilationTime: endTime - startTime,
        sourcePath: '',
        transpileResult: {
          code: '',
          warnings: [],
          errors: ['No configuration file found']
        },
        warnings: [],
        errors: [`No configuration file found in ${this.baseDir}`]
      };
    }

    const resolvedConfigPath = resolve(configPath);
    const force = options.force ?? false;
    
    // Compile the configuration file first to get metafile for cache check
    const transpileResult = await transpileConfig(resolvedConfigPath, options.transpileOptions);
    
    if (transpileResult.errors.length > 0) {
      const endTime = performance.now();
      return {
        outputPath: '',
        fromCache: false,
        compilationTime: endTime - startTime,
        sourcePath: resolvedConfigPath,
        transpileResult,
        warnings: transpileResult.warnings,
        errors: transpileResult.errors
      };
    }

    // Check cache with metafile (if enabled and not forced)
    if (this.useCache && !force && this.cacheManager.isCached(resolvedConfigPath, transpileResult.metafile)) {
      const cachedOutputPath = this.cacheManager.getCachedOutputPath(resolvedConfigPath);
      if (cachedOutputPath) {
        const endTime = performance.now();
        return {
          outputPath: cachedOutputPath,
          fromCache: true,
          compilationTime: endTime - startTime,
          sourcePath: resolvedConfigPath,
          transpileResult: {
            code: '',
            warnings: [],
            errors: []
          },
          warnings: ['Using cached compilation'],
          errors: []
        };
      }
    }

    // Store in cache and write main output
    let _outputPath: string;
    
    if (this.useCache) {
      // Store in cache with unique filename and metafile
      const cachedPath = this.cacheManager.setCached(
        resolvedConfigPath,
        transpileResult.code,
        transpileResult.sourcemap,
        transpileResult.metafile
      );
      _outputPath = cachedPath;
    } else {
      // Write directly to main output path
      _outputPath = this.cacheManager.getMainOutputPath();
    }
    
    // Always write to the main output location for consistency (legacy support)
    this.cacheManager.writeMainOutput(transpileResult.code);
    
    // Generate bundles with the new structure
    let bundles: BundleOutput[] | undefined;
    try {
      bundles = await this.bundleGenerator.generateBundles(transpileResult, resolvedConfigPath);
    } catch (error) {
      console.warn('Failed to generate bundles:', error);
      // Continue without bundles for backward compatibility
    }
    
    const endTime = performance.now();
    
    return {
      outputPath: this.cacheManager.getMainOutputPath(),
      fromCache: false,
      compilationTime: endTime - startTime,
      sourcePath: resolvedConfigPath,
      transpileResult,
      bundles,
      warnings: transpileResult.warnings,
      errors: []
    };
  }

  /**
   * Compiles and loads the configuration as a module
   */
  async compileAndLoad<T = unknown>(options: {
    configPath?: string;
    force?: boolean;
    transpileOptions?: Partial<TranspileOptions>;
  } = {}): Promise<{
    config: T;
    compilationResult: CompilationResult;
  }> {
    const compilationResult = await this.compile(options);
    
    if (compilationResult.errors.length > 0) {
      throw new Error(`Configuration compilation failed: ${compilationResult.errors.join(', ')}`);
    }

    try {
      // Dynamic import of the compiled configuration
      const configModule = await import(compilationResult.outputPath) as { default?: T } & T;
      const config = configModule.default ?? configModule;
      
      return {
        config,
        compilationResult
      };
    } catch (error) {
      throw new Error(
        `Failed to load compiled configuration: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Watches the configuration file for changes and recompiles
   */
  watch(options: {
    configPath?: string;
    onCompile?: (result: CompilationResult) => void;
    onError?: (error: Error) => void;
    transpileOptions?: Partial<TranspileOptions>;
  } = {}): {
    close: () => void;
  } {
    const { onCompile, onError } = options;
    
    const configPath = options.configPath ?? this.findConfigFile();
    if (!configPath) {
      onError?.(new Error('No configuration file found to watch'));
      return { close: () => { /* No-op */ } };
    }

    let isCompiling = false;
    
    const watcher = watch(configPath, (eventType) => {
      if (eventType === 'change' && !isCompiling) {
        isCompiling = true;
        void (async () => {
          try {
            const result = await this.compile({
              configPath,
              force: true, // Always recompile on file change
              transpileOptions: options.transpileOptions
            });
            onCompile?.(result);
          } catch (error) {
            onError?.(error instanceof Error ? error : new Error(String(error)));
          } finally {
            isCompiling = false;
          }
        })();
      }
    });

    return {
      close: () => watcher.close()
    };
  }

  /**
   * Gets information about the cache
   */
  getCacheInfo() {
    return this.cacheManager.getCacheStats();
  }

  /**
   * Clears the compilation cache
   */
  clearCache(): void {
    this.cacheManager.clearCache();
  }

  /**
   * Cleans stale cache entries
   */
  cleanCache(): void {
    this.cacheManager.cleanStaleEntries();
  }

  /**
   * Gets the base directory
   */
  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Gets the expected configuration file paths
   */
  getConfigPatterns(): string[] {
    return [...this.configPatterns];
  }
}

// Convenience functions for common use cases

/**
 * Creates a new compiler instance
 */
export function createCompiler(options: CompilerOptions = {}): LightfastCompiler {
  return new LightfastCompiler(options);
}

/**
 * Quickly compile a configuration file with default settings
 */
export async function compileConfig(
  configPath?: string,
  options: Partial<CompilerOptions & { force?: boolean }> = {}
): Promise<CompilationResult> {
  const compiler = createCompiler(options);
  return compiler.compile({
    configPath,
    force: options.force
  });
}

/**
 * Quickly compile and load a configuration file
 */
export async function loadConfig<T = unknown>(
  configPath?: string,
  options: Partial<CompilerOptions & { force?: boolean }> = {}
): Promise<T> {
  const compiler = createCompiler(options);
  const { config } = await compiler.compileAndLoad<T>({
    configPath,
    force: options.force
  });
  return config;
}

/**
 * Find a configuration file in the given directory
 */
export function findConfig(
  baseDir: string = process.cwd(),
  patterns: string[] = DEFAULT_CONFIG_PATTERNS
): string | null {
  for (const pattern of patterns) {
    const configPath = join(baseDir, pattern);
    if (existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}

/**
 * Validate a configuration file without compiling
 */
export async function validateConfigFile(
  configPath?: string,
  options: Partial<CompilerOptions> = {}
): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
  configPath?: string;
}> {
  const compiler = createCompiler(options);
  return compiler.validateConfigFile(configPath);
}

// Export types and classes
export type {
  TranspileOptions,
  TranspileResult
} from './transpiler.js';

export {
  transpile,
  transpileConfig,
  validateConfig,
  isTranspilable,
  getOutputExtension
} from './transpiler.js';

export {
  CacheManager,
  createCacheManager,
  defaultCacheManager
} from './cache.js';

export {
  ConfigWatcher,
  createConfigWatcher,
  type WatcherOptions,
  type ConfigWatcherEvents,
  type ConfigWatcherInstance
} from './watcher.js';

export {
  formatCompilationErrors,
  formatCompilationWarnings,
  displayCompilationSummary,
  CompilationSpinner,
  type CompilationError
} from './error-formatter.js';

export {
  BundleGenerator,
  createBundleGenerator,
  type BundleMetadata,
  type BundleOutput,
  type BundlerOptions,
  type AgentMetadata
} from './bundler.js';

// Default export
export default LightfastCompiler;