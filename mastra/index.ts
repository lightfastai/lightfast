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
import { v1_1Agent } from "./agents/v1-1-agent";
import { visionAgent } from "./agents/vision";
import { voiceAgent } from "./agents/voice";
import { createEnvironmentStorage } from "./lib/memory-factory";

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
		V1_1Agent: v1_1Agent,
		ChatAgent: chatAgent,
	},
	storage: storage,
	aiSdkCompat: "v4",
});
