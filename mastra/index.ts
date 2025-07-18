import { Mastra } from "@mastra/core";
import { env } from "../env";
import { artifactAgent } from "./agents/artifact";
import { browserAgent } from "./agents/browser";
import { chatAgent } from "./agents/chat";
import { downloadAgent } from "./agents/download";
import { mathAgent } from "./agents/math";
import { planner } from "./agents/planner";
import { sandboxAgent } from "./agents/sandbox";
import { searcher } from "./agents/searcher";
import { v1Agent } from "./agents/v1-agent";
import { visionAgent } from "./agents/vision";
import { voiceAgent } from "./agents/voice";
import { createEnvironmentStorage } from "./lib/memory-factory";

// Log all environment variables for debugging
console.log("=== Mastra Environment Variables ===");
console.log("NODE_ENV:", env.NODE_ENV);
console.log("VERCEL:", env.VERCEL);
console.log("VERCEL_ENV:", env.VERCEL_ENV);
console.log("DATABASE_URL:", env.DATABASE_URL ? "Set" : "Not set");
console.log("ANTHROPIC_API_KEY:", env.ANTHROPIC_API_KEY ? "Set" : "Not set");
console.log("EXA_API_KEY:", env.EXA_API_KEY ? "Set" : "Not set");
console.log("OPENAI_API_KEY:", env.OPENAI_API_KEY ? "Set" : "Not set");
console.log("BROWSERBASE_API_KEY:", env.BROWSERBASE_API_KEY ? "Set" : "Not set");
console.log("BROWSERBASE_PROJECT_ID:", env.BROWSERBASE_PROJECT_ID ? "Set" : "Not set");
console.log("OPENROUTER_API_KEY:", env.OPENROUTER_API_KEY ? "Set" : "Not set");
console.log("ELEVENLABS_API_KEY:", env.ELEVENLABS_API_KEY ? "Set" : "Not set");
console.log("BLOB_READ_WRITE_TOKEN:", env.BLOB_READ_WRITE_TOKEN ? "Set" : "Not set");
console.log("UPSTASH_REDIS_REST_URL:", env.UPSTASH_REDIS_REST_URL ? "Set" : "Not set");
console.log("UPSTASH_REDIS_REST_TOKEN:", env.UPSTASH_REDIS_REST_TOKEN ? "Set" : "Not set");
console.log("===================================");

// Environment-aware storage configuration
// This will automatically use Upstash for production/Vercel deployments
// and LibSQL for development/testing
const storage = createEnvironmentStorage();

export const mastra = new Mastra({
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
		ChatAgent: chatAgent,
	},
	aiSdkCompat: "v4",
});
