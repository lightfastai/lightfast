import { NextRequest, NextResponse } from 'next/server';
import { fetchRequestHandler } from 'lightfast/server/adapters/fetch';
import { createAgent } from 'lightfast/agent';
import { gateway } from '@ai-sdk/gateway';
import { InMemoryMemory } from 'lightfast/memory/adapters/in-memory';
import { z } from 'zod';
import { uuidv4 } from 'lightfast/v2/utils';
import { parseAgentBundle } from '~/lib/bundle-parser';
import { createProxiedTools } from '~/lib/tool-proxy';

const ExecuteRequestSchema = z.object({
  bundleUrl: z.string().url(),
  input: z.string().min(1),
  agentName: z.string().min(1).max(100),
  organizationId: z.string().min(1),
  sessionId: z.string().optional().default(() => uuidv4()),
});

type ExecuteRequest = z.infer<typeof ExecuteRequestSchema>;

/**
 * Create a real Lightfast agent from parsed configuration
 */
function createAgentFromConfig(
  agentConfig: any,
  organizationId: string,
  sessionId: string
) {
  // Create proxied tools that redirect to secure execution
  const proxiedTools = agentConfig.tools 
    ? createProxiedTools(agentConfig.tools, organizationId, sessionId)
    : {};

  // Create the real agent with runtime context
  return createAgent({
    name: agentConfig.name,
    system: agentConfig.system,
    model: gateway(agentConfig.model),
    tools: proxiedTools,
    createRuntimeContext: ({ sessionId, resourceId }) => ({
      sessionId,
      resourceId,
    }),
  });
}

/**
 * POST /api/execute
 * Execute Lightfast agent bundles with proper streaming via fetchRequestHandler
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Parse and validate request
    const body = await request.json();
    const validatedRequest = ExecuteRequestSchema.parse(body);
    
    const { bundleUrl, input, agentName, organizationId, sessionId } = validatedRequest;
    
    // Create a new request with messages format for fetchRequestHandler
    const messagesRequest = new Request(request.url, {
      method: 'POST', 
      headers: {
        'content-type': 'application/json',
        'user-agent': request.headers.get('user-agent') || '',
        'x-forwarded-for': request.headers.get('x-forwarded-for') || '',
        'x-real-ip': request.headers.get('x-real-ip') || ''
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: input }] })
    });

    console.log(`[LIGHTFAST-EXECUTE] Starting execution for agent: ${agentName} (org: ${organizationId})`);

    // 1. Fetch the agent bundle
    const bundleResponse = await fetch(bundleUrl);
    
    if (!bundleResponse.ok) {
      throw new Error(`Failed to fetch agent bundle: ${bundleResponse.status} ${bundleResponse.statusText}`);
    }

    const bundleCode = await bundleResponse.text();

    if (!bundleCode.trim()) {
      throw new Error('Agent bundle is empty');
    }

    // 2. Parse the bundle safely using AST analysis (no code execution)
    console.log(`[LIGHTFAST-EXECUTE] Parsing bundle for agent: ${agentName}`);
    
    const lightfastConfig = parseAgentBundle(bundleCode);
    
    if (!lightfastConfig.agents || Object.keys(lightfastConfig.agents).length === 0) {
      throw new Error('No agents found in bundle');
    }

    // 3. Find the requested agent configuration
    const agentConfig = lightfastConfig.agents[agentName];
    if (!agentConfig) {
      const availableAgents = Object.keys(lightfastConfig.agents).join(', ');
      throw new Error(`Agent '${agentName}' not found in bundle. Available agents: ${availableAgents}`);
    }

    console.log(`[LIGHTFAST-EXECUTE] Creating agent: ${agentConfig.name} with model: ${agentConfig.model}`);

    // 4. Create the real Lightfast agent with proxied tools
    const agent = createAgentFromConfig(agentConfig, organizationId, sessionId);

    // 5. Create memory for this session
    const memory = new InMemoryMemory();

    // 6. Use fetchRequestHandler for native AI SDK streaming
    console.log(`[LIGHTFAST-EXECUTE] Starting fetchRequestHandler for ${agentName}`);
    
    const response = await fetchRequestHandler({
      agent,
      sessionId,
      memory,
      req: messagesRequest, // Use request with messages format
      resourceId: organizationId,
      context: {
        organizationId,
        agentName,
        bundleUrl
      },
      createRequestContext: (req) => ({
        userAgent: req.headers.get('user-agent') ?? undefined,
        ipAddress: 
          req.headers.get('x-forwarded-for') ?? 
          req.headers.get('x-real-ip') ?? 
          undefined,
      }),
      generateId: uuidv4,
      onError(event) {
        const { error, systemContext } = event;
        console.error(
          `[LIGHTFAST-EXECUTE] Error in agent ${agentName}:`,
          {
            error: error.message,
            sessionId: systemContext.sessionId,
            organizationId,
            agentName,
          }
        );
      },
      onStreamStart(event) {
        const { streamId, agentName: eventAgentName } = event;
        console.log(`[LIGHTFAST-EXECUTE] Stream started for ${eventAgentName}`, { streamId, sessionId });
      },
      onStreamComplete(event) {
        const { streamId, agentName: eventAgentName } = event;
        console.log(`[LIGHTFAST-EXECUTE] Stream completed for ${eventAgentName}`, { streamId, sessionId });
      },
    });

    return response;

  } catch (error: any) {
    console.error('[LIGHTFAST-EXECUTE] Request failed:', error);

    // Return error in consistent format
    if (error.issues) {
      return NextResponse.json({
        error: `Validation error: ${error.issues.map((i: any) => i.message).join(', ')}`
      }, { status: 400 });
    }

    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * GET /api/execute
 * Health check endpoint
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service: 'lightfast-agent-executor',
    status: 'healthy',
    runtime: 'nodejs',
    features: {
      isolatedVm: true,
      lightfastFramework: true,
      aiSdkStreaming: true
    },
    timestamp: new Date().toISOString()
  });
}

// Force Node.js runtime for isolated-vm compatibility
export const runtime = 'nodejs';