import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
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

// Create LibSQL storage instance
const storage = new LibSQLStore({
	url: "file:./mastra.db", // Local SQLite file for development
});

export const mastra = new Mastra({
	storage, // This will be used by all Memory instances in agents
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
});
