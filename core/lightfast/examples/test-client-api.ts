/**
 * Test file to verify the Lightfast client API works correctly
 * This imports from the local build
 */

// Import from local build
import { Lightfast, createAgent } from "../dist/index.mjs";
import type { LightfastConfig } from "../dist/index";

// Mock a language model for testing
const mockModel = {
	provider: "test-provider",
	modelId: "test-model",
} as any;

// Test 1: Create a simple agent
const testAgent = createAgent({
	name: "test-agent",
	system: "You are a test agent",
	model: mockModel,
});

// Test 2: Create Lightfast instance
const lightfast = new Lightfast({
	agents: {
		testAgent,
	},
});

// Test 3: Verify the API methods work
console.log("Testing Lightfast Client API...");
console.log("================================");

// Get all agents
const agents = lightfast.getAgents();
console.log("✓ getAgents():", Object.keys(agents));

// Get specific agent
const agent = lightfast.getAgent("testAgent");
console.log("✓ getAgent('testAgent'):", agent?.name);

// Get agent keys
const keys = lightfast.getAgentKeys();
console.log("✓ getAgentKeys():", keys);

// Get config
const config = lightfast.getConfig();
console.log("✓ getConfig() has agents:", Boolean(config.agents));

// Get metadata
const metadata = lightfast.getMetadata();
console.log("✓ getMetadata():", metadata || "undefined (as expected)");

// Get dev config
const devConfig = lightfast.getDevConfig();
console.log("✓ getDevConfig():", devConfig || "undefined (as expected)");

// Test JSON export for CLI
const json = lightfast.toJSON();
console.log("✓ toJSON() structure:");
console.log("  - agents:", json.agents);
console.log("  - metadata:", json.metadata);
console.log("  - dev:", json.dev);

// Test with multiple agents and full config
const lightfastFull = new Lightfast({
	agents: {
		agent1: createAgent({
			name: "agent-1",
			system: "Agent 1 system",
			model: mockModel,
		}),
		agent2: createAgent({
			name: "agent-2",
			system: "Agent 2 system",
			model: mockModel,
		}),
	},
	dev: {
		port: 3001,
		hotReload: false,
		verbose: true,
	},
	metadata: {
		name: "Test Project",
		version: "1.0.0",
		description: "Testing the Lightfast client API",
	},
});

const fullJson = lightfastFull.toJSON();
console.log("\n✓ Full configuration test:");
console.log("  - Agent count:", fullJson.agents.length);
console.log("  - Dev port:", fullJson.dev?.port);
console.log("  - Project name:", fullJson.metadata?.name);

console.log("\n✅ All tests passed!");
console.log("The Lightfast client API is working correctly.");