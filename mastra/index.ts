import { Mastra } from "@mastra/core";
import { createEnvironmentStorage } from "./lib/memory-factory";
import { artifactAgent } from "./agents/artifact";
import { browserAgent } from "./agents/browser";
import { downloadAgent } from "./agents/download";
import { mathAgent } from "./agents/math";
import { planner } from "./agents/planner";
import { sandboxAgent } from "./agents/sandbox";
import { searcher } from "./agents/searcher";
import { v1Agent } from "./agents/v1-agent";
import { visionAgent } from "./agents/vision";
import { voiceAgent } from "./agents/voice";

// Environment-aware storage configuration
// This will automatically use Upstash for production/Vercel deployments
// and LibSQL for development/testing
const storage = createEnvironmentStorage();

export const mastra = new Mastra({
	storage, // Environment-aware storage
	// Note: Deployer removed in favor of Next.js integration
	// Next.js handles deployment through Vercel automatically
	agents: {
		Artifact: artifactAgent,
		Planner: planner,
		Searcher: searcher,
		Sandbox: sandboxAgent,
		Browser: browserAgent,
		Download: downloadAgent,
		Math: mathAgent,
		Vision: visionAgent,
		Voice: voiceAgent,
		V1Agent: v1Agent,
	},
	workflows: {},
	vnext_networks: {},
	// Server configuration for Next.js integration
	server: {
		// Disable standalone server in favor of Next.js API routes
		enabled: false,
	},
});
