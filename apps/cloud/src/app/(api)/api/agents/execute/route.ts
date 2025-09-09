import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAgent } from "lightfast/agent";
import { fetchRequestHandler } from "lightfast/server/adapters/fetch";
import { RedisMemory } from "lightfast/memory/adapters/redis";
import { db } from "@db/cloud/client";
import { CloudAgent } from "@db/cloud/schema";
import { eq, and } from "drizzle-orm";
import { env } from "~/env";
import type { ModelMessage } from "ai";
import { convertToCoreMessages } from "ai";

// Use Node.js runtime for bundle execution  
export const runtime = "nodejs";
export const maxDuration = 60; // 1 minute timeout

/**
 * POST /api/agents/execute
 * 
 * Agent execution endpoint for compiled bundles.
 * Based on apps/experimental pattern but adapted for bundle loading.
 * 
 * Expected request:
 * {
 *   "agentId": "researcher",
 *   "sessionId": "session-123",
 *   "messages": [{ "id": "msg-1", "role": "user", "parts": [{ "type": "text", "text": "test search" }] }]
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Validate authentication - COMMENTED OUT FOR TESTING
    // const { userId, orgId: organizationId } = await auth();
    // if (!userId || !organizationId) {
    //   return NextResponse.json({
    //     success: false,
    //     error: "Authentication required"
    //   }, { status: 401 });
    // }
    
    // Use hardcoded values for testing
    const userId = "test-user";
    const organizationId = "org_32Ou";

    const body = await request.json();
    const { agentId, sessionId, messages } = body;
    
    // Validate required parameters
    if (!agentId) {
      return NextResponse.json({
        success: false,
        error: "agentId is required"
      }, { status: 400 });
    }
    
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: "sessionId is required"
      }, { status: 400 });
    }
    
    console.log(`[AGENT-EXEC] Executing agent: ${agentId}, session: ${sessionId} for org: ${organizationId}`);
    console.log(`[AGENT-EXEC] Messages:`, messages);
    
    // Use hardcoded bundle URL for testing - SKIP DATABASE LOOKUP
    const bundleUrl = "https://33bav9epzifxvdo9.public.blob.vercel-storage.com/agents/org_32Ou/customerSupport/1757410182322.js";
    const agent = {
      id: "72007dce-91a8-4f8f-834e-ccdcd1d93592",
      name: "customerSupport",
      bundleUrl: bundleUrl,
      createdAt: new Date()
    };
    
    console.log(`[AGENT-EXEC] Found agent '${agent.name}' (ID: ${agent.id})`);
    console.log(`[AGENT-EXEC] Bundle URL: ${bundleUrl}`);
    
    // Fetch bundle from Vercel Blob storage
    let bundleContent: string;
    try {
      console.log(`[AGENT-EXEC] Fetching bundle from: ${bundleUrl}`);
      const bundleResponse = await fetch(bundleUrl);
      
      if (!bundleResponse.ok) {
        throw new Error(`HTTP ${bundleResponse.status}: ${bundleResponse.statusText}`);
      }
      
      bundleContent = await bundleResponse.text();
      console.log(`[AGENT-EXEC] Bundle fetched successfully (${bundleContent.length} chars)`);
      
    } catch (fetchError) {
      console.error(`[AGENT-EXEC] Failed to fetch bundle:`, fetchError);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch agent bundle: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
        agentId,
        executionTime: Date.now() - startTime
      }, { status: 500 });
    }
    
    // Skip bundle evaluation for now and use hardcoded agent config for testing
    console.log(`[AGENT-EXEC] Using hardcoded agent configuration for testing`);
    
    const agentConfig = {
      config: {
        agents: {
          customerSupport: {
            lightfastConfig: {
              name: "customerSupport",
              system: "You are a helpful customer support agent. Help users with their questions and issues.",
              tools: {}
            },
            vercelConfig: {
              model: {
                modelId: "anthropic/claude-3-5-sonnet-20241022"
              }
            }
          }
        }
      }
    };
    
    console.log(`[AGENT-EXEC] Using hardcoded config for customerSupport agent`);
    
    // Check if we got a valid agent config
    if (!agentConfig?.config?.agents) {
      console.error(`[AGENT-EXEC] Invalid agent config:`, agentConfig);
      return NextResponse.json({
        success: false,
        error: "Bundle does not export a valid Lightfast agent configuration",
        agentId,
        executionTime: Date.now() - startTime
      }, { status: 500 });
    }
    
    // Get the specific agent from the config
    const targetAgent = agentConfig.config.agents[agentId as keyof typeof agentConfig.config.agents];
    if (!targetAgent) {
      console.error(`[AGENT-EXEC] Agent '${agentId}' not found in bundle. Available agents:`, Object.keys(agentConfig.config.agents));
      return NextResponse.json({
        success: false,
        error: `Agent '${agentId}' not found in bundle`,
        availableAgents: Object.keys(agentConfig.config.agents),
        agentId,
        executionTime: Date.now() - startTime
      }, { status: 404 });
    }
    
    console.log(`[AGENT-EXEC] Found target agent:`, targetAgent.lightfastConfig?.name);
    console.log(`[AGENT-EXEC] Full target agent config:`, JSON.stringify(targetAgent, null, 2));
    
    // Create Redis memory instance using KV pattern from experimental app
    const memory = new RedisMemory({
      url: env.KV_REST_API_URL,
      token: env.KV_REST_API_TOKEN,
    });
    console.log(`[AGENT-EXEC] Using KV Redis memory`)
    
    console.log(`[AGENT-EXEC] Created memory instance, executing agent with fetchRequestHandler`);
    
    // Execute the agent using fetchRequestHandler like the experimental app
    try {
      // The key insight: fetchRequestHandler expects to parse the original HTTP request
      // We need to create a new request with the expected message format
      // Validate messages format
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return NextResponse.json({
          success: false,
          error: "messages array is required and must not be empty"
        }, { status: 400 });
      }
      
      console.log(`[AGENT-EXEC] Forwarding request with ${messages.length} messages`);
      // Extract the actual configuration from the nested structure
      // Import the gateway function to properly construct the model
      const { gateway } = await import("@ai-sdk/gateway");
      
      // Construct the model using the gateway function like the experimental app
      const modelId = targetAgent.vercelConfig?.model?.modelId || "anthropic/claude-4-sonnet";
      const constructedModel = gateway(modelId);
      
      const agentConfig = {
        name: targetAgent.lightfastConfig?.name || agentId,
        system: targetAgent.lightfastConfig?.system,
        model: constructedModel,
        tools: targetAgent.lightfastConfig?.tools || {},
      };
      
      console.log(`[AGENT-EXEC] Extracted agent config:`, {
        name: agentConfig.name,
        hasSystem: !!agentConfig.system,
        hasModel: !!agentConfig.model,
        toolCount: Object.keys(agentConfig.tools).length,
      });
      
      // Create a new request body with the proper format
      const newRequestBody = { messages };
      
      // Create a new Request object with the expected message format
      const newRequest = new Request(request.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Preserve important headers but don't copy all of them
        },
        body: JSON.stringify(newRequestBody),
      });
      
      const response = await fetchRequestHandler({
        agent: createAgent({
          name: agentConfig.name,
          system: agentConfig.system,
          model: agentConfig.model,
          tools: agentConfig.tools,
        }),
        sessionId,
        resourceId: sessionId, // Use sessionId as resourceId
        memory,
        req: newRequest, // Pass the new request with proper message format
        enableResume: true,
        generateId: () => crypto.randomUUID(),
        onError({ error }) {
          console.error(`[AGENT-EXEC] Agent execution error:`, error);
        },
      });
      
      console.log(`[AGENT-EXEC] Agent execution completed successfully`);
      return response;
      
    } catch (execError) {
      console.error(`[AGENT-EXEC] Failed to execute agent:`, execError);
      return NextResponse.json({
        success: false,
        error: `Failed to execute agent: ${execError instanceof Error ? execError.message : String(execError)}`,
        agentId,
        sessionId,
        executionTime: Date.now() - startTime
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error(`[AGENT-EXEC] Request failed:`, error);
    return NextResponse.json({
      success: false,
      error: `Request failed: ${error instanceof Error ? error.message : String(error)}`,
      executionTime: Date.now() - startTime
    }, { status: 500 });
  }
}

/**
 * Find bundle file for agent
 */
async function findBundle(agentId: string): Promise<string | null> {
  const path = require('path');
  const fs = require('fs').promises;
  
  // Look in expected location
  const bundleDir = path.join(process.cwd(), '.lightfast', 'dist', 'nodejs-bundles');
  
  try {
    await fs.access(bundleDir);
    const files = await fs.readdir(bundleDir);
    
    // Find bundle for this agent
    const bundleFile = files.find((f: string) => 
      f.startsWith(`${agentId}.nodejs.`) && f.endsWith('.js')
    );
    
    if (bundleFile) {
      return path.join(bundleDir, bundleFile);
    }
  } catch (error) {
    console.log(`[AGENT-EXEC] Bundle directory not found: ${bundleDir}`);
  }
  
  return null;
}

/**
 * GET /api/agents/execute
 * 
 * Show available deployed agents for this organization
 */
export async function GET() {
  try {
    // Validate authentication - COMMENTED OUT FOR TESTING
    // const { userId, orgId: organizationId } = await auth();
    // if (!userId || !organizationId) {
    //   return NextResponse.json({
    //     success: false,
    //     error: "Authentication required"
    //   }, { status: 401 });
    // }
    
    const organizationId = "org_32Ou";

    // Query all deployed agents for this organization
    const deployedAgents = await db
      .select({
        id: CloudAgent.id,
        name: CloudAgent.name,
        bundleUrl: CloudAgent.bundleUrl,
        createdAt: CloudAgent.createdAt,
        createdByUserId: CloudAgent.createdByUserId
      })
      .from(CloudAgent)
      .where(eq(CloudAgent.clerkOrgId, organizationId))
      .orderBy(CloudAgent.createdAt);

    return NextResponse.json({
      success: true,
      organization: organizationId,
      available: deployedAgents.map(agent => ({
        agentId: agent.name,
        id: agent.id,
        bundleUrl: agent.bundleUrl,
        createdAt: agent.createdAt,
        createdBy: agent.createdByUserId
      })),
      instructions: {
        deploy: "Use 'lightfast deploy' to deploy agents to this organization",
        execute: "POST /api/agents/execute with {\"agentId\": \"<name>\", \"sessionId\": \"<session>\", \"messages\": [...]}"
      },
      count: deployedAgents.length
    });
    
  } catch (error) {
    console.error(`[AGENT-EXEC] Failed to list agents:`, error);
    return NextResponse.json({
      success: false,
      error: `Failed to list deployed agents: ${error instanceof Error ? error.message : String(error)}`
    }, { status: 500 });
  }
}