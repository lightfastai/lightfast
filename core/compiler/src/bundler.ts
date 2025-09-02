import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import type { TranspileResult } from './transpiler.js';

export interface AgentMetadata {
  name: string;
  description?: string;
  tools?: string[];
  models?: string[];
}

export interface BundleMetadata {
  id: string;
  hash: string;
  name: string;
  description?: string;
  tools: string[];
  models: string[];
  compiledAt: string;
  compilerVersion: string;
}

export interface BundleOutput {
  id: string;
  hash: string;
  filename: string;
  filepath: string;
  size: number;
  metadata: BundleMetadata;
}

export interface BundleManifest {
  version: string;
  compiledAt: string;
  compilerVersion: string;
  bundles: Array<{
    id: string;
    hash: string;
    file: string;
    size: number;
    tools: string[];
    models: string[];
  }>;
}

export interface BundlerOptions {
  baseDir: string;
  outputDir?: string;
  compilerVersion?: string;
}

/**
 * Generates a content hash for the bundle
 */
function generateHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 8);
}

/**
 * Extracts agent metadata from the transpiled code
 * This is a placeholder - in reality we'd parse the AST or require runtime evaluation
 */
function extractAgentMetadata(code: string, agentId: string): AgentMetadata {
  // For now, return placeholder metadata
  // In production, this would parse the actual agent configuration
  return {
    name: agentId,
    description: `Agent ${agentId}`,
    tools: [],
    models: []
  };
}

/**
 * Wraps transpiled code in the bundle format
 */
function wrapInBundleFormat(
  code: string,
  agentId: string,
  hash: string,
  metadata: AgentMetadata,
  compilerVersion: string
): string {
  const bundleMetadata: BundleMetadata = {
    id: agentId,
    hash,
    name: metadata.name,
    description: metadata.description,
    tools: metadata.tools ?? [],
    models: metadata.models ?? [],
    compiledAt: new Date().toISOString(),
    compilerVersion
  };

  // Create the bundle wrapper
  const bundleCode = `// Lightfast Agent Bundle
// Generated at: ${bundleMetadata.compiledAt}
// Hash: ${hash}

// Original compiled config
const compiledConfig = (() => {
${code.split('\n').map(line => '  ' + line).join('\n')}
})();

// Bundle export format
export default {
  // Identity
  id: "${bundleMetadata.id}",
  hash: "${bundleMetadata.hash}",
  
  // Metadata
  metadata: ${JSON.stringify(bundleMetadata, null, 2).split('\n').map((line, i) => i === 0 ? line : '  ' + line).join('\n')},
  
  // The actual compiled configuration
  config: compiledConfig.default || compiledConfig,
  
  // Execute function
  async execute(params, context) {
    // This will be replaced by the cloud layer with actual runtime execution
    // For now, it's a placeholder that returns the config
    const runtime = globalThis.__lightfastRuntime;
    if (!runtime) {
      throw new Error('Lightfast runtime not available');
    }
    return runtime.execute(this.config, params, context);
  }
};
`;

  return bundleCode;
}

/**
 * Creates agent bundles from transpiled code
 */
export class BundleGenerator {
  private baseDir: string;
  private outputDir: string;
  private compilerVersion: string;

  constructor(options: BundlerOptions) {
    this.baseDir = options.baseDir;
    this.outputDir = options.outputDir ?? resolve(this.baseDir, '.lightfast/dist');
    this.compilerVersion = options.compilerVersion ?? '0.1.0';
    
    // Ensure output directory exists
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generates a single agent bundle
   */
  async generateBundle(
    transpileResult: TranspileResult,
    agentId: string,
    _sourcePath: string
  ): Promise<BundleOutput> {
    if (transpileResult.errors.length > 0) {
      throw new Error(`Cannot bundle due to transpilation errors: ${transpileResult.errors.join(', ')}`);
    }

    // Extract metadata (this would be more sophisticated in production)
    const metadata = extractAgentMetadata(transpileResult.code, agentId);
    
    // Generate hash from the original transpiled code
    const hash = generateHash(transpileResult.code);
    
    // Wrap in bundle format
    const bundleCode = wrapInBundleFormat(
      transpileResult.code,
      agentId,
      hash,
      metadata,
      this.compilerVersion
    );

    // Ensure output directory exists
    const bundlesDir = resolve(this.outputDir, 'bundles');
    if (!existsSync(bundlesDir)) {
      mkdirSync(bundlesDir, { recursive: true });
    }

    // Write bundle file with hash in filename
    const filename = `${agentId}.${hash}.js`;
    const filepath = resolve(bundlesDir, filename);
    writeFileSync(filepath, bundleCode, 'utf-8');

    return {
      id: agentId,
      hash,
      filename,
      filepath,
      size: Buffer.byteLength(bundleCode, 'utf-8'),
      metadata: {
        id: agentId,
        hash,
        name: metadata.name,
        description: metadata.description,
        tools: metadata.tools ?? [],
        models: metadata.models ?? []
        compiledAt: new Date().toISOString(),
        compilerVersion: this.compilerVersion
      }
    };
  }

  /**
   * Generates bundles for multiple agents
   * In the future, this would parse the config to identify multiple agents
   */
  async generateBundles(
    transpileResult: TranspileResult,
    sourcePath: string
  ): Promise<BundleOutput[]> {
    // For now, generate a single bundle with ID 'main' for the main configuration
    const agentId = 'main';
    
    const bundle = await this.generateBundle(transpileResult, agentId, sourcePath);
    
    // Write source map if available
    if (transpileResult.sourcemap) {
      const mapPath = bundle.filepath + '.map';
      writeFileSync(mapPath, transpileResult.sourcemap, 'utf-8');
    }
    
    // Write manifest
    this.updateManifest([bundle]);
    
    return [bundle];
  }

  /**
   * Updates the manifest file with bundle information
   */
  private updateManifest(bundles: BundleOutput[]): void {
    const manifestPath = resolve(this.outputDir, 'manifest.json');
    
    // Read existing manifest if it exists
    let manifest: BundleManifest = {
      version: '1.0.0',
      compiledAt: new Date().toISOString(),
      compilerVersion: this.compilerVersion,
      bundles: []
    };

    if (existsSync(manifestPath)) {
      try {
        const content = readFileSync(manifestPath, 'utf-8');
        manifest = JSON.parse(content);
      } catch {
        // If manifest is corrupted, start fresh
      }
    }

    // Update with new bundles
    manifest.compiledAt = new Date().toISOString();
    manifest.bundles = bundles.map(b => ({
      id: b.id,
      hash: b.hash,
      file: `bundles/${b.filename}`,
      size: b.size,
      tools: b.metadata.tools,
      models: b.metadata.models
    }));

    // Write updated manifest
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  /**
   * Gets the output directory
   */
  getOutputDir(): string {
    return this.outputDir;
  }
}

/**
 * Creates a bundle generator instance
 */
export function createBundleGenerator(options: BundlerOptions): BundleGenerator {
  return new BundleGenerator(options);
}