import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

// Specify Node.js runtime for full dependency support
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for complex agents

/**
 * Agent execution request schema
 */
const ExecutionRequestSchema = z.object({
  agentId: z.string().min(1, "Agent ID is required"),
  input: z.any(), // Agent input can be any type
  context: z.record(z.any()).optional().default({}),
  bundleHash: z.string().optional(), // Optional: specify bundle version
});

/**
 * Agent execution response schema
 */
const ExecutionResponseSchema = z.object({
  success: z.boolean(),
  result: z.any().optional(),
  error: z.string().optional(),
  executionTime: z.number(),
  agentId: z.string(),
  bundleHash: z.string().optional(),
  runtime: z.literal("nodejs"),
});

/**
 * Cache for loaded agent bundles to avoid re-loading on every request
 * In production, this could be enhanced with LRU cache or Redis
 */
const agentBundleCache = new Map<string, {
  module: any;
  hash: string;
  loadedAt: number;
  size: number;
}>();

/**
 * Maximum cache size (in terms of number of agents)
 * Prevents memory leaks from loading too many agents
 */
const MAX_CACHE_SIZE = 100;

/**
 * Cache TTL in milliseconds (1 hour)
 * After this time, bundles will be reloaded to get updates
 */
const CACHE_TTL = 60 * 60 * 1000;

/**
 * POST /api/agents/execute
 * 
 * Executes a Lightfast agent that was compiled with Node.js runtime bundling.
 * Supports complex npm dependencies like ExaJS, Stripe, etc.
 * 
 * This endpoint:
 * 1. Validates the execution request
 * 2. Loads the agent bundle from storage (with caching)
 * 3. Executes the agent in Node.js runtime with full API access
 * 4. Returns the execution result
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse and validate request body
    const body = await request.json();
    const executionRequest = ExecutionRequestSchema.parse(body);
    
    console.log(`[AGENT-EXEC] Starting execution for agent: ${executionRequest.agentId}`);
    console.log(`[AGENT-EXEC] Input type: ${typeof executionRequest.input}`);
    
    // Load agent bundle (with caching)
    const agentBundle = await loadAgentBundle(
      executionRequest.agentId, 
      executionRequest.bundleHash
    );
    
    if (!agentBundle) {
      return NextResponse.json({
        success: false,
        error: `Agent '${executionRequest.agentId}' not found`,
        executionTime: Date.now() - startTime,
        agentId: executionRequest.agentId,
        runtime: "nodejs"
      } satisfies z.infer<typeof ExecutionResponseSchema>, { status: 404 });
    }
    
    // Execute the agent bundle
    // The bundle is a self-contained Node.js module with all dependencies
    const result = await executeAgentBundle(
      agentBundle.module,
      executionRequest.input,
      {
        ...executionRequest.context,
        agentId: executionRequest.agentId,
        requestId: crypto.randomUUID(),
        runtime: "nodejs",
        platform: "vercel",
        startTime,
        // Node.js APIs are available to the agent
        nodeAPIs: {
          require,
          process,
          Buffer,
          global,
        }
      }
    );
    
    const executionTime = Date.now() - startTime;
    console.log(`[AGENT-EXEC] Completed in ${executionTime}ms for agent: ${executionRequest.agentId}`);
    
    return NextResponse.json({
      success: true,
      result,
      executionTime,
      agentId: executionRequest.agentId,
      bundleHash: agentBundle.hash,
      runtime: "nodejs"
    } satisfies z.infer<typeof ExecutionResponseSchema>);
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`[AGENT-EXEC] Execution failed:`, error);
    
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: `Validation error: ${error.errors.map(e => e.message).join(', ')}`,
        executionTime,
        agentId: "unknown",
        runtime: "nodejs"
      } satisfies z.infer<typeof ExecutionResponseSchema>, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      executionTime,
      agentId: "unknown",
      runtime: "nodejs"
    } satisfies z.infer<typeof ExecutionResponseSchema>, { status: 500 });
  }
}

/**
 * Load agent bundle with caching and cache management
 */
async function loadAgentBundle(agentId: string, requestedHash?: string): Promise<{
  module: any;
  hash: string;
  size: number;
} | null> {
  const cacheKey = `${agentId}${requestedHash ? `@${requestedHash}` : ''}`;
  const now = Date.now();
  
  // Check cache first
  const cached = agentBundleCache.get(cacheKey);
  if (cached && (now - cached.loadedAt) < CACHE_TTL) {
    console.log(`[AGENT-EXEC] Cache hit for: ${cacheKey}`);
    return cached;
  }
  
  try {
    // In a real implementation, this would load from Vercel Blob Storage
    // For now, we'll simulate loading from the compiled bundles directory
    const bundlePath = getBundlePath(agentId, requestedHash);
    
    if (!bundlePath) {
      console.warn(`[AGENT-EXEC] Bundle not found for: ${agentId}`);
      return null;
    }
    
    // Load the Node.js bundle
    // This is safe because we control the bundle generation
    console.log(`[AGENT-EXEC] Loading bundle from: ${bundlePath}`);
    
    // Clear require cache to ensure fresh load
    delete require.cache[require.resolve(bundlePath)];
    
    const bundleModule = require(bundlePath);
    const bundleSize = await getBundleSize(bundlePath);
    
    // Extract hash from filename or generate one
    const hash = requestedHash || extractHashFromPath(bundlePath) || generateHash(agentId);
    
    const bundleInfo = {
      module: bundleModule,
      hash,
      loadedAt: now,
      size: bundleSize
    };
    
    // Cache management: remove oldest if cache is full
    if (agentBundleCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = Array.from(agentBundleCache.keys())[0];
      agentBundleCache.delete(oldestKey);
      console.log(`[AGENT-EXEC] Evicted oldest bundle from cache: ${oldestKey}`);
    }
    
    agentBundleCache.set(cacheKey, bundleInfo);
    console.log(`[AGENT-EXEC] Loaded and cached bundle: ${cacheKey} (${(bundleSize / 1024 / 1024).toFixed(2)}MB)`);
    
    return bundleInfo;
    
  } catch (error) {
    console.error(`[AGENT-EXEC] Failed to load bundle for ${agentId}:`, error);
    return null;
  }
}

/**
 * Execute the loaded agent bundle
 */
async function executeAgentBundle(
  bundleModule: any, 
  input: any, 
  context: Record<string, any>
): Promise<any> {
  // The bundle should export a handler function that we can call
  if (typeof bundleModule === 'function') {
    // Direct function export
    return await bundleModule(input, context);
  }
  
  if (bundleModule.handler && typeof bundleModule.handler === 'function') {
    // Handler function export
    return await bundleModule.handler(input, context);
  }
  
  if (bundleModule.default && typeof bundleModule.default === 'function') {
    // Default export function
    return await bundleModule.default(input, context);
  }
  
  // If it's a Vercel-style handler, simulate the request/response pattern
  if (bundleModule.POST && typeof bundleModule.POST === 'function') {
    const mockRequest = {
      body: JSON.stringify({ input, context }),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    };
    
    const mockResponse = {
      status: (code: number) => mockResponse,
      json: (data: any) => ({ statusCode: 200, data })
    };
    
    const result = await bundleModule.POST(mockRequest, mockResponse);
    return result?.data || result;
  }
  
  throw new Error('Bundle does not export a callable execution function');
}

/**
 * Get bundle path - in production this would query Vercel Blob Storage
 */
function getBundlePath(agentId: string, hash?: string): string | null {
  const fs = require('fs');
  const path = require('path');
  
  // Look in the compiled bundles directory
  const bundlesDir = path.join(process.cwd(), '.lightfast', 'dist', 'nodejs-bundles');
  
  if (!fs.existsSync(bundlesDir)) {
    console.warn(`[AGENT-EXEC] Bundles directory not found: ${bundlesDir}`);
    return null;
  }
  
  try {
    const files = fs.readdirSync(bundlesDir);
    
    // Find bundle file for the agent
    let bundleFile: string | undefined;
    
    if (hash) {
      // Look for specific hash
      bundleFile = files.find((f: string) => 
        f.startsWith(`${agentId}.nodejs.${hash}`) && f.endsWith('.js')
      );
    } else {
      // Look for any bundle for this agent (latest)
      const agentFiles = files.filter((f: string) => 
        f.startsWith(`${agentId}.nodejs.`) && f.endsWith('.js')
      );
      // Sort by modified time and take the newest
      bundleFile = agentFiles.sort().pop();
    }
    
    if (!bundleFile) {
      console.warn(`[AGENT-EXEC] No bundle found for agent: ${agentId}`);
      return null;
    }
    
    return path.join(bundlesDir, bundleFile);
    
  } catch (error) {
    console.error(`[AGENT-EXEC] Error scanning bundles directory:`, error);
    return null;
  }
}

/**
 * Get bundle file size
 */
async function getBundleSize(bundlePath: string): Promise<number> {
  const fs = require('fs');
  const stats = fs.statSync(bundlePath);
  return stats.size;
}

/**
 * Extract hash from bundle file path
 */
function extractHashFromPath(bundlePath: string): string | null {
  const path = require('path');
  const filename = path.basename(bundlePath);
  const match = filename.match(/\.nodejs\.([a-f0-9]{8})\./);
  return match ? match[1] : null;
}

/**
 * Generate simple hash for fallback
 */
function generateHash(input: string): string {
  return Buffer.from(input).toString('base64').substring(0, 8);
}

/**
 * GET /api/agents/execute
 * 
 * Returns information about available agents and execution statistics
 */
export async function GET() {
  const cacheStats = Array.from(agentBundleCache.entries()).map(([key, value]) => ({
    agentKey: key,
    hash: value.hash,
    sizeMB: (value.size / 1024 / 1024).toFixed(2),
    loadedAt: new Date(value.loadedAt).toISOString(),
    cacheAge: Date.now() - value.loadedAt
  }));
  
  return NextResponse.json({
    runtime: "nodejs",
    platform: "vercel",
    cacheStats,
    cacheSize: agentBundleCache.size,
    maxCacheSize: MAX_CACHE_SIZE,
    cacheTTL: CACHE_TTL
  });
}