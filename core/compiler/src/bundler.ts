import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { TranspileResult } from './transpiler.js';
import { SimpleBundler, type AgentBundleResult } from './simple-bundler.js';
import {
  extractAgentDefinitionsFromCode,
  extractAgentIds,
  hasValidAgentDefinitions,
  type AgentDefinition,
  type AgentASTMetadata,
} from './esbuild-ast-utils.js';

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

export interface NodeJSBundleOutput extends BundleOutput {
  runtime: 'nodejs20.x';
  dependencies: string[];
  bundleType: 'production' | 'development';
  executionMode: 'vercel-function';
}

export interface BundleManifest {
  version: string;
  compiledAt: string;
  compilerVersion: string;
  bundles: {
    id: string;
    hash: string;
    file: string;
    size: number;
    tools: string[];
    models: string[];
  }[];
}

export interface BundlerOptions {
  baseDir: string;
  outputDir?: string;
  compilerVersion?: string;
}

export interface NodeJSBundlerOptions extends BundlerOptions {
  runtime: 'nodejs20.x';
  bundleAllDependencies: boolean;
  target: 'vercel' | 'aws-lambda' | 'local';
  minify?: boolean;
}

export interface DependencyAnalysis {
  agentCount: number;
  agentDependencies: Map<string, string[]>;
  sharedDependencies: string[];
  uniqueDependencies: string[];
  totalDependencies: number;
  sharedRatio: number;
}

export interface BundleAnalysis {
  bundleCount: number;
  totalSizeMB: number;
  avgSizeMB: number;
  maxSizeMB: number;
  minSizeMB: number;
  uniqueDependencies: number;
  duplicatedDependencies: number;
  duplicationRatio: number;
  efficiency: number;
}

/**
 * Generates a content hash for the bundle
 */
function generateHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 8);
}

// /**
//  * Extract agent IDs from compiled code using AST analysis
//  */
// function extractAgentIdsAST(compiledCode: string): string[] {
//   try {
//     const sourceFile = parseCode(compiledCode, 'compiled-config.js');
//     const definitions = findAgentDefinitions(sourceFile);
//     return definitions.map(def => def.id);
//   } catch (error) {
//     console.warn('AST-based agent ID extraction failed:', error);
//     return [];
//   }
// }

// /**
//  * Extract all agent definitions from compiled code using AST analysis
//  */
// function extractAgentDefinitionsAST(compiledCode: string): AgentDefinition[] {
//   try {
//     const sourceFile = parseCode(compiledCode, 'compiled-config.js');
//     return findAgentDefinitions(sourceFile);
//   } catch (error) {
//     console.warn('AST-based agent definitions extraction failed:', error);
//     return [];
//   }
// }

/**
 * Convert AST metadata to bundler metadata format
 */
function convertASTMetadataToBundlerMetadata(astMetadata: AgentASTMetadata): AgentMetadata {
  return {
    name: astMetadata.name,
    description: astMetadata.description || `Agent ${astMetadata.name}`,
    tools: astMetadata.tools,
    models: astMetadata.models,
  };
}

/**
 * Extract agent metadata using AST analysis (replaces regex-based approach)
 */
function extractAgentMetadata(code: string, agentId: string): AgentMetadata {
  try {
    // Use enhanced AST-based metadata extraction
    const definitions = extractAgentDefinitionsFromCode(code);
    const agentDefinition = definitions.find(def => def.id === agentId);
    
    if (agentDefinition) {
      return convertASTMetadataToBundlerMetadata(agentDefinition.metadata);
    }
  } catch (error) {
    console.warn(`Enhanced AST metadata extraction failed for agent '${agentId}':`, error);
  }
  
  // Fallback to basic metadata if AST extraction fails
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
   * Simple agent bundling: one bundle per agent (recommended approach)
   */
  async generateSimpleAgentBundles(
    transpileResult: TranspileResult,
    options: {
      target?: 'vercel' | 'aws-lambda' | 'local';
      minify?: boolean;
      bundleAllDependencies?: boolean;
    } = {}
  ): Promise<AgentBundleResult> {
    const simpleBundler = new SimpleBundler({
      baseDir: this.baseDir,
      outputDir: this.outputDir,
      compilerVersion: this.compilerVersion,
      target: options.target || 'vercel',
      minify: options.minify ?? true,
      bundleAllDependencies: options.bundleAllDependencies ?? true
    });

    return simpleBundler.generateAgentBundles(transpileResult, options);
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
        models: metadata.models ?? [],
        compiledAt: new Date().toISOString(),
        compilerVersion: this.compilerVersion
      }
    };
  }

  /**
   * Generates bundles for multiple agents
   * Parses the compiled config to extract individual agent definitions
   */
  async generateBundles(
    transpileResult: TranspileResult,
    sourcePath: string
  ): Promise<BundleOutput[]> {
    // Extract agent IDs from the compiled configuration
    const agentIds = await this.extractAgentIds(transpileResult.code);
    
    if (agentIds.length === 0) {
      // Fallback to single bundle for backward compatibility
      console.warn('No agents found in configuration, generating single main bundle');
      const bundle = await this.generateBundle(transpileResult, 'main', sourcePath);
      
      // Write source map if available
      if (transpileResult.sourcemap) {
        const mapPath = bundle.filepath + '.map';
        writeFileSync(mapPath, transpileResult.sourcemap, 'utf-8');
      }
      
      this.updateManifest([bundle]);
      return [bundle];
    }

    // Check if we can find proper AST definitions for the agents
    // If not, fall back to main bundle (handles malformed configurations)
    if (!hasValidAgentDefinitions(transpileResult.code) && agentIds.length > 0) {
      console.warn('Found agents but no valid createAgent definitions, generating single main bundle');
      const bundle = await this.generateBundle(transpileResult, 'main', sourcePath);
      
      // Write source map if available
      if (transpileResult.sourcemap) {
        const mapPath = bundle.filepath + '.map';
        writeFileSync(mapPath, transpileResult.sourcemap, 'utf-8');
      }
      
      this.updateManifest([bundle]);
      return [bundle];
    }

    console.log(`Generating ${agentIds.length} agent bundles: ${agentIds.join(', ')}`);
    
    // Generate individual bundles for each agent
    const bundles: BundleOutput[] = [];
    
    for (const agentId of agentIds) {
      const agentBundle = await this.generateAgentBundle(
        transpileResult,
        agentId,
        sourcePath
      );
      bundles.push(agentBundle);
      
      // Write source map for each agent bundle if available
      if (transpileResult.sourcemap) {
        const mapPath = agentBundle.filepath + '.map';
        writeFileSync(mapPath, transpileResult.sourcemap, 'utf-8');
      }
    }
    
    // Write manifest for all bundles
    this.updateManifest(bundles);
    
    return bundles;
  }

  /**
   * Extracts agent IDs from the compiled configuration using AST analysis
   */
  private async extractAgentIds(compiledCode: string): Promise<string[]> {
    try {
      // Use enhanced AST-based analysis first (most reliable)
      const astAgentIds = extractAgentIds(compiledCode);
      if (astAgentIds.length > 0) {
        console.log(`Found ${astAgentIds.length} agents via enhanced AST analysis:`, astAgentIds);
        return astAgentIds;
      }

      // Fallback to static regex parsing if enhanced AST fails
      const staticAgentIds = this.extractAgentIdsStatic(compiledCode);
      if (staticAgentIds.length > 0) {
        console.log(`Found ${staticAgentIds.length} agents via static regex (fallback):`, staticAgentIds);
        return staticAgentIds;
      }

      // Final fallback to dynamic evaluation for complex cases
      return await this.extractAgentIdsDynamic(compiledCode);
      
    } catch (error) {
      console.warn('Failed to extract agent IDs from configuration:', error);
      return [];
    }
  }

  /**
   * Static analysis to extract agent IDs using regex
   * Safer approach that doesn't require module execution
   */
  private extractAgentIdsStatic(compiledCode: string): string[] {
    try {
      // Look for agents object pattern: agents: { agentName: ..., anotherAgent: ... }
      const agentsRegex = /agents\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s;
      const agentsMatch = compiledCode.match(agentsRegex);
      
      if (!agentsMatch) {
        return [];
      }

      const agentsContent = agentsMatch[1];
      
      // Extract property names (agent IDs) from the agents object
      // Match: agentName: { or 'agentName': { or "agentName": {
      const agentIdRegex = /(?:^|,)\s*(?:([a-zA-Z_$][a-zA-Z0-9_$]*)|['"]([^'"]+)['"])\s*:/gm;
      const agentIds: string[] = [];
      
      let match: RegExpExecArray | null;
      while ((match = agentIdRegex.exec(agentsContent)) !== null) {
        const agentId = match[1] || match[2]; // Either unquoted or quoted property name
        if (agentId && typeof agentId === 'string' && !agentIds.includes(agentId)) {
          agentIds.push(agentId);
        }
      }

      return agentIds.filter(id => 
        // Filter out common JavaScript keywords/properties that might be false positives
        !['constructor', 'prototype', 'length', 'name', 'toString'].includes(id)
      );
      
    } catch (error) {
      console.warn('Static agent ID extraction failed:', error);
      return [];
    }
  }

  /**
   * Dynamic evaluation fallback for complex configurations
   * Strips imports to avoid module resolution issues
   */
  private async extractAgentIdsDynamic(compiledCode: string): Promise<string[]> {
    try {
      // Create a temporary file to safely evaluate the compiled config
      const tempFile = resolve(tmpdir(), `lightfast-config-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.mjs`);
      
      // Strip imports to avoid module resolution issues and create a safe evaluation environment
      let moduleCode = this.stripImportsAndCreateSafeCode(compiledCode);
      
      writeFileSync(tempFile, moduleCode, 'utf-8');
      
      try {
        // Dynamic import the temporary module
        const configModule = await import(`file://${tempFile}`);
        const config = configModule.default || configModule;
        
        // Extract agent names from the agents object
        if (config && typeof config === 'object' && config.agents) {
          const agentIds = Object.keys(config.agents);
          console.log(`Found ${agentIds.length} agents via dynamic evaluation:`, agentIds);
          return agentIds;
        }
        
        console.warn('No agents object found in configuration');
        return [];
        
      } finally {
        // Clean up temporary file
        try {
          unlinkSync(tempFile);
        } catch (cleanupError) {
          console.warn('Failed to cleanup temporary file:', cleanupError);
        }
      }
      
    } catch (error) {
      console.warn('Dynamic agent ID extraction failed:', error);
      return [];
    }
  }

  /**
   * Strips imports and creates safe code for evaluation
   */
  private stripImportsAndCreateSafeCode(compiledCode: string): string {
    // Strip all import statements
    let safeCode = compiledCode
      .replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '')
      .replace(/import\s+['"].*?['"];?\s*/g, '');

    // Create mock functions for common Lightfast functions that might be called
    const mockFunctions = `
// Mock Lightfast functions to avoid import errors
const createLightfast = (config) => config;
const createAgent = (config) => config;
const gateway = (model) => model;

// Mock commonly imported modules
const mockModule = { default: {}, createLightfast, createAgent, gateway };
`;

    // Add module export if not present
    if (!safeCode.includes('export default') && !safeCode.includes('export {')) {
      safeCode = `${mockFunctions}\n${safeCode}\nexport default module.exports || {};`;
    } else {
      safeCode = `${mockFunctions}\n${safeCode}`;
    }

    return safeCode;
  }

  /**
   * Generates an individual agent bundle with only that agent's configuration
   * NEW APPROACH: Individual agent analysis instead of mega-bundle extraction
   */
  private async generateAgentBundle(
    transpileResult: TranspileResult,
    agentId: string,
    sourcePath: string
  ): Promise<BundleOutput> {
    if (transpileResult.errors.length > 0) {
      throw new Error(`Cannot bundle due to transpilation errors: ${transpileResult.errors.join(', ')}`);
    }

    // Extract metadata for this specific agent
    const metadata = extractAgentMetadata(transpileResult.code, agentId);
    
    // NEW: Generate clean, minimal agent bundle by individual analysis
    const agentSpecificCode = await this.generateMinimalAgentBundle(transpileResult.code, agentId, sourcePath);
    
    // Generate hash from the agent-specific code
    const hash = generateHash(agentSpecificCode);
    
    // Wrap in agent-specific bundle format
    const bundleCode = this.wrapInAgentBundleFormat(
      agentSpecificCode,
      agentId,
      hash,
      metadata,
      this.compilerVersion
    );

    // Ensure bundles directory exists
    const bundlesDir = resolve(this.outputDir, 'bundles');
    if (!existsSync(bundlesDir)) {
      mkdirSync(bundlesDir, { recursive: true });
    }

    // Write bundle file with agent name and hash
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
        models: metadata.models ?? [],
        compiledAt: new Date().toISOString(),
        compilerVersion: this.compilerVersion
      }
    };
  }

  /**
   * NEW: Generates minimal agent bundle by individual analysis (Next.js-inspired)
   * Uses AST-based analysis for clean, reliable agent extraction
   */
  private async generateMinimalAgentBundle(
    compiledCode: string, 
    agentId: string,
    sourcePath: string
  ): Promise<string> {
    try {
      // Use enhanced AST to find agent definition
      const definitions = extractAgentDefinitionsFromCode(compiledCode);
      const agentDefinition = definitions.find(def => def.id === agentId);
      
      if (!agentDefinition) {
        throw new Error(`Agent '${agentId}' not found in compiled configuration`);
      }
      
      // Extract only the required code for this specific agent
      return this.extractAgentSpecificCode(compiledCode, agentId, agentDefinition);
      
    } catch (error) {
      console.warn(`Failed to generate minimal bundle for agent '${agentId}':`, error);
      // Fallback to full compiled code
      return compiledCode;
    }
  }

  /**
   * Extract agent-specific code by filtering out other agents
   * FIXED: Now properly extracts tool definitions that agents reference
   */
  private extractAgentSpecificCode(
    compiledCode: string,
    targetAgentId: string, 
    agentDefinition: AgentDefinition
  ): string {
    console.log(`[BUNDLER] Extracting agent-specific code for: ${targetAgentId}`);
    console.log(`[BUNDLER] Agent uses tools:`, agentDefinition.metadata.tools);
    
    // Find all agent definitions to filter out others
    const allDefinitions = extractAgentDefinitionsFromCode(compiledCode);
    const otherAgentIds = allDefinitions
      .filter(def => def.id !== targetAgentId)
      .map(def => def.id);
    
    let filteredCode = compiledCode;
    
    // STEP 1: Extract tool definitions that THIS agent actually needs
    const requiredToolDefinitions = this.extractRequiredToolDefinitions(compiledCode, agentDefinition);
    console.log(`[BUNDLER] Found ${requiredToolDefinitions.length} required tool definitions`);
    
    // STEP 2: Remove other agent variable declarations
    for (const otherAgentId of otherAgentIds) {
      const otherDefinition = allDefinitions.find(def => def.id === otherAgentId);
      if (otherDefinition) {
        // Remove the agent variable declaration
        const agentVarRegex = new RegExp(
          `(?:const|let|var)\\s+${otherDefinition.variableName}\\s*=\\s*createAgent\\d*\\s*\\([\\s\\S]*?\\}\\s*\\);?\\s*`, 
          'g'
        );
        filteredCode = filteredCode.replace(agentVarRegex, '');
      }
    }
    
    // STEP 3: Remove other agents from the agents object, keeping only the target
    const agentsObjectMatch = filteredCode.match(/agents\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
    if (agentsObjectMatch) {
      const agentsContent = agentsObjectMatch[1];
      const agentsObjectFull = agentsObjectMatch[0];
      
      // Find the target agent property in the agents object
      const targetAgentProperty = this.extractAgentProperty(agentsContent, targetAgentId);
      
      if (targetAgentProperty) {
        // Replace the entire agents object with only the target agent
        const newAgentsObject = `agents: {\n    ${targetAgentId}: ${targetAgentProperty}\n  }`;
        filteredCode = filteredCode.replace(agentsObjectFull, newAgentsObject);
      }
    }
    
    // STEP 4: Remove unused tool definitions (but keep the ones this agent needs)
    filteredCode = this.filterUnusedToolDefinitions(filteredCode, requiredToolDefinitions);
    
    // STEP 5: Clean up redundant imports and normalize import names
    filteredCode = this.cleanupImports(filteredCode, targetAgentId, agentDefinition);
    
    return filteredCode;
  }

  /**
   * Extract the property assignment for a specific agent from agents object content
   */
  private extractAgentProperty(agentsContent: string, targetAgentId: string): string | null {
    // Find the property for the target agent
    const targetPropertyRegex = new RegExp(
      `(?:^|,)\\s*(?:${targetAgentId}|["']${targetAgentId}["'])\\s*:\\s*([a-zA-Z_$][a-zA-Z0-9_$]*|createAgent\\d*\\s*\\([\\s\\S]*?\\}\\s*\\))`,
      'm'
    );
    
    const match = agentsContent.match(targetPropertyRegex);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    return null;
  }

  /**
   * FIXED: Extract tool definitions that are actually referenced by the target agent
   * This replaces the broken extractReferencedTools method
   */
  private extractRequiredToolDefinitions(compiledCode: string, agentDefinition: AgentDefinition): string[] {
    const toolDefinitions: string[] = [];
    
    // If agent doesn't use tools, return empty array
    if (!agentDefinition.metadata.tools || agentDefinition.metadata.tools.length === 0) {
      console.log(`[BUNDLER] Agent ${agentDefinition.id} uses no tools`);
      return [];
    }
    
    console.log(`[BUNDLER] Looking for tool definitions for tools:`, agentDefinition.metadata.tools);
    
    // Find the actual agent variable definition to see what tool variables it references
    const agentVarRegex = new RegExp(
      `(?:const|let|var)\\s+${agentDefinition.variableName}\\s*=\\s*createAgent\\d*\\s*\\([\\s\\S]*?\\}\\s*\\)`,
      'g'
    );
    
    const agentDefMatch = compiledCode.match(agentVarRegex);
    if (!agentDefMatch) {
      console.warn(`[BUNDLER] Could not find agent definition for ${agentDefinition.variableName}`);
      return [];
    }
    
    const agentDefinitionCode = agentDefMatch[0];
    console.log(`[BUNDLER] Found agent definition, extracting tool variable references...`);
    
    // Extract tool variable references from the agent definition
    // Pattern: toolName: toolVariableName
    const toolRefRegex = /(?:^|[,\s])([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    const toolVariableNames: string[] = [];
    let match;
    
    while ((match = toolRefRegex.exec(agentDefinitionCode)) !== null) {
      const toolKey = match[1];
      const toolVariable = match[2];
      
      // Check if this corresponds to a tool name from AST metadata
      if (agentDefinition.metadata.tools.includes(toolKey)) {
        console.log(`[BUNDLER] Found tool reference: ${toolKey} -> ${toolVariable}`);
        toolVariableNames.push(toolVariable);
      }
    }
    
    // Now find the actual tool definitions for these variables
    for (const toolVarName of toolVariableNames) {
      const toolDefinition = this.extractToolDefinition(compiledCode, toolVarName);
      if (toolDefinition) {
        console.log(`[BUNDLER] Extracted tool definition for: ${toolVarName}`);
        toolDefinitions.push(toolDefinition);
      } else {
        console.warn(`[BUNDLER] Could not find tool definition for: ${toolVarName}`);
      }
    }
    
    return toolDefinitions;
  }

  /**
   * FIXED: Extract a single tool definition using improved parsing
   * This replaces the complex and error-prone extractReferencedTools method
   */
  private extractToolDefinition(code: string, toolVarName: string): string | null {
    console.log(`[BUNDLER] Searching for tool definition: ${toolVarName}`);
    
    // Find the tool definition - more reliable approach
    const toolDefStartRegex = new RegExp(
      `(const|let|var)\\s+${toolVarName}\\s*=\\s*createTool\\d*\\s*\\(`
    );
    
    const startMatch = code.match(toolDefStartRegex);
    if (!startMatch) {
      console.log(`[BUNDLER] No tool definition found for: ${toolVarName}`);
      return null;
    }
    
    const startIndex = code.indexOf(startMatch[0]);
    
    // Find the end of the tool definition by counting parentheses
    let parenCount = 0;
    let inString = false;
    let escapeNext = false;
    let currentQuote = '';
    let i = startIndex;
    
    // Find the opening parenthesis of createTool(
    while (i < code.length && code[i] !== '(') {
      i++;
    }
    
    if (i >= code.length) {
      console.warn(`[BUNDLER] Could not find opening parenthesis for ${toolVarName}`);
      return null;
    }
    
    parenCount = 1;
    i++; // Move past the opening (
    
    // Count parentheses to find the matching closing one
    while (i < code.length && parenCount > 0) {
      const char = code[i];
      
      if (escapeNext) {
        escapeNext = false;
      } else if (char === '\\' && inString) {
        escapeNext = true;
      } else if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        currentQuote = char;
      } else if (inString && char === currentQuote) {
        inString = false;
        currentQuote = '';
      } else if (!inString) {
        if (char === '(') {
          parenCount++;
        } else if (char === ')') {
          parenCount--;
        }
      }
      i++;
    }
    
    // Find the semicolon after the closing parenthesis
    while (i < code.length && /\s/.test(code[i])) {
      i++;
    }
    if (i < code.length && code[i] === ';') {
      i++;
    }
    
    const toolDefinition = code.substring(startIndex, i).trim();
    console.log(`[BUNDLER] Successfully extracted tool definition for ${toolVarName} (${toolDefinition.length} chars)`);
    
    return toolDefinition;
  }

  /**
   * FIXED: Filter out tool definitions that are not needed by this agent
   * Keep only the tool definitions that are actually required
   */
  private filterUnusedToolDefinitions(code: string, requiredToolDefinitions: string[]): string {
    if (requiredToolDefinitions.length === 0) {
      console.log(`[BUNDLER] No tools required, removing all tool definitions`);
      return this.removeAllToolDefinitions(code);
    }
    
    console.log(`[BUNDLER] Filtering to keep only ${requiredToolDefinitions.length} required tool definitions`);
    
    // Remove all tool definitions first
    let filteredCode = this.removeAllToolDefinitions(code);
    
    // Add back the required tool definitions at the top (after imports)
    const lines = filteredCode.split('\n');
    const importEndIndex = this.findImportEndIndex(lines);
    
    // Insert required tool definitions after imports
    const beforeImports = lines.slice(0, importEndIndex + 1);
    const afterImports = lines.slice(importEndIndex + 1);
    
    const resultLines = [
      ...beforeImports,
      '',
      '// Required tool definitions',
      ...requiredToolDefinitions.map(def => def.trim()),
      '',
      ...afterImports
    ];
    
    return resultLines.join('\n');
  }
  
  /**
   * Remove all tool definitions from code
   */
  private removeAllToolDefinitions(code: string): string {
    let result = code;
    
    // Remove tool definitions with improved regex
    const toolDefinitionRegex = /(?:^|\n)(?:const|let|var)\s+\w+(?:Tool|tool)\s*=\s*createTool\d*\s*\([\s\S]*?\);?\s*(?=\n|$)/gm;
    result = result.replace(toolDefinitionRegex, '');
    
    // Clean up extra blank lines
    result = result.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return result;
  }
  
  /**
   * Find the index where imports end in the lines array
   */
  private findImportEndIndex(lines: string[]): number {
    let lastImportIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ') && line.includes(' from ')) {
        lastImportIndex = i;
      } else if (line.startsWith('//') && (line.includes('Generated by') || line.includes('.ts'))) {
        // Comment lines are often between imports
        continue;
      } else if (line === '' || line.startsWith('//')) {
        // Empty lines or comments after imports
        continue;
      } else if (lastImportIndex >= 0) {
        // Non-import line found after imports, stop here
        break;
      }
    }
    
    return Math.max(lastImportIndex, 2); // Ensure we're past the header comment
  }


  /**
   * Clean up imports by removing unused ones and normalizing numbered imports
   */
  private cleanupImports(
    filteredCode: string,
    targetAgentId: string,
    agentDefinition: AgentDefinition
  ): string {
    // Find what imports are actually used by analyzing the remaining code
    const usedImports = this.analyzeUsedImports(filteredCode, targetAgentId);
    
    // Extract all imports and filter to only used ones
    const lines = filteredCode.split('\n');
    const cleanedLines: string[] = [];
    const importMap = new Map<string, string>(); // Maps numbered imports to clean names
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip import lines - we'll rebuild them
      if (trimmedLine.startsWith('import ') && trimmedLine.includes(' from ')) {
        continue;
      }
      
      // Skip comment lines between imports
      if (trimmedLine.startsWith('//') && 
          (trimmedLine.includes('.ts') || trimmedLine.includes('Generated by'))) {
        continue;
      }
      
      // Add non-import lines
      cleanedLines.push(line);
    }
    
    // Build clean imports at the top
    const cleanImports = this.buildCleanImports(usedImports);
    
    // Normalize numbered references in the code
    let cleanedCode = cleanedLines.join('\n');
    cleanedCode = this.normalizeNumberedReferences(cleanedCode);
    
    // Combine clean imports + cleaned code
    return cleanImports.join('\n') + '\n' + cleanedCode;
  }

  /**
   * FIXED: Analyze which imports are actually used in the filtered code
   * Now properly detects tool-related imports
   */
  private analyzeUsedImports(filteredCode: string, targetAgentId: string): Set<string> {
    const usedImports = new Set<string>();
    
    console.log(`[BUNDLER] Analyzing used imports for agent: ${targetAgentId}`);
    
    // Always need createLightfast for the main config
    if (filteredCode.includes('createLightfast')) {
      usedImports.add('lightfast/client:createLightfast');
      console.log(`[BUNDLER] Adding import: createLightfast`);
    }
    
    // Check for createAgent usage (with or without numbers)
    if (/createAgent\d*\s*\(/.test(filteredCode)) {
      usedImports.add('lightfast/agent:createAgent');
      console.log(`[BUNDLER] Adding import: createAgent`);
    }
    
    // Check for gateway usage (with or without numbers) 
    if (/gateway\d*\s*\(/.test(filteredCode)) {
      usedImports.add('@ai-sdk/gateway:gateway');
      console.log(`[BUNDLER] Adding import: gateway`);
    }
    
    // FIXED: Check for createTool usage - this is critical for tool definitions
    if (/createTool\d*\s*\(/.test(filteredCode)) {
      usedImports.add('lightfast/tool:createTool');
      console.log(`[BUNDLER] Adding import: createTool`);
    }
    
    // FIXED: Check for zod usage - often needed for tool input schemas
    if (/\bz\d*\./.test(filteredCode)) {
      usedImports.add('zod:z');
      console.log(`[BUNDLER] Adding import: z (zod)`);
    }
    
    console.log(`[BUNDLER] Total imports found:`, usedImports.size);
    return usedImports;
  }

  /**
   * Build clean import statements from used imports
   */
  private buildCleanImports(usedImports: Set<string>): string[] {
    const imports: string[] = [];
    
    // Add header comment
    imports.push('// Generated by Lightfast CLI from lightfast.config.ts');
    
    // Group imports by module
    const modules = new Map<string, string[]>();
    
    for (const importSpec of usedImports) {
      const [modulePath, exportName] = importSpec.split(':');
      if (!modules.has(modulePath)) {
        modules.set(modulePath, []);
      }
      modules.get(modulePath)!.push(exportName);
    }
    
    // Generate clean import statements
    for (const [modulePath, exportNames] of modules.entries()) {
      if (exportNames.length === 1) {
        imports.push(`import { ${exportNames[0]} } from "${modulePath}";`);
      } else {
        imports.push(`import { ${exportNames.join(', ')} } from "${modulePath}";`);
      }
    }
    
    return imports;
  }

  /**
   * Normalize numbered references in code (createAgent6 -> createAgent, gateway2 -> gateway)
   */
  private normalizeNumberedReferences(code: string): string {
    return code
      .replace(/createAgent\d+/g, 'createAgent')
      .replace(/gateway\d+/g, 'gateway')  
      .replace(/createTool\d+/g, 'createTool')
      .replace(/\bz\d+\./g, 'z.');
  }

  /**
   * Get the actual variable name for an agent (handles naming inconsistencies)
   */
  private getAgentVariableName(compiledCode: string, agentId: string): string {
    const agentsConfigRegex = /agents\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s;
    const agentsMatch = compiledCode.match(agentsConfigRegex);
    
    if (agentsMatch) {
      const agentMappingRegex = new RegExp(`${agentId}\\s*:\\s*([a-zA-Z_$][a-zA-Z0-9_$]*)`);
      const mappingMatch = agentsMatch[1].match(agentMappingRegex);
      if (mappingMatch) {
        return mappingMatch[1];
      }
    }
    
    return `${agentId}Agent`; // Default fallback
  }

  /**
   * Extract clean agent definition and any referenced tools/dependencies
   */
  private extractCleanAgentDefinition(compiledCode: string, agentVarName: string): string {
    const agentDefRegex = new RegExp(
      `((?:var|const|let)\\s+${agentVarName}\\s*=\\s*createAgent[\\d]*\\s*\\([\\s\\S]*?\\}\\);?)`,
      'gm'
    );
    
    const agentDefMatch = compiledCode.match(agentDefRegex);
    if (!agentDefMatch) {
      throw new Error(`Could not find clean agent definition for '${agentVarName}'`);
    }
    
    const agentDefinition = agentDefMatch[0];
    
    // Extract any tool definitions that this agent references
    const toolDefinitions = this.extractReferencedTools(compiledCode, agentDefinition);
    
    // Combine tool definitions with agent definition
    if (toolDefinitions.length > 0) {
      return `${toolDefinitions.join('\n\n')}\n\n${agentDefinition}`;
    }
    
    return agentDefinition;
  }
  
  /**
   * Extract tool definitions that are referenced by the agent
   */
  private extractReferencedTools(compiledCode: string, agentDefinition: string): string[] {
    const toolDefinitions: string[] = [];
    
    // Look for tool references in the agent definition (e.g., "searchKB: searchKnowledgeBaseTool")
    const toolRefRegex = /(\w+):\s*(\w+Tool)/g;
    let match;
    
    while ((match = toolRefRegex.exec(agentDefinition)) !== null) {
      const toolVarName = match[2]; // e.g., "searchKnowledgeBaseTool"
      
      // Find the tool definition - need to match nested braces properly
      const toolDefRegex = new RegExp(
        `((?:const|let|var)\\s+${toolVarName}\\s*=\\s*createTool[\\d]*\\s*\\([\\s\\S]*?\\}\\);?)`,
        'gm'
      );
      
      // Alternative approach: find the start and manually count braces
      const toolStartRegex = new RegExp(`(const|let|var)\\s+${toolVarName}\\s*=\\s*createTool[\\d]*\\s*\\(`);
      const toolStartMatch = compiledCode.match(toolStartRegex);
      
      if (toolStartMatch) {
        const startIndex = compiledCode.indexOf(toolStartMatch[0]);
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;
        let currentQuote = '';
        let i = startIndex;
        
        // Find the opening brace of createTool(
        while (i < compiledCode.length && compiledCode[i] !== '(') {
          i++;
        }
        
        if (i < compiledCode.length) {
          braceCount = 1;
          i++; // Move past the opening (
          
          // Count braces to find the end
          while (i < compiledCode.length && braceCount > 0) {
            const char = compiledCode[i];
            
            if (escapeNext) {
              escapeNext = false;
            } else if (char === '\\' && inString) {
              escapeNext = true;
            } else if (!inString && (char === '"' || char === "'" || char === '`')) {
              inString = true;
              currentQuote = char;
            } else if (inString && char === currentQuote) {
              inString = false;
              currentQuote = '';
            } else if (!inString) {
              if (char === '(' || char === '{') {
                braceCount++;
              } else if (char === ')' || char === '}') {
                braceCount--;
              }
            }
            i++;
          }
          
          // Find the semicolon after the closing brace
          while (i < compiledCode.length && /\s/.test(compiledCode[i])) {
            i++;
          }
          if (i < compiledCode.length && compiledCode[i] === ';') {
            i++;
          }
          
          const toolDefinition = compiledCode.substring(startIndex, i);
          if (!toolDefinitions.includes(toolDefinition)) {
            toolDefinitions.push(toolDefinition);
          }
        }
      }
    }
    
    return toolDefinitions;
  }

  /**
   * Analyze what imports this specific agent actually needs (minimal analysis)
   */
  private analyzeMinimalImports(agentDefinition: string): string[] {
    const requiredImports: string[] = [];
    
    // Always need createAgent
    requiredImports.push('import { createAgent } from "lightfast/agent";');
    
    // Check if agent uses gateway (with or without numbered suffix)
    if (agentDefinition.includes('gateway(') || /gateway\d+\(/.test(agentDefinition)) {
      requiredImports.push('import { gateway } from "@ai-sdk/gateway";');
    }
    
    // Check if agent uses tools
    if (agentDefinition.includes('createTool(') || /createTool\d+\(/.test(agentDefinition)) {
      requiredImports.push('import { createTool } from "lightfast/tool";');
    }
    
    // Check if agent uses zod for schema validation (common with tools)
    if (agentDefinition.includes('z.') || /z\d+\./.test(agentDefinition)) {
      requiredImports.push('import { z } from "zod";');
    }
    
    // TODO: Add analysis for other imports like custom functions, specific model providers, etc.
    // This can be expanded as needed for more complex agents
    
    return requiredImports;
  }

  /**
   * Assemble minimal, clean agent bundle
   */
  private assembleMinimalBundle(
    imports: string[],
    agentDefinition: string,
    agentId: string,
    actualVarName: string
  ): string {
    // Clean the agent definition to remove numbered aliases
    const cleanAgentDef = agentDefinition
      .replace(/createAgent\d+/g, 'createAgent')  // createAgent6 → createAgent  
      .replace(/gateway\d+/g, 'gateway');         // gateway2 → gateway

    return `// Agent-specific bundle for: ${agentId}
${imports.join('\n')}

${cleanAgentDef}

// Export the isolated agent configuration
export const targetAgentId = "${agentId}";
export function getTargetAgent() {
  return ${actualVarName};
}

// Clean minimal bundle - no pollution from other agents`;
  }

  /**
   * LEGACY: Old approach - extracts from mega-bundle (creates import pollution)
   * TODO: Remove once new approach is verified
   */
  private async extractAgentCode(compiledCode: string, agentId: string): Promise<string> {
    try {
      // Parse the compiled code to extract only the specific agent and its dependencies
      const isolatedCode = await this.isolateAgentCode(compiledCode, agentId);
      
      // Extract the actual variable name from the agents config
      const agentsConfigRegex = /agents\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s;
      const agentsMatch = compiledCode.match(agentsConfigRegex);
      
      let actualVarName = `${agentId}Agent`; // Default fallback
      
      if (agentsMatch) {
        const agentMappingRegex = new RegExp(`${agentId}\\s*:\\s*([a-zA-Z_$][a-zA-Z0-9_$]*)`);
        const mappingMatch = agentsMatch[1].match(agentMappingRegex);
        if (mappingMatch) {
          actualVarName = mappingMatch[1];
        }
      }
      
      return `// Agent-specific bundle for: ${agentId}
${isolatedCode}

// Export the isolated agent configuration
export const targetAgentId = "${agentId}";
export function getTargetAgent() {
  return ${actualVarName};
}

// No duplicate export default - the wrapper will add the final export`;
      
    } catch (error) {
      console.warn(`Failed to isolate agent ${agentId}, using fallback approach:`, error);
      return this.createFallbackAgentCode(compiledCode, agentId);
    }
  }

  /**
   * Isolates a specific agent by extracting only its definition and required imports
   */
  private async isolateAgentCode(compiledCode: string, agentId: string): Promise<string> {
    // Extract all imports (we'll need them for dependencies)
    const importRegex = /^import\s+.*?from\s+['"].*?['"];?$/gm;
    const imports = compiledCode.match(importRegex) || [];
    
    // Extract the agents configuration to find the actual variable name
    const agentsConfigRegex = /agents\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s;
    const agentsMatch = compiledCode.match(agentsConfigRegex);
    
    let actualVarName = `${agentId}Agent`; // Default fallback
    
    if (agentsMatch) {
      // Look for the specific agent mapping: agentId: actualVariableName
      const agentMappingRegex = new RegExp(`${agentId}\\s*:\\s*([a-zA-Z_$][a-zA-Z0-9_$]*)`);
      const mappingMatch = agentsMatch[1].match(agentMappingRegex);
      if (mappingMatch) {
        actualVarName = mappingMatch[1];
      }
    }
    
    // Find the specific agent definition using the actual variable name
    // Need to match the full agent definition including closing braces
    const agentDefRegex = new RegExp(
      `((?:var|const|let)\\s+${actualVarName}\\s*=\\s*createAgent[\\d]*\\s*\\([\\s\\S]*?\\}\\);?)`,
      'gm'
    );
    
    const agentDefMatch = compiledCode.match(agentDefRegex);
    if (!agentDefMatch) {
      throw new Error(`Could not find agent definition for '${agentId}' (looking for '${actualVarName}')`);
    }

    // Extract agent-specific imports by looking at the agent definition
    const agentDefinition = agentDefMatch[0];
    const requiredImports = this.extractRequiredImports(agentDefinition, imports);

    // Also check if agent is imported from a separate file
    const agentImportRegex = new RegExp(
      `import\\s*\\{[^}]*${actualVarName}[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`,
      'g'
    );
    
    const agentImportMatch = compiledCode.match(agentImportRegex);
    if (agentImportMatch) {
      // Agent is imported from external file, we need to include that import
      requiredImports.push(agentImportMatch[0]);
      
      // Also need to extract the actual agent code if it's inlined
      const inlineAgentRegex = new RegExp(
        `// ${agentId}[\\s\\S]*?var\\s+${actualVarName}\\s*=[\\s\\S]*?\\);`,
        'g'
      );
      
      const inlineAgentMatch = compiledCode.match(inlineAgentRegex);
      if (inlineAgentMatch) {
        return [
          ...requiredImports,
          '',
          inlineAgentMatch[0],
          ''
        ].join('\n');
      }
    }

    // Combine isolated components
    return [
      ...requiredImports,
      '',
      agentDefinition,
      ''
    ].join('\n');
  }

  /**
   * Extracts required imports for an agent definition
   */
  private extractRequiredImports(agentDefinition: string, allImports: string[]): string[] {
    const requiredImports: string[] = [];
    
    // Common imports that agents typically need
    const commonImports = [
      'createAgent',
      'gateway',
      'createLightfast'
    ];
    
    // Check which imports are actually used in the agent definition
    for (const importStatement of allImports) {
      for (const commonImport of commonImports) {
        if (importStatement.includes(commonImport) && 
            (agentDefinition.includes(commonImport) || 
             importStatement.includes('lightfast/') ||
             importStatement.includes('@ai-sdk/'))) {
          requiredImports.push(importStatement);
          break;
        }
      }
    }
    
    return [...new Set(requiredImports)]; // Remove duplicates
  }

  /**
   * Fallback method when sophisticated isolation fails
   */
  private createFallbackAgentCode(compiledCode: string, agentId: string): string {
    return `// Fallback agent bundle for: ${agentId}
${compiledCode}

// Export only the specific agent configuration  
export const targetAgentId = "${agentId}";
export function getTargetAgent(config) {
  if (config && config.agents && config.agents["${agentId}"]) {
    return config.agents["${agentId}"];
  }
  throw new Error("Agent '${agentId}' not found in configuration");
}`;
  }

  /**
   * Wraps agent-specific code in the bundle format
   */
  private wrapInAgentBundleFormat(
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

    // Create the agent-specific bundle wrapper with AST-generated markers
    const bundleCode = `// Lightfast Agent Bundle - ${agentId}
// Generated at: ${bundleMetadata.compiledAt}
// Hash: ${hash}
// AST-generated

// Target agent identifier for this bundle
export const targetAgentId = "${agentId}";

${code}

// Target agent extraction function
export function getTargetAgent() {
  const config = (typeof module !== 'undefined' && module.exports) || {};
  if (config.agents && config.agents["${agentId}"]) {
    return config.agents["${agentId}"];
  }
  return null;
}

// Bundle export format for agent: ${agentId}
export default {
  // Identity
  id: "${bundleMetadata.id}",
  hash: "${bundleMetadata.hash}",
  
  // Metadata
  metadata: ${JSON.stringify(bundleMetadata, null, 2).split('\n').map((line, i) => i === 0 ? line : '  ' + line).join('\n')},
  
  // The isolated agent configuration
  agent: getTargetAgent(),
  
  // Execute function for this specific agent
  async execute(params, context) {
    const runtime = globalThis.__lightfastRuntime;
    if (!runtime) {
      throw new Error('Lightfast runtime not available');
    }
    return runtime.executeAgent(this.agent, params, context);
  }
};
`;

    return bundleCode;
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
   * Extract clean agent code from AST definition
   */
  private extractAgentCodeFromAST(compiledCode: string, agentDefinition: AgentDefinition): string {
    // For now, we'll extract the agent code using a simple approach
    // In the future, we could use more sophisticated AST transformations
    
    try {
      // Find the variable definition in the code
      const lines = compiledCode.split('\n');
      let agentCode = '';
      let inAgentDefinition = false;
      let braceCount = 0;
      
      for (const line of lines) {
        if (line.includes(`${agentDefinition.variableName} = createAgent`)) {
          inAgentDefinition = true;
          agentCode = line;
          braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
          
          if (braceCount === 0) {
            // Single line definition
            break;
          }
          continue;
        }
        
        if (inAgentDefinition) {
          agentCode += '\n' + line;
          braceCount += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
          
          if (braceCount <= 0) {
            break;
          }
        }
      }
      
      return agentCode || `// Agent definition for ${agentDefinition.id} not found`;
      
    } catch (error) {
      console.warn(`Failed to extract agent code for ${agentDefinition.id}:`, error);
      return `// Failed to extract agent code for ${agentDefinition.id}`;
    }
  }

  /**
   * Analyze minimal imports required for agent code using AST
   */
  private analyzeMinimalImportsFromAST(compiledCode: string, agentCode: string): string[] {
    const requiredImports: string[] = [];
    
    // Always need createAgent
    requiredImports.push('import { createAgent } from "lightfast/agent";');
    
    // Check if agent uses gateway (with or without numbered suffix)
    if (agentCode.includes('gateway(') || /gateway\d+\(/.test(agentCode)) {
      requiredImports.push('import { gateway } from "@ai-sdk/gateway";');
    }
    
    // Check if agent uses tools
    if (agentCode.includes('createTool(') || /createTool\d+\(/.test(agentCode)) {
      requiredImports.push('import { createTool } from "lightfast/tool";');
    }
    
    // Check if agent uses zod for schema validation (common with tools)
    if (agentCode.includes('z.') || /z\d+\./.test(agentCode)) {
      requiredImports.push('import { z } from "zod";');
    }
    
    return requiredImports;
  }

  /**
   * Assemble minimal, clean agent bundle using AST-extracted information
   */
  private assembleMinimalBundleFromAST(
    imports: string[],
    agentCode: string,
    agentId: string,
    actualVarName: string
  ): string {
    // Clean the agent code to remove numbered aliases
    const cleanAgentCode = agentCode
      .replace(/createAgent\d+/g, 'createAgent')  // createAgent6 → createAgent  
      .replace(/gateway\d+/g, 'gateway');         // gateway2 → gateway

    return `// Agent-specific bundle for: ${agentId} (AST-generated)
${imports.join('\n')}

${cleanAgentCode}

// Export the isolated agent configuration
export const targetAgentId = "${agentId}";
export function getTargetAgent() {
  return ${actualVarName};
}

// Clean minimal bundle - no pollution from other agents (AST-based)`;
  }

  /**
   * Gets the output directory
   */
  getOutputDir(): string {
    return this.outputDir;
  }

  /**
   * Generate optimized multi-agent bundles with intelligent strategies
   * Analyzes dependency patterns and chooses the best bundling approach
   */
  async generateMultiAgentBundles(
    transpileResult: TranspileResult,
    options: Partial<NodeJSBundlerOptions> = {}
  ): Promise<{
    strategy: 'individual' | 'shared' | 'hybrid';
    bundles: NodeJSBundleOutput[];
    sharedDependencies: string[];
    totalSize: number;
    analysis: BundleAnalysis;
  }> {
    console.log(`[MULTI-AGENT-BUNDLER] Analyzing multi-agent configuration...`);
    
    // Extract all agents from the configuration
    const agentIds = await this.extractAgentIds(transpileResult.code);
    
    if (agentIds.length === 0) {
      throw new Error('No agents found in configuration');
    }

    if (agentIds.length === 1) {
      console.log(`[MULTI-AGENT-BUNDLER] Single agent detected, using standard bundling`);
      const bundle = await this.generateNodeJSBundle(transpileResult, agentIds[0], options);
      return {
        strategy: 'individual',
        bundles: [bundle],
        sharedDependencies: bundle.dependencies,
        totalSize: bundle.size,
        analysis: this.analyzeBundleStrategy([bundle])
      };
    }

    console.log(`[MULTI-AGENT-BUNDLER] Found ${agentIds.length} agents: ${agentIds.join(', ')}`);
    
    // Analyze dependency patterns across all agents
    const dependencyAnalysis = await this.analyzeDependencyPatterns(transpileResult.code, agentIds);
    
    // Choose optimal bundling strategy
    const strategy = this.chooseBundlingStrategy(dependencyAnalysis);
    console.log(`[MULTI-AGENT-BUNDLER] Selected strategy: ${strategy}`);
    
    let bundles: NodeJSBundleOutput[];
    
    switch (strategy) {
      case 'individual':
        bundles = await this.generateIndividualBundles(transpileResult, agentIds, options);
        break;
      case 'shared':
        bundles = await this.generateSharedBundle(transpileResult, agentIds, options);
        break;
      case 'hybrid':
        bundles = await this.generateHybridBundles(transpileResult, agentIds, dependencyAnalysis, options);
        break;
    }
    
    const totalSize = bundles.reduce((sum, bundle) => sum + bundle.size, 0);
    const sharedDependencies = this.extractSharedDependencies(bundles);
    
    console.log(`[MULTI-AGENT-BUNDLER] Strategy: ${strategy}, Bundles: ${bundles.length}, Total: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
    
    return {
      strategy,
      bundles,
      sharedDependencies,
      totalSize,
      analysis: this.analyzeBundleStrategy(bundles)
    };
  }

  /**
   * Analyze dependency patterns across agents to determine optimal bundling
   */
  private async analyzeDependencyPatterns(code: string, agentIds: string[]): Promise<DependencyAnalysis> {
    const agentDependencies = new Map<string, string[]>();
    
    // For each agent, determine its dependencies
    for (const agentId of agentIds) {
      // This is a simplified analysis - in reality, we'd need to extract
      // agent-specific code and analyze its imports
      const dependencies = this.extractPackageDependencies(code);
      agentDependencies.set(agentId, dependencies);
    }
    
    // Find common dependencies
    const allDependencies = Array.from(agentDependencies.values()).flat();
    const dependencyCount = new Map<string, number>();
    
    for (const dep of allDependencies) {
      dependencyCount.set(dep, (dependencyCount.get(dep) || 0) + 1);
    }
    
    const sharedDependencies = Array.from(dependencyCount.entries())
      .filter(([_, count]) => count > 1)
      .map(([dep]) => dep);
    
    const uniqueDependencies = Array.from(dependencyCount.entries())
      .filter(([_, count]) => count === 1)
      .map(([dep]) => dep);
    
    return {
      agentCount: agentIds.length,
      agentDependencies,
      sharedDependencies,
      uniqueDependencies,
      totalDependencies: dependencyCount.size,
      sharedRatio: sharedDependencies.length / dependencyCount.size
    };
  }

  /**
   * Choose optimal bundling strategy based on dependency analysis
   */
  private chooseBundlingStrategy(analysis: DependencyAnalysis): 'individual' | 'shared' | 'hybrid' {
    const { agentCount, sharedRatio, sharedDependencies, uniqueDependencies } = analysis;
    
    // Individual strategy: Each agent gets its own bundle
    // Best for: Diverse dependencies, few shared dependencies
    if (sharedRatio < 0.3 || agentCount <= 2) {
      return 'individual';
    }
    
    // Shared strategy: All agents in one bundle
    // Best for: Many shared dependencies, small agent count
    if (sharedRatio > 0.8 && agentCount <= 5) {
      return 'shared';
    }
    
    // Hybrid strategy: Shared base + individual extensions
    // Best for: Mixed dependency patterns, larger agent count
    return 'hybrid';
  }

  /**
   * Generate individual bundles for each agent (current approach)
   */
  private async generateIndividualBundles(
    transpileResult: TranspileResult,
    agentIds: string[],
    options: Partial<NodeJSBundlerOptions>
  ): Promise<NodeJSBundleOutput[]> {
    console.log(`[MULTI-AGENT-BUNDLER] Generating ${agentIds.length} individual bundles...`);
    
    const bundles: NodeJSBundleOutput[] = [];
    
    for (const agentId of agentIds) {
      try {
        const bundle = await this.generateNodeJSBundle(transpileResult, agentId, options);
        bundles.push(bundle);
        console.log(`[MULTI-AGENT-BUNDLER] ✅ ${agentId}: ${(bundle.size / 1024 / 1024).toFixed(2)}MB`);
      } catch (error) {
        console.error(`[MULTI-AGENT-BUNDLER] ❌ Failed to bundle ${agentId}:`, error);
      }
    }
    
    return bundles;
  }

  /**
   * Generate single shared bundle containing all agents
   */
  private async generateSharedBundle(
    transpileResult: TranspileResult,
    agentIds: string[],
    options: Partial<NodeJSBundlerOptions>
  ): Promise<NodeJSBundleOutput[]> {
    console.log(`[MULTI-AGENT-BUNDLER] Generating shared bundle for all agents...`);
    
    // Create a mega-bundle with all agents
    const sharedBundle = await this.generateSharedAgentsBundle(
      transpileResult,
      agentIds,
      options
    );
    
    console.log(`[MULTI-AGENT-BUNDLER] ✅ Shared bundle: ${(sharedBundle.size / 1024 / 1024).toFixed(2)}MB for ${agentIds.length} agents`);
    
    return [sharedBundle];
  }

  /**
   * Generate hybrid bundles with shared base and individual extensions
   */
  private async generateHybridBundles(
    transpileResult: TranspileResult,
    agentIds: string[],
    analysis: DependencyAnalysis,
    options: Partial<NodeJSBundlerOptions>
  ): Promise<NodeJSBundleOutput[]> {
    console.log(`[MULTI-AGENT-BUNDLER] Generating hybrid bundles (${analysis.sharedDependencies.length} shared deps)...`);
    
    // For now, fall back to individual bundles
    // TODO: Implement true hybrid bundling with shared base layer
    return this.generateIndividualBundles(transpileResult, agentIds, options);
  }

  /**
   * Generate a shared bundle containing all agents
   */
  private async generateSharedAgentsBundle(
    transpileResult: TranspileResult,
    agentIds: string[],
    options: Partial<NodeJSBundlerOptions>
  ): Promise<NodeJSBundleOutput> {
    const bundleId = `multi-agent-${agentIds.length}`;
    const dependencies = this.extractPackageDependencies(transpileResult.code);
    
    // Use the full transpiled code (contains all agents)
    const bundledCode = await this.createNodeJSBundleWithEsbuild(
      transpileResult.code,
      bundleId,
      {
        ...options,
        baseDir: this.baseDir,
        outputDir: this.outputDir,
        compilerVersion: this.compilerVersion,
        runtime: 'nodejs20.x',
        bundleAllDependencies: options.bundleAllDependencies ?? true,
        target: options.target ?? 'vercel',
        minify: options.minify ?? true
      }
    );

    const hash = generateHash(bundledCode);
    
    // Write shared bundle
    const bundlesDir = resolve(this.outputDir, 'nodejs-bundles');
    if (!existsSync(bundlesDir)) {
      mkdirSync(bundlesDir, { recursive: true });
    }

    const filename = `${bundleId}.nodejs.${hash}.js`;
    const filepath = resolve(bundlesDir, filename);
    writeFileSync(filepath, bundledCode, 'utf-8');

    const bundleSize = Buffer.byteLength(bundledCode, 'utf-8');

    return {
      id: bundleId,
      hash,
      filename,
      filepath,
      size: bundleSize,
      runtime: 'nodejs20.x',
      dependencies,
      bundleType: options.minify ? 'production' : 'development',
      executionMode: 'vercel-function',
      metadata: {
        id: bundleId,
        hash,
        name: `Multi-Agent Bundle (${agentIds.length} agents)`,
        description: `Shared bundle containing: ${agentIds.join(', ')}`,
        tools: [], // Would extract from all agents
        models: [], // Would extract from all agents
        compiledAt: new Date().toISOString(),
        compilerVersion: this.compilerVersion
      }
    };
  }

  /**
   * Extract shared dependencies across bundles
   */
  private extractSharedDependencies(bundles: NodeJSBundleOutput[]): string[] {
    if (bundles.length <= 1) return bundles[0]?.dependencies || [];
    
    const dependencyCounts = new Map<string, number>();
    
    for (const bundle of bundles) {
      for (const dep of bundle.dependencies) {
        dependencyCounts.set(dep, (dependencyCounts.get(dep) || 0) + 1);
      }
    }
    
    return Array.from(dependencyCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([dep]) => dep);
  }

  /**
   * Analyze bundle strategy effectiveness
   */
  private analyzeBundleStrategy(bundles: NodeJSBundleOutput[]): BundleAnalysis {
    const totalSize = bundles.reduce((sum, b) => sum + b.size, 0);
    const avgSize = totalSize / bundles.length;
    const maxSize = Math.max(...bundles.map(b => b.size));
    const minSize = Math.min(...bundles.map(b => b.size));
    
    const allDeps = bundles.flatMap(b => b.dependencies);
    const uniqueDeps = [...new Set(allDeps)];
    const duplicatedDeps = uniqueDeps.filter(dep => 
      allDeps.filter(d => d === dep).length > 1
    );
    
    return {
      bundleCount: bundles.length,
      totalSizeMB: +(totalSize / 1024 / 1024).toFixed(2),
      avgSizeMB: +(avgSize / 1024 / 1024).toFixed(2),
      maxSizeMB: +(maxSize / 1024 / 1024).toFixed(2),
      minSizeMB: +(minSize / 1024 / 1024).toFixed(2),
      uniqueDependencies: uniqueDeps.length,
      duplicatedDependencies: duplicatedDeps.length,
      duplicationRatio: duplicatedDeps.length / uniqueDeps.length,
      efficiency: this.calculateBundleEfficiency(bundles)
    };
  }

  /**
   * Calculate bundle efficiency score (0-1, higher is better)
   */
  private calculateBundleEfficiency(bundles: NodeJSBundleOutput[]): number {
    if (bundles.length === 1) return 1.0; // Single bundle is perfectly efficient
    
    const totalSize = bundles.reduce((sum, b) => sum + b.size, 0);
    const avgSize = totalSize / bundles.length;
    
    // Calculate size variance (lower is better)
    const variance = bundles.reduce((sum, b) => 
      sum + Math.pow(b.size - avgSize, 2), 0) / bundles.length;
    const sizeVariance = Math.sqrt(variance) / avgSize;
    
    // Calculate dependency duplication (lower is better)
    const allDeps = bundles.flatMap(b => b.dependencies);
    const uniqueDeps = [...new Set(allDeps)];
    const duplicationRatio = 1 - (uniqueDeps.length / allDeps.length);
    
    // Efficiency = 1 - (size_variance * 0.3 + duplication_ratio * 0.7)
    return Math.max(0, 1 - (sizeVariance * 0.3 + duplicationRatio * 0.7));
  }

  /**
   * Generate Node.js runtime bundle with full dependency bundling
   * This method creates production-ready bundles for Vercel Node.js Functions
   */
  async generateNodeJSBundle(
    transpileResult: TranspileResult,
    agentId: string,
    options: Partial<NodeJSBundlerOptions> = {}
  ): Promise<NodeJSBundleOutput> {
    if (transpileResult.errors.length > 0) {
      throw new Error(`Cannot bundle due to transpilation errors: ${transpileResult.errors.join(', ')}`);
    }

    const nodeJSOptions: NodeJSBundlerOptions = {
      ...options,
      baseDir: this.baseDir,
      outputDir: this.outputDir,
      compilerVersion: this.compilerVersion,
      runtime: 'nodejs20.x',
      bundleAllDependencies: options.bundleAllDependencies ?? true,
      target: options.target ?? 'vercel',
      minify: options.minify ?? true
    };

    console.log(`[BUNDLER] Generating Node.js runtime bundle for: ${agentId}`);
    console.log(`[BUNDLER] Bundle all dependencies: ${nodeJSOptions.bundleAllDependencies}`);
    console.log(`[BUNDLER] Target platform: ${nodeJSOptions.target}`);

    // Extract dependencies from the transpiled code
    const dependencies = this.extractPackageDependencies(transpileResult.code);
    console.log(`[BUNDLER] Found ${dependencies.length} dependencies:`, dependencies);

    // Generate full Node.js bundle using esbuild
    const bundledCode = await this.createNodeJSBundleWithEsbuild(
      transpileResult.code,
      agentId,
      nodeJSOptions
    );

    // Generate hash from bundled code
    const hash = generateHash(bundledCode);

    // Create metadata
    const metadata = extractAgentMetadata(transpileResult.code, agentId);
    
    // Write bundle file
    const bundlesDir = resolve(this.outputDir, 'nodejs-bundles');
    if (!existsSync(bundlesDir)) {
      mkdirSync(bundlesDir, { recursive: true });
    }

    const filename = `${agentId}.nodejs.${hash}.js`;
    const filepath = resolve(bundlesDir, filename);
    writeFileSync(filepath, bundledCode, 'utf-8');

    const bundleSize = Buffer.byteLength(bundledCode, 'utf-8');
    const sizeMB = (bundleSize / 1024 / 1024).toFixed(2);
    console.log(`[BUNDLER] Node.js bundle created: ${filename} (${sizeMB}MB)`);

    return {
      id: agentId,
      hash,
      filename,
      filepath,
      size: bundleSize,
      runtime: 'nodejs20.x',
      dependencies,
      bundleType: nodeJSOptions.minify ? 'production' : 'development',
      executionMode: 'vercel-function',
      metadata: {
        id: agentId,
        hash,
        name: metadata.name,
        description: metadata.description,
        tools: metadata.tools ?? [],
        models: metadata.models ?? [],
        compiledAt: new Date().toISOString(),
        compilerVersion: this.compilerVersion
      }
    };
  }

  /**
   * Create Node.js bundle using esbuild with full dependency bundling
   */
  private async createNodeJSBundleWithEsbuild(
    code: string,
    agentId: string,
    options: NodeJSBundlerOptions
  ): Promise<string> {
    const esbuild = await import('esbuild');
    
    try {
      console.log(`[BUNDLER] Running esbuild for Node.js runtime...`);
      
      const result = await esbuild.build({
        stdin: {
          contents: code,
          resolveDir: this.baseDir,
          sourcefile: 'agent.js'
        },
        bundle: options.bundleAllDependencies,
        minify: options.minify,
        format: 'cjs', // CommonJS for Node.js runtime
        platform: 'node',
        target: 'node20',
        external: options.bundleAllDependencies ? [
          // Only exclude Node.js built-ins
          'node:*',
          'fs', 'path', 'os', 'crypto', 'http', 'https', 'url', 'util',
          'stream', 'events', 'buffer', 'process', 'child_process'
        ] : undefined,
        treeShaking: true,
        write: false,
        metafile: true,
        logLevel: 'warning'
      });

      if (result.errors.length > 0) {
        throw new Error(`esbuild errors: ${result.errors.map(e => e.text).join(', ')}`);
      }

      const bundledCode = result.outputFiles[0].text;
      
      // Log bundle analysis
      if (result.metafile) {
        const analysis = await esbuild.analyzeMetafile(result.metafile);
        console.log(`[BUNDLER] Bundle analysis:\n${analysis}`);
      }

      // Wrap in Vercel Node.js function format
      return this.wrapInNodeJSRuntimeFormat(bundledCode, agentId, options);

    } catch (error) {
      console.error(`[BUNDLER] esbuild failed:`, error);
      throw error;
    }
  }

  /**
   * Wrap bundled code in Node.js runtime format for Vercel Functions
   */
  private wrapInNodeJSRuntimeFormat(
    bundledCode: string,
    agentId: string,
    options: NodeJSBundlerOptions
  ): string {
    return `// Lightfast Agent Bundle - Node.js Runtime
// Agent: ${agentId}
// Generated: ${new Date().toISOString()}
// Runtime: ${options.runtime}
// Target: ${options.target}

${bundledCode}

// Vercel Node.js Function Handler
async function handler(request, response) {
  try {
    const body = request.body || '{}';
    const { input, context = {} } = typeof body === 'string' ? JSON.parse(body) : body;
    
    console.log(\`[AGENT-\${Date.now()}] Executing agent: ${agentId}\`);
    
    // Get the exported config (should be available from bundled code)
    const config = module.exports.default || module.exports;
    
    // Find the target agent
    const agent = config.agents?.["${agentId}"];
    if (!agent) {
      throw new Error(\`Agent '${agentId}' not found in configuration\`);
    }
    
    // Execute agent with Node.js runtime context
    const result = await agent.execute ? 
      agent.execute(input, {
        ...context,
        runtime: 'nodejs',
        platform: '${options.target}',
        // Node.js APIs available
        require,
        process,
        Buffer,
        console
      }) :
      agent(input, context);
    
    console.log(\`[AGENT-\${Date.now()}] Execution completed successfully\`);
    
    response.status(200).json(result);
    
  } catch (error) {
    console.error(\`[AGENT-\${Date.now()}] Execution error:\`, error);
    response.status(500).json({ 
      error: 'Agent execution failed',
      message: error.message,
      agentId: '${agentId}'
    });
  }
}

// Export for Vercel
module.exports = handler;
module.exports.handler = handler;

// Next.js API route compatibility
module.exports.POST = handler;
module.exports.GET = handler;
`;
  }

  /**
   * Extract package dependencies from transpiled code
   */
  private extractPackageDependencies(code: string): string[] {
    const dependencies: string[] = [];
    
    // Extract from import statements
    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(code)) !== null) {
      const packageName = match[1];
      
      // Skip relative imports and Node.js built-ins
      if (!packageName.startsWith('.') && !packageName.startsWith('node:')) {
        // Extract package name (handle scoped packages)
        const cleanPackageName = packageName.startsWith('@') 
          ? packageName.split('/').slice(0, 2).join('/')
          : packageName.split('/')[0];
        
        if (!dependencies.includes(cleanPackageName)) {
          dependencies.push(cleanPackageName);
        }
      }
    }
    
    // Also check for require statements
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(code)) !== null) {
      const packageName = match[1];
      
      if (!packageName.startsWith('.') && !packageName.startsWith('node:')) {
        const cleanPackageName = packageName.startsWith('@') 
          ? packageName.split('/').slice(0, 2).join('/')
          : packageName.split('/')[0];
        
        if (!dependencies.includes(cleanPackageName)) {
          dependencies.push(cleanPackageName);
        }
      }
    }
    
    return dependencies;
  }
}

/**
 * Creates a bundle generator instance
 */
export function createBundleGenerator(options: BundlerOptions): BundleGenerator {
  return new BundleGenerator(options);
}

/**
 * Creates a Node.js bundle generator instance with Node.js runtime options
 */
export function createNodeJSBundleGenerator(options: NodeJSBundlerOptions): BundleGenerator {
  return new BundleGenerator(options);
}