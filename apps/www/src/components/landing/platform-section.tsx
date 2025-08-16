"use client";

import React, { useState } from "react";
import { Shield, Cpu, Workflow, Users, Zap, Code } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { CodeHighlighter } from "./code-highlighter";

const features = [
	{
		id: "orchestration",
		icon: Workflow,
		title: "Agent Orchestration",
		filename: "agent.ts",
		description:
			"Build agents with tool factories and runtime context injection",
		code: `import { createAgent } from '@lightfast/core/agent';
import { createTool } from '@lightfast/core/tool';

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
		title: "Resource Management",
		filename: "resource.ts",
		description: "Sandboxes, browser automation, and file operations",
		code: `import { createTool } from '@lightfast/core/tool';
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
		title: "Security & Validation",
		filename: "security.ts",
		description: "Input validation, session auth, and audit logging",
		code: `import { fetchRequestHandler } from '@lightfast/core/agent/handlers';
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
		title: "Human-in-the-Loop",
		filename: "human.ts",
		description: "Approval workflows and human oversight (coming soon)",
		code: `import { createTool } from '@lightfast/core/tool';
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
		title: "Memory & Performance",
		filename: "memory.ts",
		description: "Persistent memory, caching, and streaming",
		code: `import { RedisMemory } from '@lightfast/core/agent/memory/adapters/redis';
import { AnthropicProviderCache, ClineConversationStrategy } from '@lightfast/core/agent/primitives/cache';
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
	{
		id: "sdk",
		icon: Code,
		title: "Production Ready",
		filename: "production.ts",
		description: "Observability, error handling, and deployment",
		code: `import { fetchRequestHandler } from '@lightfast/core/agent/handlers';
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
];

export function PlatformSection() {
	const [selectedFeature, setSelectedFeature] = useState("orchestration");
	const activeFeature = features.find((f) => f.id === selectedFeature) ?? features[0];

	if (!activeFeature) {
		return null;
	}

	return (
		<>
			{/* Mobile - Tabs */}
			<div className="block lg:hidden">
					<div className="space-y-3">
						<div className="px-3">
							<h3 className="font-semibold text-sm">{activeFeature.title}</h3>
							<p className="text-xs text-muted-foreground mt-1">{activeFeature.description}</p>
						</div>
						<div className="relative rounded-lg border bg-background h-[350px] sm:h-[400px] md:h-[450px] flex flex-col overflow-hidden">
							<div className="flex items-center border-b flex-shrink-0 overflow-x-auto scrollbar-hide">
								{features.map((feature) => (
									<Button
										key={feature.id}
										variant="ghost"
										onClick={() => setSelectedFeature(feature.id)}
										className={`rounded-none px-3 py-2 h-auto text-[10px] sm:text-xs font-mono whitespace-nowrap border-r ${
											selectedFeature === feature.id 
												? "bg-accent" 
												: ""
										}`}
									>
										{feature.filename}
									</Button>
								))}
							</div>
							<div className="flex-1 overflow-y-auto">
								<CodeHighlighter
									code={activeFeature.code}
									language="typescript"
								/>
							</div>
						</div>
					</div>
			</div>

			{/* Desktop - Side by side */}
				<div className="hidden lg:grid lg:grid-cols-5 gap-6 xl:gap-8 items-stretch">
					{/* Left side - Code display (3/5) */}
					<div className="lg:col-span-3">
						<div className="relative rounded-lg border bg-background h-[500px] flex flex-col overflow-hidden">
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
							<div className="flex-1 overflow-y-auto">
								<CodeHighlighter
									code={activeFeature.code}
									language="typescript"
								/>
							</div>
						</div>
					</div>

					{/* Right side - Feature list (2/5) */}
					<div className="lg:col-span-2">
						<div className="h-[500px] rounded-md flex items-center">
							<div className="space-y-1 w-full">
								{features.map((feature) => {
									const Icon = feature.icon;
									return (
										<Button
											key={feature.id}
											variant="ghost"
											onClick={() => setSelectedFeature(feature.id)}
											className={`w-full justify-start h-auto p-3 ${
												selectedFeature === feature.id
													? "bg-accent"
													: ""
											}`}
										>
											<div className="flex items-center gap-3 w-full">
												<div
													className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-200 ${
														selectedFeature === feature.id
															? "bg-primary/20"
															: "bg-primary/10"
													}`}
												>
													<Icon className="h-4 w-4 text-primary" />
												</div>
												<div className="flex-1 text-left">
													<div className="font-semibold text-sm leading-tight">
														{feature.title}
													</div>
													<div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
														{feature.description}
													</div>
												</div>
											</div>
										</Button>
									);
								})}
							</div>
						</div>
					</div>
				</div>
		</>
	);
}