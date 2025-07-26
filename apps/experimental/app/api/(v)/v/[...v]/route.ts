import { gateway } from "@ai-sdk/gateway";
import { auth } from "@clerk/nextjs/server";
import { createAgent } from "@lightfast/ai/agent";
import { fetchRequestHandler } from "@lightfast/ai/agent/handlers";
import { RedisMemory } from "@lightfast/ai/agent/memory/adapters/redis";
import type { RuntimeContext } from "@lightfast/ai/agent/server/adapters/types";
import { createTool } from "@lightfast/ai/tool";
import { smoothStream, stepCountIs } from "ai";
import { z } from "zod";
import { A011_SYSTEM_PROMPT } from "@/app/ai/agents/a011";
import { env } from "@/env";
import { uuidv4 } from "@/lib/uuidv4";

// Define agent-specific context
interface AgentRuntimeContext {
	// Add any agent-specific context here
	// The agent already has access to threadId and resourceId from system context
}

// Create tools using the new createTool pattern with context injection
const file = createTool<RuntimeContext<AgentRuntimeContext>>({
	description: "Create, read, or write files",
	inputSchema: z.object({
		operation: z.enum(["create", "read", "write"]),
		path: z.string(),
		content: z.string().optional(),
	}),
	execute: async ({ operation, path, content }, context) => {
		// Tool has access to all three context levels
		console.log(`File ${operation} for thread ${context.threadId} from IP ${context.ipAddress}`);
		return { result: `${operation} ${path}` };
	},
});

const webSearch = createTool<RuntimeContext<AgentRuntimeContext>>({
	description: "Search the web",
	inputSchema: z.object({
		query: z.string(),
	}),
	execute: async ({ query }, context) => {
		// Tool has access to system, request, and agent context
		console.log(`Web search for thread ${context.threadId} with UA ${context.userAgent}: ${query}`);
		return { results: `Search results for ${query}` };
	},
});

const todoWrite = createTool<RuntimeContext<AgentRuntimeContext>>({
	description: "Write todos",
	inputSchema: z.object({
		todos: z.array(z.object({
			content: z.string(),
			status: z.enum(["pending", "in_progress", "completed"]),
			priority: z.enum(["low", "medium", "high"]),
			id: z.string(),
		})),
	}),
	execute: async ({ todos }, context) => {
		console.log(`Writing todos for thread ${context.threadId} from IP ${context.ipAddress}`);
		return { success: true, count: todos.length };
	},
});

// Create tools object for agent
const a011Tools = {
	file,
	webSearch,
	todoWrite,
} as const;

// Infer the tool schema type
type A011ToolSchema = typeof a011Tools;

// Handler function that handles auth and calls fetchRequestHandler
const handler = async (req: Request, { params }: { params: Promise<{ v: string[] }> }) => {
	// Await the params
	const { v } = await params;
	// Handle authentication
	const { userId } = await auth();
	if (!userId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Extract agentId and threadId from params
	// Expected URL: /api/v/[agentId]/[threadId]
	const [agentId, threadId] = v || [];

	if (!agentId || !threadId) {
		return Response.json({ error: "Invalid path. Expected /api/v/[agentId]/[threadId]" }, { status: 400 });
	}

	// Define agent based on agentId
	// For now, we only have a011
	if (agentId !== "a011") {
		return Response.json({ error: "Agent not found" }, { status: 404 });
	}

	const agent = createAgent<A011ToolSchema, AgentRuntimeContext>({
		name: "a011",
		system: A011_SYSTEM_PROMPT,
		tools: a011Tools, // Pass the tools directly
		createRuntimeContext: ({ threadId, resourceId }): AgentRuntimeContext => ({
			// Create agent-specific context
			// The agent can use threadId and resourceId if needed
			// but they're already available in system context
		}),
		model: gateway("anthropic/claude-4-sonnet"),
		experimental_transform: smoothStream({
			delayInMs: 25,
			chunking: "word",
		}),
		stopWhen: stepCountIs(30),
		// Optional: Add agent-specific callbacks with strong typing
		onChunk: ({ chunk }) => {
			if (chunk.type === "tool-call") {
				// TypeScript should now know the exact tool names from a011Tools
				console.log("Tool called:", chunk.toolName);

				// Test strong typing - these should work
				if (chunk.toolName === "file") {
					console.log("File tool called");
				} else if (chunk.toolName === "webSearch") {
					console.log("Web search called");
				} else if (chunk.toolName === "todoWrite") {
					console.log("Todo tool called");
				}
				
				// TypeScript correctly prevents invalid tool names:
				// if (chunk.toolName === "nonExistentTool") { // ❌ Error: This comparison appears to be unintentional
				// 	console.log("This should error!");
				// }
			}
		},
		onFinish: ({ finishReason, usage }) => {
			console.log("a011 finished:", { finishReason, usage });
		},
	});

	// Create Redis memory instance
	const memory = new RedisMemory({
		url: env.KV_REST_API_URL,
		token: env.KV_REST_API_TOKEN,
	});

	// Pass everything to fetchRequestHandler
	return fetchRequestHandler({
		agent,
		threadId,
		memory,
		req,
		resourceId: userId,
		createRequestContext: (req) => ({
			// Create request-level context from HTTP request
			userAgent: req.headers.get("user-agent") || undefined,
			ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
		}),
		generateId: uuidv4,
		enableResume: true,
		onError({ error }) {
			console.error(`>>> Agent Error`, error);
		},
	});
};

// Export the handler for both GET and POST
export { handler as GET, handler as POST };
