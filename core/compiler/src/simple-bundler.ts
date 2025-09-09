import { resolve, join } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { build as esbuild } from 'esbuild';
import { createHash } from 'crypto';
import type { TranspileResult } from './transpiler.js';
import { extractAgentDefinitionsFromCode } from './esbuild-ast-utils.js';

/**
 * Simple agent bundler: one bundle per agent
 * Clean approach that avoids multi-strategy complexity
 */

export interface AgentBundle {
  id: string;
  hash: string;
  filename: string;
  filepath: string;
  size: number;
  dependencies: string[];
  metadata: {
    id: string;
    hash: string;
    name: string;
    description?: string;
    tools: string[];
    models: string[];
    compiledAt: string;
    compilerVersion: string;
  };
}

export interface SimpleBundlerOptions {
  baseDir: string;
  outputDir: string;
  compilerVersion: string;
  target: 'vercel' | 'aws-lambda' | 'local';
  minify: boolean;
  bundleAllDependencies: boolean;
}

export interface AgentBundleResult {
  bundles: AgentBundle[];
  totalSize: number;
  bundlingTime: number;
  metadata: {
    agentCount: number;
    generatedAt: string;
    compilerVersion: string;
  };
}

export class SimpleBundler {
  private baseDir: string;
  private outputDir: string;
  private compilerVersion: string;

  constructor(options: SimpleBundlerOptions) {
    this.baseDir = options.baseDir;
    this.outputDir = options.outputDir;
    this.compilerVersion = options.compilerVersion;
  }

  /**
   * Generate one bundle per agent - simple and clean
   */
  async generateAgentBundles(
    transpileResult: TranspileResult,
    options: Partial<SimpleBundlerOptions> = {}
  ): Promise<AgentBundleResult> {
    const startTime = Date.now();
    
    console.log(`[SIMPLE-BUNDLER] Starting agent bundling...`);
    
    // Extract all agents from the compiled configuration
    const agentDefinitions = extractAgentDefinitionsFromCode(transpileResult.code);
    
    if (agentDefinitions.length === 0) {
      throw new Error('No agents found in configuration');
    }
    
    console.log(`[SIMPLE-BUNDLER] Found ${agentDefinitions.length} agents:`, agentDefinitions.map(a => a.id));
    
    // Ensure output directory exists
    const bundlesDir = join(this.outputDir, 'bundles');
    if (!existsSync(bundlesDir)) {
      mkdirSync(bundlesDir, { recursive: true });
    }
    
    // Generate one bundle per agent
    const bundles: AgentBundle[] = [];
    
    for (const agentDef of agentDefinitions) {
      try {
        console.log(`[SIMPLE-BUNDLER] Creating bundle for agent: ${agentDef.id}`);
        
        const bundle = await this.createSingleAgentBundle(
          transpileResult,
          agentDef,
          bundlesDir,
          options
        );
        
        bundles.push(bundle);
        console.log(`[SIMPLE-BUNDLER] ✅ ${agentDef.id}: ${(bundle.size / 1024 / 1024).toFixed(2)}MB`);
        
      } catch (error) {
        console.error(`[SIMPLE-BUNDLER] ❌ Failed to bundle agent ${agentDef.id}:`, error);
        throw new Error(`Failed to create bundle for agent '${agentDef.id}': ${error}`);
      }
    }
    
    const bundlingTime = Date.now() - startTime;
    const totalSize = bundles.reduce((sum, bundle) => sum + bundle.size, 0);
    
    console.log(`[SIMPLE-BUNDLER] Completed in ${bundlingTime}ms with ${bundles.length} bundles (${(totalSize / 1024 / 1024).toFixed(2)}MB total)`);
    
    return {
      bundles,
      totalSize,
      bundlingTime,
      metadata: {
        agentCount: agentDefinitions.length,
        generatedAt: new Date().toISOString(),
        compilerVersion: this.compilerVersion
      }
    };
  }

  /**
   * Create a single bundle for one agent
   */
  private async createSingleAgentBundle(
    transpileResult: TranspileResult,
    agentDef: any,
    bundlesDir: string,
    options: Partial<SimpleBundlerOptions>
  ): Promise<AgentBundle> {
    
    // Extract only the code for this specific agent
    const agentCode = this.extractAgentSpecificCode(transpileResult.code, agentDef);
    
    // Create bundle with esbuild
    const bundleCode = await this.bundleAgentCode(agentCode, agentDef.id, options);
    
    // Generate content hash
    const hash = createHash('sha256')
      .update(bundleCode)
      .digest('hex')
      .substring(0, 8);

    // Write bundle to file
    const filename = `${agentDef.id}.${hash}.js`;
    const filepath = resolve(bundlesDir, filename);
    writeFileSync(filepath, bundleCode, 'utf-8');

    // Extract dependencies from the original code
    const dependencies = this.extractDependencies(agentCode);

    return {
      id: agentDef.id,
      hash,
      filename,
      filepath,
      size: Buffer.byteLength(bundleCode, 'utf-8'),
      dependencies,
      metadata: {
        id: agentDef.id,
        hash,
        name: agentDef.metadata?.name || agentDef.id,
        description: agentDef.metadata?.description,
        tools: agentDef.metadata?.tools || [],
        models: agentDef.metadata?.models || [],
        compiledAt: new Date().toISOString(),
        compilerVersion: this.compilerVersion
      }
    };
  }

  /**
   * Extract only the code needed for a specific agent
   */
  private extractAgentSpecificCode(compiledCode: string, agentDef: any): string {
    // For now, include the entire config but this could be optimized
    // to only include the specific agent and its dependencies
    
    // Add the agent execution wrapper
    const agentExecutionCode = this.createAgentExecutionWrapper(agentDef.id);
    
    return compiledCode + '\n\n' + agentExecutionCode;
  }

  /**
   * Create the execution wrapper for Vercel functions
   */
  private createAgentExecutionWrapper(agentId: string): string {
    return `
// Agent execution wrapper for Vercel Node.js runtime
export default async function handler(req, res) {
  try {
    // Parse request
    const { input, ...options } = req.body || {};
    
    // Get the agent from the config
    const config = (await import('./config.js')).default;
    const agent = config.agents.${agentId};
    
    if (!agent) {
      return res.status(404).json({ 
        error: 'Agent not found', 
        agentId: '${agentId}' 
      });
    }
    
    // Execute the agent
    const result = await agent.run(input, options);
    
    // Return response
    res.json({
      success: true,
      result,
      agentId: '${agentId}',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Agent execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      agentId: '${agentId}',
      timestamp: new Date().toISOString()
    });
  }
}
`;
  }

  /**
   * Bundle the agent code with esbuild
   */
  private async bundleAgentCode(
    agentCode: string,
    agentId: string,
    options: Partial<SimpleBundlerOptions>
  ): Promise<string> {
    
    // Write temporary file for esbuild
    const tempFile = join(this.outputDir, `temp-${agentId}.js`);
    writeFileSync(tempFile, agentCode, 'utf-8');
    
    try {
      const result = await esbuild({
        entryPoints: [tempFile],
        bundle: true,
        minify: options.minify ?? true,
        platform: 'node',
        target: 'node20',
        format: 'esm',
        external: [], // Bundle everything for now
        write: false,
        treeShaking: true,
        sourcemap: false,
        metafile: false
      });

      if (result.outputFiles && result.outputFiles.length > 0) {
        return result.outputFiles[0].text;
      }
      
      throw new Error('No output generated by esbuild');
      
    } finally {
      // Clean up temporary file
      try {
        const fs = await import('fs');
        fs.unlinkSync(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Extract npm dependencies from code
   */
  private extractDependencies(code: string): string[] {
    const dependencies = new Set<string>();
    
    // Match import statements
    const importMatches = code.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g) || [];
    
    for (const match of importMatches) {
      const moduleMatch = match.match(/from\s+['"]([^'"]+)['"]/);
      if (moduleMatch) {
        const moduleName = moduleMatch[1];
        // Only include npm packages (not relative imports)
        if (!moduleName.startsWith('./') && !moduleName.startsWith('../')) {
          const packageName = moduleName.startsWith('@') 
            ? moduleName.split('/').slice(0, 2).join('/') // @scope/package
            : moduleName.split('/')[0]; // package
          dependencies.add(packageName);
        }
      }
    }
    
    return Array.from(dependencies).sort();
  }
}