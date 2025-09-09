import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

// Specify Node.js runtime for complex dependency support
export const runtime = "nodejs";
export const maxDuration = 600; // 10 minutes for multi-agent deployment

/**
 * Agent deployment request schema (simplified - no strategies)
 */
const AgentDeploymentSchema = z.object({
  agents: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    bundleData: z.string(), // Base64 encoded bundle
    dependencies: z.array(z.string()),
    hash: z.string()
  })),
  config: z.object({
    runtime: z.literal('nodejs20.x'),
    target: z.enum(['vercel', 'aws-lambda', 'local']),
    minify: z.boolean().default(true)
  })
});

/**
 * POST /api/agents/deploy
 * 
 * Deploy multiple agents - each gets its own bundle and Vercel function.
 * Simple approach: one agent = one bundle = one function.
 * 
 * Example request:
 * POST /api/agents/deploy
 * {
 *   "agents": [
 *     {
 *       "id": "customerSupport",
 *       "name": "Customer Support Agent",
 *       "bundleData": "base64-encoded-bundle-data",
 *       "dependencies": ["lightfast", "@ai-sdk/gateway", "zod"],
 *       "hash": "abc123"
 *     },
 *     {
 *       "id": "codeReviewer", 
 *       "name": "Code Review Agent",
 *       "bundleData": "base64-encoded-bundle-data",
 *       "dependencies": ["lightfast", "@ai-sdk/gateway", "zod"],
 *       "hash": "def456"
 *     }
 *   ],
 *   "config": {
 *     "runtime": "nodejs20.x",
 *     "target": "vercel",
 *     "minify": true
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log(`[AGENT-DEPLOY] Starting agent deployment...`);
    
    // Parse and validate request
    const body = await request.json();
    const deployment = AgentDeploymentSchema.parse(body);
    
    console.log(`[AGENT-DEPLOY] Deploying ${deployment.agents.length} agents (one bundle each)`);
    
    // Process each agent bundle
    const deploymentResults = [];
    let totalSize = 0;
    
    for (const agent of deployment.agents) {
      try {
        console.log(`[MULTI-AGENT-DEPLOY] Processing agent: ${agent.id}`);
        
        // Decode bundle data
        const bundleBuffer = Buffer.from(agent.bundleData, 'base64');
        const bundleSize = bundleBuffer.length;
        totalSize += bundleSize;
        
        // Store bundle (in production, this would be Vercel Blob Storage)
        const bundlePath = await storeBundleToCloud(agent.id, agent.hash, bundleBuffer);
        
        // Register agent in deployment registry
        await registerAgentDeployment({
          id: agent.id,
          name: agent.name,
          description: agent.description,
          bundlePath,
          dependencies: agent.dependencies,
          hash: agent.hash,
          runtime: deployment.config.runtime,
          size: bundleSize,
          deployedAt: new Date().toISOString()
        });
        
        deploymentResults.push({
          agentId: agent.id,
          status: 'success',
          bundlePath,
          size: bundleSize,
          hash: agent.hash
        });
        
        console.log(`[MULTI-AGENT-DEPLOY] ✅ ${agent.id} deployed (${(bundleSize / 1024 / 1024).toFixed(2)}MB)`);
        
      } catch (error) {
        console.error(`[MULTI-AGENT-DEPLOY] ❌ Failed to deploy ${agent.id}:`, error);
        deploymentResults.push({
          agentId: agent.id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Create deployment summary
    const successCount = deploymentResults.filter(r => r.status === 'success').length;
    const failureCount = deploymentResults.filter(r => r.status === 'error').length;
    
    const deploymentTime = Date.now() - startTime;
    
    console.log(`[MULTI-AGENT-DEPLOY] Completed: ${successCount} success, ${failureCount} failures in ${deploymentTime}ms`);
    
    // Generate deployment endpoints
    const endpoints = deployment.agents
      .filter(agent => deploymentResults.find(r => r.agentId === agent.id)?.status === 'success')
      .map(agent => ({
        agentId: agent.id,
        name: agent.name,
        endpoint: `/api/agents/execute/${agent.id}`,
        testCommand: `curl -X POST ${request.headers.get('host')}/api/agents/execute/${agent.id} -H "Content-Type: application/json" -d '{"input": {"message": "Hello"}}'`
      }));
    
    return NextResponse.json({
      success: successCount > 0,
      deployment: {
        runtime: deployment.config.runtime,
        target: deployment.config.target,
        agentCount: deployment.agents.length,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        deploymentTime,
        results: {
          success: successCount,
          failures: failureCount,
          details: deploymentResults
        }
      },
      endpoints,
      nextSteps: [
        "Test individual agents using the provided endpoints",
        "Monitor agent performance and cold start times", 
        "Scale deployment based on usage patterns"
      ]
    });
    
  } catch (error) {
    const deploymentTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown deployment error';
    
    console.error(`[MULTI-AGENT-DEPLOY] Deployment failed after ${deploymentTime}ms:`, error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid deployment request',
        details: error.errors.map(e => e.message).join(', '),
        deploymentTime
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      deploymentTime
    }, { status: 500 });
  }
}

/**
 * Store bundle to cloud storage (Vercel Blob in production)
 */
async function storeBundleToCloud(agentId: string, hash: string, bundleBuffer: Buffer): Promise<string> {
  // In production, this would use Vercel Blob Storage:
  // import { put } from '@vercel/blob';
  // const { url } = await put(`agents/${agentId}/${hash}.js`, bundleBuffer, { 
  //   access: 'public',
  //   contentType: 'application/javascript'
  // });
  // return url;
  
  // For now, simulate storage path
  return `/bundles/${agentId}.${hash}.js`;
}

/**
 * Register agent deployment in registry
 */
async function registerAgentDeployment(deployment: {
  id: string;
  name: string;
  description?: string;
  bundlePath: string;
  dependencies: string[];
  hash: string;
  runtime: string;
  size: number;
  deployedAt: string;
}): Promise<void> {
  // In production, this would use Vercel KV or database:
  // import { kv } from '@vercel/kv';
  // await kv.hset(`agents:${deployment.id}`, deployment);
  
  console.log(`[REGISTRY] Registered agent ${deployment.id}`);
}

/**
 * GET /api/agents/deploy/multi
 * 
 * Get multi-agent deployment status and statistics
 */
export async function GET() {
  try {
    // In production, this would query the actual registry
    const mockDeployments = [
      {
        id: "customerSupport",
        name: "Customer Support Agent",
        status: "active",
        runtime: "nodejs20.x",
        sizeMB: 0.65,
        deployedAt: "2024-01-29T10:00:00Z"
      },
      {
        id: "codeReviewer", 
        name: "Code Review Agent",
        status: "active",
        runtime: "nodejs20.x",
        sizeMB: 0.65,
        deployedAt: "2024-01-29T10:00:05Z"
      }
    ];
    
    const totalSizeMB = mockDeployments.reduce((sum, d) => sum + d.sizeMB, 0);
    
    return NextResponse.json({
      deployments: mockDeployments,
      summary: {
        totalAgents: mockDeployments.length,
        activeAgents: mockDeployments.filter(d => d.status === 'active').length,
        totalSizeMB: +totalSizeMB.toFixed(2),
        runtimes: [...new Set(mockDeployments.map(d => d.runtime))]
      },
      agentSupport: {
        maxAgentsPerDeployment: 50,
        supportedRuntimes: ['nodejs20.x'],
        maxBundleSize: '250MB',
        deploymentTimeout: '10 minutes',
        approach: 'one-bundle-per-agent'
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch deployment status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}