"use client";

import React, { useState } from "react";
import { Shield, Cpu, Workflow, Users, Zap, Code } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
	CodeBlock,
	CodeBlockCopyButton,
} from "@repo/ui/components/ai-elements/code-block";

const features = [
	{
		id: "production",
		icon: Code,
		title: "Production",
		filename: "production.ts",
		description: "Observability, error handling, and deployment",
		code: `import { fetchRequestHandler } from '@lightfastai/core/agent/handlers';
import { BraintrustMiddleware, traced } from 'braintrust';
import { wrapLanguageModel } from 'ai';

// API route handler with auth and tracing
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return traced(
    async () => {
      return fetchRequestHandler({
        agent,
        sessionId,
        memory,
        req,
        resourceId: userId,
        enableResume: true,  // Resumable streams
        
        onError({ error }) {
          console.error('Agent Error:', error);
          // Send to Sentry, LogDNA, etc.
        },
        
        onFinish(result) {
          // Log to observability platform
          currentSpan().log({
            input: { sessionId, userId },
            output: result.text,
            metadata: {
              usage: result.usage,
              reasoning: result.reasoning,
              finishReason: result.finishReason
            }
          });
        }
      });
    },
    { name: 'POST /api/agent' }
  );
}

// Deploy to Vercel, Railway, or self-host
// Works with any Node.js runtime`,
	},
	{
		id: "orchestration",
		icon: Workflow,
		title: "Orchestration",
		filename: "agent.ts",
		description:
			"Build agents with tool factories and runtime context injection",
		code: `import { createAgent } from '@lightfastai/core/agent';
import { createTool } from '@lightfastai/core/tool';

// Define tools with runtime context access
const searchTool = createTool({
  description: 'Search the web for information',
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }, context) => {
    // Access runtime context in tool execution
    console.log('Session:', context.sessionId);
    console.log('User:', context.userId);
    
    const results = await search(query);
    return { results };
  }
});

// Create agent with system prompt and tools
const agent = createAgent({
  name: 'research-agent',
  model: gateway('anthropic/claude-3-sonnet'),
  system: \`You are a research assistant.
    Break down complex queries into steps.\`,
  
  tools: {
    search: searchTool,
    analyze: analyzeTool,
    summarize: summarizeTool
  },
  
  createRuntimeContext: ({ sessionId, resourceId }) => ({
    sessionId,
    userId: resourceId,
    timestamp: Date.now()
  })
});`,
	},
	{
		id: "resources",
		icon: Cpu,
		title: "Resources",
		filename: "resource.ts",
		description: "Sandboxes, browser automation, and file operations",
		code: `import { createTool } from '@lightfastai/core/tool';
import Sandbox from '@e2b/code-interpreter';

// Sandbox execution tool with session persistence
export const sandboxTool = createTool({
  description: 'Execute code in a persistent sandbox',
  inputSchema: z.object({
    code: z.string(),
    language: z.enum(['python', 'nodejs', 'bash'])
  }),
  execute: async ({ code, language }, context) => {
    // Get or create sandbox for this session
    let sandbox = context.sandboxes.get(context.sessionId);
    
    if (!sandbox) {
      sandbox = await Sandbox.create({
        apiKey: process.env.E2B_API_KEY,
        memory: '2GB',
        timeout: 300 // 5 minutes
      });
      context.sandboxes.set(context.sessionId, sandbox);
    }
    
    // Execute code in the persistent sandbox
    const result = await sandbox.exec(code);
    return { 
      output: result.logs.stdout,
      error: result.logs.stderr,
      sandboxId: sandbox.id
    };
  }
});

// Browser automation (coming soon)
export const browserTool = createTool({
  description: 'Automate browser interactions',
  inputSchema: z.object({ url: z.string() }),
  execute: async ({ url }, context) => {
    // Integration with Browserbase coming soon
    return { status: 'Browser automation coming soon' };
  }
});`,
	},
	{
		id: "security",
		icon: Shield,
		title: "Security",
		filename: "security.ts",
		description: "Input validation, session auth, and audit logging",
		code: `import { fetchRequestHandler } from '@lightfastai/core/agent/handlers';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';

// Session validation and ownership
async function validateSession(memory, sessionId, userId) {
  const session = await memory.getSession(sessionId);
  
  if (!session) {
    return { exists: false };
  }
  
  if (session.resourceId !== userId) {
    throw new SessionForbiddenError();
  }
  
  return { exists: true, session };
}

// Tool with input validation
const secureTool = createTool({
  description: 'Process sensitive data',
  inputSchema: z.object({
    url: z.string().url().refine(
      url => url.startsWith('https://'),
      'Only HTTPS URLs allowed'
    ),
    apiKey: z.string().min(32).regex(
      /^sk-[a-zA-Z0-9]+$/,
      'Invalid API key format'
    )
  }),
  execute: async (input, context) => {
    // Audit log the action
    await auditLog({
      action: 'secure_tool_execution',
      userId: context.userId,
      sessionId: context.sessionId,
      timestamp: Date.now()
    });
    
    // Execute with validated input
    return processSecurely(input);
  }
});

// Coming soon: Runtime guards, cost limits, rate limiting`,
	},
	{
		id: "human",
		icon: Users,
		title: "Human",
		filename: "human.ts",
		description: "Approval workflows and human oversight (coming soon)",
		code: `import { createTool } from '@lightfastai/core/tool';
import { notifySlack, waitForApproval } from '@lightfast/human';

// Tool that requires human approval
const deployTool = createTool({
  description: 'Deploy changes to production',
  inputSchema: z.object({
    environment: z.enum(['staging', 'production']),
    changes: z.array(z.string())
  }),
  execute: async ({ environment, changes }, context) => {
    // Prepare approval request
    const approvalRequest = {
      id: crypto.randomUUID(),
      userId: context.userId,
      sessionId: context.sessionId,
      action: 'deploy_to_' + environment,
      changes,
      timestamp: Date.now()
    };
    
    // Notify approvers (coming soon)
    await notifySlack({
      channel: '#deployments',
      message: \`Approval needed for \${environment} deploy\`,
      approvalLink: \`/approve/\${approvalRequest.id}\`
    });
    
    // Wait for approval with timeout (coming soon)
    const approval = await waitForApproval({
      requestId: approvalRequest.id,
      timeout: 3600000, // 1 hour
      allowedApprovers: ['admin', 'lead']
    });
    
    if (approval.status === 'approved') {
      // Execute deployment
      return { deployed: true, approvedBy: approval.userId };
    }
    
    return { deployed: false, reason: approval.reason };
  }
});`,
	},
	{
		id: "scale",
		icon: Zap,
		title: "Memory",
		filename: "memory.ts",
		description: "Persistent memory, caching, and streaming",
		code: `import { RedisMemory } from '@lightfastai/core/agent/memory/adapters/redis';
import { AnthropicProviderCache, ClineConversationStrategy } from '@lightfastai/core/agent/primitives/cache';
import { smoothStream } from 'ai';

// Redis-based persistent memory
const memory = new RedisMemory({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

// Store and retrieve conversation history
await memory.createSession({ 
  sessionId, 
  resourceId: userId 
});
await memory.appendMessage({ 
  sessionId, 
  message 
});
const history = await memory.getMessages(sessionId);

// Anthropic cache optimization
const agent = createAgent({
  // Cline-inspired caching strategy
  cache: new AnthropicProviderCache({
    strategy: new ClineConversationStrategy({
      cacheSystemPrompt: true,        // Always cache system
      recentUserMessagesToCache: 2,   // Cache breakpoints
    })
  }),
  
  // Smooth streaming for better UX
  experimental_transform: smoothStream({
    delayInMs: 25,
    chunking: 'word'
  }),
  
  // Provider-specific optimizations
  providerOptions: {
    anthropic: {
      thinking: { 
        type: 'enabled',
        budgetTokens: 32000  // For complex reasoning
      }
    }
  }
});`,
	},
];

export function PlatformSection() {
	const [selectedFeature, setSelectedFeature] = useState("production");
	const activeFeature =
		features.find((f) => f.id === selectedFeature) ?? features[0];

	if (!activeFeature) {
		return null;
	}

	return (
		<div>
				{/* Mobile - Tabs */}
				<div className="block lg:hidden">
					<div className="space-y-3">
						<div className="px-3">
							<h3 className="font-semibold text-sm text-foreground">
								{activeFeature.title}
							</h3>
							<p className="text-xs text-muted-foreground mt-1">
								{activeFeature.description}
							</p>
						</div>
						<div className="relative rounded-lg border bg-background h-[450px] sm:h-[500px] md:h-[550px] flex flex-col overflow-hidden">
							<div className="flex items-center border-b flex-shrink-0 overflow-x-auto scrollbar-hide">
								{features.map((feature) => (
									<Button
										key={feature.id}
										variant="ghost"
										onClick={() => setSelectedFeature(feature.id)}
										className={`rounded-none px-3 py-2 h-auto text-[10px] sm:text-xs font-mono whitespace-nowrap border-r ${
											selectedFeature === feature.id ? "bg-accent" : ""
										}`}
									>
										{feature.filename}
									</Button>
								))}
							</div>
							<div className="flex-1 overflow-y-auto p-4">
								<CodeBlock
									code={activeFeature.code}
									language="typescript"
									forceTheme="github-dark"
								/>
							</div>
						</div>
					</div>
				</div>

				{/* Desktop - New layout with selector on top-left, code block full width */}
				<div className="hidden lg:block space-y-6">
					{/* Feature selector - Top left */}
					<div className="flex flex-wrap gap-2">
						{features.map((feature) => {
							const Icon = feature.icon;
							return (
								<Button
									key={feature.id}
									variant={
										selectedFeature === feature.id ? "secondary" : "ghost"
									}
									size="sm"
									onClick={() => setSelectedFeature(feature.id)}
									className="h-auto py-2 px-3"
								>
									<Icon className="h-4 w-4 mr-2 text-foreground" />
									<span className="font-medium text-foreground">
										{feature.title}
									</span>
								</Button>
							);
						})}
					</div>

					{/* Code display - Full width */}
					<div className="w-full">
						<div className="relative rounded-lg border bg-background h-[800px] flex flex-col overflow-hidden">
							<div className="flex items-center justify-between border-b px-4 py-3 flex-shrink-0">
								<div className="flex items-center gap-2">
									<div className="h-3 w-3 rounded-full bg-destructive" />
									<div className="h-3 w-3 rounded-full bg-yellow-500" />
									<div className="h-3 w-3 rounded-full bg-green-500" />
								</div>
								<span className="text-xs text-muted-foreground font-mono">
									{activeFeature.filename}
								</span>
							</div>
							<div className="flex-1 overflow-y-auto p-4">
								<CodeBlock
									code={activeFeature.code}
									language="typescript"
									forceTheme="github-dark"
								/>
							</div>
						</div>
					</div>
				</div>
		</div>
	);
}
