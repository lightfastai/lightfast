import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import { LightfastCompiler, type CompilationResult } from './index.js';

export interface WatcherOptions {
  /**
   * Base directory to search for configuration files
   * @default process.cwd()
   */
  baseDir?: string;
  
  /**
   * Configuration file patterns to watch
   * @default ['lightfast.config.ts', 'lightfast.config.js', 'lightfast.config.tsx', 'lightfast.config.jsx', 'lightfast.config.mjs']
   */
  configPatterns?: string[];
  
  /**
   * Debounce delay in milliseconds for file changes
   * @default 500
   */
  debounceDelay?: number;
  
  /**
   * Whether to ignore initial compilation on start
   * @default false
   */
  ignoreInitial?: boolean;
  
  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
  
  /**
   * Custom compiler instance
   */
  compiler?: LightfastCompiler;
  
  /**
   * Additional files or patterns to watch besides config files
   */
  additionalWatchPaths?: string[];
}

export interface WatcherEvents {
  'compile-start': (configPath: string) => void;
  'compile-success': (result: CompilationResult) => void;
  'compile-error': (error: Error, configPath: string) => void;
  'config-added': (configPath: string) => void;
  'config-removed': (configPath: string) => void;
  'watcher-ready': () => void;
  'watcher-error': (error: Error) => void;
}

/**
 * File watcher service for hot-reloading Lightfast configurations
 */
export class ConfigWatcher extends EventEmitter {
  private readonly baseDir: string;
  private readonly configPatterns: string[];
  private readonly debounceDelay: number;
  private readonly ignoreInitial: boolean;
  private readonly debug: boolean;
  private readonly compiler: LightfastCompiler;
  private readonly additionalWatchPaths: string[];
  
  private watcher?: FSWatcher;
  private debounceTimer?: NodeJS.Timeout;
  private isCompiling = false;
  private watchedConfigPaths = new Set<string>();
  
  constructor(options: WatcherOptions = {}) {
    super();
    
    this.baseDir = options.baseDir || process.cwd();
    this.configPatterns = options.configPatterns || [
      'lightfast.config.ts',
      'lightfast.config.tsx', 
      'lightfast.config.js',
      'lightfast.config.jsx',
      'lightfast.config.mjs'
    ];
    this.debounceDelay = options.debounceDelay ?? 500;
    this.ignoreInitial = options.ignoreInitial ?? false;
    this.debug = options.debug ?? false;
    this.additionalWatchPaths = options.additionalWatchPaths || [];
    
    this.compiler = options.compiler || new LightfastCompiler({
      baseDir: this.baseDir,
      configPatterns: this.configPatterns
    });
  }
  
  private log(message: string, ...args: any[]): void {
    if (this.debug) {
      console.log(`[ConfigWatcher] ${message}`, ...args);
    }
  }
  
  on<K extends keyof WatcherEvents>(event: K, listener: WatcherEvents[K]): this {
    return super.on(event, listener);
  }
  
  emit<K extends keyof WatcherEvents>(event: K, ...args: Parameters<WatcherEvents[K]>): boolean {
    return super.emit(event, ...args);
  }
  
  /**
   * Start watching for configuration file changes
   */
  async start(): Promise<void> {
    if (this.watcher) {
      throw new Error('Watcher is already running');
    }
    
    try {
      // Find all existing config files
      const watchPaths = this.getWatchPaths();
      
      if (watchPaths.length === 0) {
        throw new Error(`No configuration files found to watch. Searched for patterns: ${this.configPatterns.join(', ')}`);
      }
      
      // Initialize chokidar watcher
      this.watcher = chokidar.watch(watchPaths, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true, // We handle initial compilation separately
        ignorePermissionErrors: true,
        followSymlinks: false,
        usePolling: false,
        atomic: true, // Wait for write operations to complete
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 10
        }
      });
      
      // Set up event handlers
      this.setupWatcherHandlers();
      
      // Initial compilation if not ignored
      if (!this.ignoreInitial) {
        await this.performInitialCompilation();
      }
      
      this.emit('watcher-ready');
      
    } catch (error) {
      this.emit('watcher-error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
  
  /**
   * Stop the watcher
   */
  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
    
    this.watchedConfigPaths.clear();
    this.isCompiling = false;
  }
  
  /**
   * Get the current compilation status
   */
  isCurrentlyCompiling(): boolean {
    return this.isCompiling;
  }
  
  /**
   * Get the watched configuration file paths
   */
  getWatchedPaths(): string[] {
    return Array.from(this.watchedConfigPaths);
  }
  
  /**
   * Force a recompilation of all configuration files
   */
  async forceCompilation(): Promise<void> {
    if (this.isCompiling) {
      return; // Already compiling
    }
    
    const configPath = this.findAnyConfigFile();
    if (configPath) {
      await this.handleFileChange('change', configPath);
    }
  }
  
  private getWatchPaths(): string[] {
    const watchPaths: string[] = [];
    
    // Add config file patterns
    for (const pattern of this.configPatterns) {
      const fullPath = resolve(this.baseDir, pattern);
      if (existsSync(fullPath)) {
        watchPaths.push(fullPath);
        this.watchedConfigPaths.add(fullPath);
      }
    }
    
    // Add additional watch paths
    for (const additionalPath of this.additionalWatchPaths) {
      const fullPath = resolve(this.baseDir, additionalPath);
      if (existsSync(fullPath)) {
        watchPaths.push(fullPath);
      }
    }
    
    // Also watch for new config files being created
    const baseGlobs = this.configPatterns.map(pattern => resolve(this.baseDir, pattern));
    watchPaths.push(...baseGlobs);
    
    return watchPaths;
  }
  
  private setupWatcherHandlers(): void {
    if (!this.watcher) return;
    
    this.watcher.on('change', (path: string) => {
      this.handleFileChange('change', path);
    });
    
    this.watcher.on('add', (path: string) => {
      // Check if it's a config file that we care about
      if (this.isConfigFile(path)) {
        this.watchedConfigPaths.add(path);
        this.emit('config-added', path);
        this.handleFileChange('add', path);
      }
    });
    
    this.watcher.on('unlink', (path: string) => {
      if (this.watchedConfigPaths.has(path)) {
        this.watchedConfigPaths.delete(path);
        this.emit('config-removed', path);
      }
    });
    
    this.watcher.on('error', (err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('watcher-error', error);
    });
  }
  
  private async handleFileChange(eventType: 'change' | 'add', configPath: string): Promise<void> {
    // Clear any existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    // Set up debounced compilation
    this.debounceTimer = setTimeout(async () => {
      if (this.isCompiling) {
        return; // Skip if already compiling
      }
      
      await this.compileConfig(configPath);
    }, this.debounceDelay);
  }
  
  private async compileConfig(configPath: string): Promise<void> {
    this.isCompiling = true;
    
    try {
      this.emit('compile-start', configPath);
      
      const result = await this.compiler.compile({
        configPath,
        force: true // Always force recompilation on file changes
      });
      
      if (result.errors.length > 0) {
        const error = new Error(`Compilation failed: ${result.errors.join(', ')}`);
        this.emit('compile-error', error, configPath);
      } else {
        this.emit('compile-success', result);
      }
      
    } catch (error) {
      const compileError = error instanceof Error ? error : new Error(String(error));
      this.emit('compile-error', compileError, configPath);
      
    } finally {
      this.isCompiling = false;
    }
  }
  
  private async performInitialCompilation(): Promise<void> {
    const configPath = this.findAnyConfigFile();
    if (configPath) {
      await this.compileConfig(configPath);
    }
  }
  
  private findAnyConfigFile(): string | null {
    for (const configPath of this.watchedConfigPaths) {
      if (existsSync(configPath)) {
        return configPath;
      }
    }
    return null;
  }
  
  private isConfigFile(filePath: string): boolean {
    const fileName = filePath.split('/').pop() || '';
    return this.configPatterns.some(pattern => {
      // Simple pattern matching - you could make this more sophisticated
      const patternRegex = new RegExp(pattern.replace(/\./g, '\\.').replace(/\*/g, '.*'));
      return patternRegex.test(fileName);
    });
  }
}

/**
 * Create a new configuration watcher instance
 */
export function createConfigWatcher(options: WatcherOptions = {}): ConfigWatcher {
  return new ConfigWatcher(options);
}

/**
 * Utility type for better TypeScript integration
 */
export type ConfigWatcherInstance = ConfigWatcher;

// Export event types for external use
export type { WatcherEvents as ConfigWatcherEvents };