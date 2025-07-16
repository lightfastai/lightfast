import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { browserAgent } from "./agents/browser";
import { downloadAgent } from "./agents/download";
import { mathAgent } from "./agents/math";
import { planner } from "./agents/planner";
import { sandboxAgent } from "./agents/sandbox";
import { searcher } from "./agents/searcher";
import { visionAgent } from "./agents/vision";
import { voiceAgent } from "./agents/voice";
import { adaptiveExecutorNetwork } from "./networks/adaptive-executor";
import { exampleNetwork } from "./networks/example";
import { plannerSearcherNetwork } from "./networks/planner-searcher";
import { unifiedExecutorNetwork } from "./networks/unified-executor";
import { unifiedResearcherNetwork } from "./networks/unified-researcher";

// Create LibSQL storage instance
const storage = new LibSQLStore({
	url: "file:./mastra.db", // Local SQLite file for development
});

export const mastra = new Mastra({
	storage, // This will be used by all Memory instances in agents
	agents: {
		Planner: planner,
		Searcher: searcher,
		Sandbox: sandboxAgent,
		Browser: browserAgent,
		Download: downloadAgent,
		Math: mathAgent,
		Vision: visionAgent,
		Voice: voiceAgent,
	},
	workflows: {},
	vnext_networks: {
		exampleNetwork,
		unifiedResearcherNetwork,
		unifiedExecutorNetwork,
		adaptiveExecutorNetwork,
		plannerSearcherNetwork,
	},
});
