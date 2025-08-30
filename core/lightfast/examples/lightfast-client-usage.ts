/**
 * Example of how developers would use the Lightfast client API
 * This file would typically be at src/lightfast/index.ts in the user's project
 */

import { Lightfast, createAgent } from "lightfast";
import { anthropic } from "@ai-sdk/anthropic";

// Example 1: Simple agent without tools
const assistantAgent = createAgent({
	name: "assistant",
	system: "You are a helpful AI assistant",
	model: anthropic("claude-3-5-sonnet-20241022"),
});

// Example 2: Agent with tools and runtime context
import { createTool } from "lightfast";
import { z } from "zod";

// Define runtime context type
type MyRuntimeContext = {
	sessionId: string;
	resourceId: string;
	userId?: string;
	organizationId?: string;
};

// Create a tool that uses runtime context
const searchTool = createTool<MyRuntimeContext>({
	description: "Search for information in the knowledge base",
	inputSchema: z.object({
		query: z.string().describe("The search query"),
		limit: z.number().optional().default(10),
	}),
	execute: async ({ query, limit }, context) => {
		// Access runtime context in the tool
		console.log(`Searching for user ${context.userId} in org ${context.organizationId}`);
		console.log(`Session: ${context.sessionId}`);
		
		// Simulate search
		return {
			results: [`Result 1 for "${query}"`, `Result 2 for "${query}"`].slice(0, limit),
			totalCount: 2,
		};
	},
});

// Create an agent with tools
const researchAgent = createAgent<MyRuntimeContext>({
	name: "research-agent",
	system: `You are a research assistant with access to search tools.
Always cite your sources when providing information.`,
	model: anthropic("claude-3-5-sonnet-20241022"),
	tools: {
		search: searchTool,
	},
	createRuntimeContext: ({ sessionId, resourceId }) => ({
		sessionId,
		resourceId,
		userId: "user-123", // In real app, would get from auth
		organizationId: "org-456", // In real app, would get from auth
	}),
});

// Example 3: Agent with caching (for Anthropic)
import { createAnthropicCache } from "lightfast/cache";

const cachedAgent = createAgent({
	name: "cached-agent",
	system: "You are an AI assistant with caching enabled for better performance",
	model: anthropic("claude-3-5-sonnet-20241022"),
	cache: createAnthropicCache({
		strategy: "lastNMessages",
		maxCachedMessages: 10,
	}),
});

// Create the Lightfast client instance
const lightfast = new Lightfast({
	agents: {
		assistant: assistantAgent,
		research: researchAgent,
		cached: cachedAgent,
	},
	
	// Optional: Dev server configuration
	dev: {
		port: 3000,
		hotReload: true,
		verbose: false,
	},
	
	// Optional: Metadata about your project
	metadata: {
		name: "My AI Project",
		version: "1.0.0",
		description: "An AI-powered application using Lightfast",
	},
});

// Export as default for the CLI to pick up
export default lightfast;

// You can also export individual agents if needed
export { assistantAgent, researchAgent, cachedAgent };

/**
 * Usage with the CLI:
 * 
 * 1. Install the CLI:
 *    npm install -D @lightfastai/cli
 *    
 * 2. Add to package.json scripts:
 *    "scripts": {
 *      "dev": "lightfast dev",
 *      "build": "lightfast build"
 *    }
 *    
 * 3. Run the dev server:
 *    npm run dev
 *    
 * The CLI will:
 * - Automatically discover this file at src/lightfast/index.ts
 * - Start a dev UI showing all your agents
 * - Provide hot reload on changes
 * - Show agent details, tools, and allow testing
 */

/**
 * Programmatic usage example:
 */
function demonstrateUsage() {
	// Get all agents
	const agents = lightfast.getAgents();
	console.log("Available agents:", Object.keys(agents));
	
	// Get a specific agent
	const assistant = lightfast.getAgent("assistant");
	console.log("Assistant agent:", assistant?.name);
	
	// Get metadata for CLI/UI display
	const metadata = lightfast.toJSON();
	console.log("Lightfast metadata:", JSON.stringify(metadata, null, 2));
}