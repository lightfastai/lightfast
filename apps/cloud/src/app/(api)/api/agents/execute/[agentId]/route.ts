import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

// Specify Node.js runtime for complex dependency support (ExaJS, etc.)
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for complex agents

/**
 * Simplified execution request schema for agent-specific endpoints
 */
const AgentExecutionRequestSchema = z.object({
  input: z.any(), // Agent input can be any type
  context: z.record(z.any()).optional().default({}),
  bundleHash: z.string().optional(), // Optional: specify bundle version
});

/**
 * Cache for loaded agent bundles (shared across all agent routes)
 * This avoids re-loading the same agent multiple times
 */
const agentModuleCache = new Map<string, {
  module: any;
  hash: string;
  loadedAt: number;
  size: number;
}>();

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_SIZE = 50;

/**
 * POST /api/agents/execute/[agentId]
 * 
 * Executes a specific Lightfast agent by ID.
 * This is the main endpoint that supports complex npm dependencies.
 * 
 * Example usage:
 * POST /api/agents/execute/searchBot
 * {
 *   "input": { "query": "AI research papers" },
 *   "context": { "userId": "123" }
 * }
 * 
 * The agent bundle should be a Node.js module that exports either:
 * - A direct function: module.exports = async (input, context) => result
 * - A handler: module.exports.handler = async (input, context) => result  
 * - A Vercel function: module.exports.POST = async (req, res) => void
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const startTime = Date.now();
  const { agentId } = params;
  
  try {
    console.log(`[AGENT-${agentId}] Starting execution...`);
    
    // Parse and validate request body
    const body = await request.json();
    const { input, context, bundleHash } = AgentExecutionRequestSchema.parse(body);
    
    console.log(`[AGENT-${agentId}] Input received, type: ${typeof input}`);
    
    // Load the agent bundle (Node.js module with all dependencies)
    const agentBundle = await loadNodeJSAgentBundle(agentId, bundleHash);
    
    if (!agentBundle) {
      console.warn(`[AGENT-${agentId}] Bundle not found`);
      return NextResponse.json({
        success: false,
        error: `Agent '${agentId}' not found. Make sure it has been compiled and deployed.`,
        agentId,
        executionTime: Date.now() - startTime,
        runtime: "nodejs"
      }, { status: 404 });
    }
    
    // Execute the agent with full Node.js runtime support
    const result = await executeNodeJSAgent(
      agentBundle.module,
      agentId,
      input,
      {
        ...context,
        // Inject Node.js runtime context
        agentId,
        requestId: crypto.randomUUID(),
        runtime: "nodejs",
        platform: "vercel", 
        timestamp: new Date().toISOString(),
        // Full Node.js APIs available for complex packages
        nodeEnvironment: {
          require,
          process: {
            env: process.env,
            cwd: process.cwd,
            version: process.version,
            platform: process.platform
          },
          Buffer,
          console,
          global
        }
      }
    );
    
    const executionTime = Date.now() - startTime;
    console.log(`[AGENT-${agentId}] Completed successfully in ${executionTime}ms`);
    
    return NextResponse.json({
      success: true,
      result,
      agentId,
      bundleHash: agentBundle.hash,
      executionTime,
      runtime: "nodejs",
      bundleSize: agentBundle.size
    });
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';
    
    console.error(`[AGENT-${agentId}] Execution failed after ${executionTime}ms:`, error);
    
    // Handle different types of errors
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: `Invalid request: ${error.errors.map(e => e.message).join(', ')}`,
        agentId,
        executionTime,
        runtime: "nodejs"
      }, { status: 400 });
    }
    
    if (errorMessage.includes('MODULE_NOT_FOUND')) {
      return NextResponse.json({
        success: false,
        error: `Agent bundle dependency error. This may indicate a missing npm package in the bundle.`,
        agentId,
        executionTime,
        runtime: "nodejs",
        details: errorMessage
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      agentId,
      executionTime,
      runtime: "nodejs"
    }, { status: 500 });
  }
}

/**
 * Load Node.js agent bundle with smart caching
 * This handles bundles that include complex dependencies like ExaJS
 */
async function loadNodeJSAgentBundle(agentId: string, requestedHash?: string): Promise<{
  module: any;
  hash: string;
  size: number;
} | null> {
  const cacheKey = `${agentId}${requestedHash ? `@${requestedHash}` : ''}`;
  const now = Date.now();
  
  // Check if we have a fresh cached version
  const cached = agentModuleCache.get(cacheKey);
  if (cached && (now - cached.loadedAt) < CACHE_TTL) {
    console.log(`[AGENT-${agentId}] Using cached bundle (age: ${now - cached.loadedAt}ms)`);
    return cached;
  }
  
  try {
    // Find the bundle file path
    const bundlePath = await findNodeJSBundlePath(agentId, requestedHash);
    
    if (!bundlePath) {
      console.warn(`[AGENT-${agentId}] No bundle found. Run 'lightfast compile --nodejs' to create it.`);
      return null;
    }
    
    console.log(`[AGENT-${agentId}] Loading Node.js bundle: ${bundlePath}`);
    
    // Clear Node.js require cache to ensure fresh load
    const resolvedPath = require.resolve(bundlePath);
    delete require.cache[resolvedPath];
    
    // Load the bundle (this includes all npm dependencies via esbuild)
    const bundleModule = require(bundlePath);
    const bundleStats = await getBundleFileStats(bundlePath);
    
    const bundleInfo = {
      module: bundleModule,
      hash: requestedHash || bundleStats.hash || generateSimpleHash(agentId),
      loadedAt: now,
      size: bundleStats.size
    };
    
    // Cache management
    if (agentModuleCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = Array.from(agentModuleCache.keys())[0];
      agentModuleCache.delete(oldestKey);
      console.log(`[AGENT-${agentId}] Evicted old bundle from cache: ${oldestKey}`);
    }
    
    agentModuleCache.set(cacheKey, bundleInfo);
    console.log(`[AGENT-${agentId}] Bundle loaded and cached (${(bundleStats.size / 1024 / 1024).toFixed(2)}MB)`);
    
    return bundleInfo;
    
  } catch (error) {
    console.error(`[AGENT-${agentId}] Failed to load bundle:`, error);
    return null;
  }
}

/**
 * Execute Node.js agent with proper error handling
 * Supports different bundle export patterns
 */
async function executeNodeJSAgent(
  bundleModule: any,
  agentId: string,
  input: any,
  context: Record<string, any>
): Promise<any> {
  console.log(`[AGENT-${agentId}] Executing with context keys: ${Object.keys(context).join(', ')}`);
  
  // Pattern 1: Direct function export
  if (typeof bundleModule === 'function') {
    console.log(`[AGENT-${agentId}] Executing as direct function`);
    return await bundleModule(input, context);
  }
  
  // Pattern 2: Handler function
  if (bundleModule.handler && typeof bundleModule.handler === 'function') {
    console.log(`[AGENT-${agentId}] Executing via handler function`);
    return await bundleModule.handler(input, context);
  }
  
  // Pattern 3: Default export
  if (bundleModule.default && typeof bundleModule.default === 'function') {
    console.log(`[AGENT-${agentId}] Executing via default export`);
    return await bundleModule.default(input, context);
  }
  
  // Pattern 4: Vercel-style POST handler (from our bundler output)
  if (bundleModule.POST && typeof bundleModule.POST === 'function') {
    console.log(`[AGENT-${agentId}] Executing via Vercel POST handler`);
    
    // Create mock request/response for Vercel function format
    const mockRequest = {
      body: JSON.stringify({ input, context }),
      headers: new Headers({ 'content-type': 'application/json' }),
      method: 'POST',
      json: async () => ({ input, context })
    };
    
    let responseData: any = null;
    const mockResponse = {
      status: (code: number) => mockResponse,
      json: (data: any) => {
        responseData = data;
        return { status: 200, data };
      }
    };
    
    const result = await bundleModule.POST(mockRequest, mockResponse);
    
    // Return the captured response data or the direct result
    return responseData || result;
  }
  
  // Pattern 5: Lightfast agent configuration (execute method)
  if (bundleModule.default && 
      bundleModule.default.agents && 
      typeof bundleModule.default.agents === 'object') {
    
    console.log(`[AGENT-${agentId}] Executing via Lightfast agent config`);
    
    const agent = bundleModule.default.agents[agentId];
    if (!agent) {
      throw new Error(`Agent '${agentId}' not found in bundle configuration`);
    }
    
    if (typeof agent.execute === 'function') {
      return await agent.execute(input, context);
    }
    
    if (typeof agent === 'function') {
      return await agent(input, context);
    }
  }
  
  // If none of the patterns match, provide helpful error
  const availableExports = Object.keys(bundleModule).join(', ');
  throw new Error(
    `Bundle for agent '${agentId}' does not export a callable function. ` +
    `Available exports: ${availableExports}. ` +
    `Expected: function, handler, default, POST, or agents.${agentId}.execute`
  );
}

/**
 * Find the Node.js bundle path on filesystem
 * In production, this would query Vercel Blob Storage
 */
async function findNodeJSBundlePath(agentId: string, hash?: string): Promise<string | null> {
  const fs = require('fs').promises;
  const path = require('path');
  
  // Look in the Node.js bundles directory created by our bundler
  const nodeJSBundlesDir = path.join(process.cwd(), '.lightfast', 'dist', 'nodejs-bundles');
  
  try {
    await fs.access(nodeJSBundlesDir);
  } catch {
    console.warn(`[AGENT-${agentId}] Node.js bundles directory not found: ${nodeJSBundlesDir}`);
    return null;
  }
  
  try {
    const files = await fs.readdir(nodeJSBundlesDir);
    
    // Find the right bundle file
    let targetFile: string | undefined;
    
    if (hash) {
      // Look for specific hash
      targetFile = files.find((f: string) => 
        f.startsWith(`${agentId}.nodejs.${hash}`) && f.endsWith('.js')
      );
    } else {
      // Find any bundle for this agent (prefer newest)
      const agentBundles = files
        .filter((f: string) => f.startsWith(`${agentId}.nodejs.`) && f.endsWith('.js'))
        .sort(); // Sort alphabetically (should put newer hashes last)
      
      targetFile = agentBundles.pop(); // Get the last (newest) one
    }
    
    if (!targetFile) {
      console.warn(`[AGENT-${agentId}] No Node.js bundle found (hash: ${hash || 'any'})`);
      return null;
    }
    
    const bundlePath = path.join(nodeJSBundlesDir, targetFile);
    console.log(`[AGENT-${agentId}] Found bundle: ${targetFile}`);
    return bundlePath;
    
  } catch (error) {
    console.error(`[AGENT-${agentId}] Error finding bundle:`, error);
    return null;
  }
}

/**
 * Get bundle file statistics
 */
async function getBundleFileStats(bundlePath: string): Promise<{
  size: number;
  hash: string | null;
}> {
  const fs = require('fs').promises;
  const path = require('path');
  
  const stats = await fs.stat(bundlePath);
  const filename = path.basename(bundlePath);
  
  // Extract hash from filename pattern: agentId.nodejs.hash.js
  const hashMatch = filename.match(/\.nodejs\.([a-f0-9]+)\./);
  const hash = hashMatch ? hashMatch[1] : null;
  
  return {
    size: stats.size,
    hash
  };
}

/**
 * Generate simple hash fallback
 */
function generateSimpleHash(input: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 8);
}

/**
 * GET /api/agents/execute/[agentId]
 * 
 * Get information about a specific agent and its bundle
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const { agentId } = params;
  
  try {
    // Check if bundle exists
    const bundlePath = await findNodeJSBundlePath(agentId);
    
    if (!bundlePath) {
      return NextResponse.json({
        agentId,
        available: false,
        error: "Agent bundle not found",
        suggestion: "Run 'lightfast compile --nodejs' to create Node.js bundles"
      }, { status: 404 });
    }
    
    const bundleStats = await getBundleFileStats(bundlePath);
    const cached = agentModuleCache.get(agentId);
    
    return NextResponse.json({
      agentId,
      available: true,
      bundle: {
        path: bundlePath,
        size: bundleStats.size,
        sizeMB: (bundleStats.size / 1024 / 1024).toFixed(2),
        hash: bundleStats.hash
      },
      cache: cached ? {
        loaded: true,
        loadedAt: new Date(cached.loadedAt).toISOString(),
        cacheAge: Date.now() - cached.loadedAt
      } : {
        loaded: false
      },
      runtime: "nodejs"
    });
    
  } catch (error) {
    return NextResponse.json({
      agentId,
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      runtime: "nodejs"
    }, { status: 500 });
  }
}