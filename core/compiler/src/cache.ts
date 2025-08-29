import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';

export interface CacheOptions {
  /**
   * Base directory to create .lightfast folder in
   * @default process.cwd()
   */
  baseDir?: string;
  /**
   * Name of the cache directory
   * @default '.lightfast'
   */
  cacheDir?: string;
}

export interface CacheEntry {
  /** Hash of the source file contents */
  hash: string;
  /** Timestamp when the cache entry was created */
  timestamp: number;
  /** Path to the source TypeScript file */
  sourcePath: string;
  /** Path to the compiled JavaScript file */
  outputPath: string;
  /** Dependency file paths and their hashes */
  dependencies?: Record<string, string>;
  /** Combined hash of all dependencies */
  dependencyHash?: string;
}

/**
 * Manages caching for compiled TypeScript configuration files
 */
export class CacheManager {
  private readonly baseDir: string;
  private readonly cacheDir: string;
  private readonly cachePath: string;
  private readonly outputDir: string;

  constructor(options: CacheOptions = {}) {
    this.baseDir = options.baseDir || process.cwd();
    this.cacheDir = options.cacheDir || '.lightfast';
    this.cachePath = join(this.baseDir, this.cacheDir);
    this.outputDir = join(this.cachePath, 'compiled');
    
    this.ensureCacheDir();
  }

  /**
   * Ensures the cache directory structure exists
   */
  private ensureCacheDir(): void {
    if (!existsSync(this.cachePath)) {
      mkdirSync(this.cachePath, { recursive: true });
    }
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generates a hash for file contents
   */
  private generateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  /**
   * Extracts dependency files from esbuild metafile and calculates their hashes
   */
  private extractDependencies(metafile: any, baseDir: string): { dependencies: Record<string, string>; dependencyHash: string } {
    const dependencies: Record<string, string> = {};
    const dependencyPaths: string[] = [];
    
    if (metafile?.inputs) {
      for (const inputPath of Object.keys(metafile.inputs)) {
        // Convert relative path to absolute path
        const absolutePath = resolve(baseDir, inputPath);
        
        if (existsSync(absolutePath)) {
          try {
            const content = readFileSync(absolutePath, 'utf-8');
            const hash = this.generateHash(content);
            dependencies[absolutePath] = hash;
            dependencyPaths.push(absolutePath);
          } catch (error) {
            console.warn(`Failed to read dependency ${absolutePath}: ${error}`);
          }
        }
      }
    }
    
    // Create combined hash from all dependency hashes in deterministic order
    const sortedPaths = dependencyPaths.sort();
    const combinedHashInput = sortedPaths.map(path => dependencies[path]).join('|');
    const dependencyHash = this.generateHash(combinedHashInput);
    
    return { dependencies, dependencyHash };
  }

  /**
   * Gets the path to the cache metadata file
   */
  private getCacheMetadataPath(): string {
    return join(this.cachePath, 'cache-metadata.json');
  }

  /**
   * Loads cache metadata from disk
   */
  private loadCacheMetadata(): Record<string, CacheEntry> {
    const metadataPath = this.getCacheMetadataPath();
    if (!existsSync(metadataPath)) {
      return {};
    }

    try {
      const content = readFileSync(metadataPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`Failed to load cache metadata: ${error}`);
      return {};
    }
  }

  /**
   * Saves cache metadata to disk
   */
  private saveCacheMetadata(metadata: Record<string, CacheEntry>): void {
    const metadataPath = this.getCacheMetadataPath();
    try {
      writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    } catch (error) {
      console.warn(`Failed to save cache metadata: ${error}`);
    }
  }

  /**
   * Checks if a cached version exists and is still valid
   */
  isCached(sourcePath: string, metafile?: any): boolean {
    const resolvedSourcePath = resolve(sourcePath);
    
    if (!existsSync(resolvedSourcePath)) {
      return false;
    }

    const metadata = this.loadCacheMetadata();
    const cacheEntry = metadata[resolvedSourcePath];
    
    if (!cacheEntry) {
      return false;
    }

    // Check if output file still exists
    if (!existsSync(cacheEntry.outputPath)) {
      return false;
    }

    // Check if source file has been modified
    try {
      const sourceContent = readFileSync(resolvedSourcePath, 'utf-8');
      const currentHash = this.generateHash(sourceContent);
      
      if (currentHash !== cacheEntry.hash) {
        return false;
      }
      
      // If we have a metafile, check dependencies
      if (metafile && cacheEntry.dependencies && cacheEntry.dependencyHash) {
        const baseDir = dirname(resolvedSourcePath);
        const { dependencies, dependencyHash } = this.extractDependencies(metafile, baseDir);
        
        // Check if dependency hash has changed
        if (dependencyHash !== cacheEntry.dependencyHash) {
          return false;
        }
        
        // Check each individual dependency
        for (const [depPath, expectedHash] of Object.entries(cacheEntry.dependencies)) {
          if (dependencies[depPath] !== expectedHash) {
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets the cached output path for a source file
   */
  getCachedOutputPath(sourcePath: string): string | null {
    const resolvedSourcePath = resolve(sourcePath);
    const metadata = this.loadCacheMetadata();
    const cacheEntry = metadata[resolvedSourcePath];
    
    if (!cacheEntry || !existsSync(cacheEntry.outputPath)) {
      return null;
    }

    return cacheEntry.outputPath;
  }

  /**
   * Stores a compiled file in the cache
   */
  setCached(sourcePath: string, compiledContent: string, sourceMapContent?: string, metafile?: any): string {
    const resolvedSourcePath = resolve(sourcePath);
    const sourceContent = readFileSync(resolvedSourcePath, 'utf-8');
    const hash = this.generateHash(sourceContent);
    
    // Generate output filename based on source file
    const sourceFileName = resolvedSourcePath.split('/').pop()!;
    const outputFileName = sourceFileName.replace(/\.tsx?$/, '.mjs');
    const outputPath = join(this.outputDir, `${hash}-${outputFileName}`);
    
    // Write compiled content
    writeFileSync(outputPath, compiledContent, 'utf-8');
    
    // Write source map if provided
    if (sourceMapContent) {
      const sourceMapPath = outputPath + '.map';
      writeFileSync(sourceMapPath, sourceMapContent, 'utf-8');
    }
    
    // Extract dependencies if metafile is provided
    let dependencies: Record<string, string> | undefined;
    let dependencyHash: string | undefined;
    
    if (metafile) {
      const baseDir = dirname(resolvedSourcePath);
      const depInfo = this.extractDependencies(metafile, baseDir);
      dependencies = depInfo.dependencies;
      dependencyHash = depInfo.dependencyHash;
    }
    
    // Update cache metadata
    const metadata = this.loadCacheMetadata();
    const cacheEntry: CacheEntry = {
      hash,
      timestamp: Date.now(),
      sourcePath: resolvedSourcePath,
      outputPath,
      dependencies,
      dependencyHash
    };
    
    metadata[resolvedSourcePath] = cacheEntry;
    this.saveCacheMetadata(metadata);
    
    return outputPath;
  }

  /**
   * Gets the main output path for lightfast.config.mjs
   */
  getMainOutputPath(): string {
    return join(this.cachePath, 'lightfast.config.mjs');
  }

  /**
   * Writes the main compiled configuration file
   */
  writeMainOutput(content: string): void {
    const outputPath = this.getMainOutputPath();
    writeFileSync(outputPath, content, 'utf-8');
  }

  /**
   * Clears the entire cache
   */
  clearCache(): void {
    if (existsSync(this.cachePath)) {
      rmSync(this.cachePath, { recursive: true, force: true });
    }
    this.ensureCacheDir();
  }

  /**
   * Removes stale cache entries (files that no longer exist)
   */
  cleanStaleEntries(): void {
    const metadata = this.loadCacheMetadata();
    const validEntries: Record<string, CacheEntry> = {};
    
    for (const [sourcePath, cacheEntry] of Object.entries(metadata)) {
      if (existsSync(sourcePath) && existsSync(cacheEntry.outputPath)) {
        validEntries[sourcePath] = cacheEntry;
      } else {
        // Remove stale output file if it exists
        if (existsSync(cacheEntry.outputPath)) {
          try {
            rmSync(cacheEntry.outputPath);
          } catch (error) {
            console.warn(`Failed to remove stale cache file: ${error}`);
          }
        }
      }
    }
    
    this.saveCacheMetadata(validEntries);
  }

  /**
   * Gets cache statistics
   */
  getCacheStats(): {
    cacheDir: string;
    totalEntries: number;
    totalSize: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    const metadata = this.loadCacheMetadata();
    const entries = Object.values(metadata);
    
    let totalSize = 0;
    let oldestTimestamp = Number.MAX_SAFE_INTEGER;
    let newestTimestamp = 0;
    
    for (const entry of entries) {
      if (existsSync(entry.outputPath)) {
        try {
          const stats = statSync(entry.outputPath);
          totalSize += stats.size;
        } catch (error) {
          // Ignore errors getting file stats
        }
      }
      
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
      if (entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp;
      }
    }
    
    return {
      cacheDir: this.cachePath,
      totalEntries: entries.length,
      totalSize,
      oldestEntry: oldestTimestamp !== Number.MAX_SAFE_INTEGER ? new Date(oldestTimestamp) : undefined,
      newestEntry: newestTimestamp > 0 ? new Date(newestTimestamp) : undefined
    };
  }

  /**
   * Checks if the cache directory exists and is accessible
   */
  isAccessible(): boolean {
    try {
      return existsSync(this.cachePath) && statSync(this.cachePath).isDirectory();
    } catch (error) {
      return false;
    }
  }
}

/**
 * Default cache manager instance
 */
export const defaultCacheManager = new CacheManager();

/**
 * Creates a new cache manager with custom options
 */
export function createCacheManager(options: CacheOptions = {}): CacheManager {
  return new CacheManager(options);
}