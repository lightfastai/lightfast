import { Mastra } from "@mastra/core";
import { env } from "../env";
import { artifactAgent } from "./agents/standalone/artifact";
import { browserAgent } from "./agents/standalone/browser";
import { chatAgent } from "./agents/pure/chat";
import { downloadAgent } from "./agents/standalone/download";
import { mathAgent } from "./agents/standalone/math";
import { planner } from "./agents/standalone/planner";
import { sandboxAgent } from "./agents/standalone/sandbox";
import { searcher } from "./agents/standalone/searcher";
import { v010 } from "./agents/experimental/v010";
import { v011 } from "./agents/experimental/v011";
import { visionAgent } from "./agents/standalone/vision";
import { voiceAgent } from "./agents/standalone/voice";
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
		V010: v010,
		V011: v011,
		ChatAgent: chatAgent,
	},
	storage: storage,
	aiSdkCompat: "v4",
});
