import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { browserAgent } from "./agents/browser";
import { planner } from "./agents/planner";
import { sandboxAgent } from "./agents/sandbox";
import { searcher } from "./agents/searcher";
import { adaptiveExecutorNetwork } from "./networks/adaptive-executor";
import { exampleNetwork } from "./networks/example";
import { unifiedExecutorNetwork } from "./networks/unified-executor";
import { unifiedResearcherNetwork } from "./networks/unified-researcher";

// Create LibSQL storage instance
const storage = new LibSQLStore({
	url: "file:./mastra.db", // Local SQLite file for development
});

export const mastra = new Mastra({
	storage, // This will be used by all Memory instances in agents
	agents: {
		planner,
		searcher,
		sandboxAgent,
		browserbaseAgent: browserAgent,
	},
	workflows: {},
	vnext_networks: {
		exampleNetwork,
		unifiedResearcherNetwork,
		unifiedExecutorNetwork,
		adaptiveExecutorNetwork,
	},
});
