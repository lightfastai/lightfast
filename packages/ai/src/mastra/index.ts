import { Mastra } from "@mastra/core";

// Experimental agents - Latest versions under active development
import { a010 } from "./agents/experimental/a010";
import { a011 } from "./agents/experimental/a011";

// Pure agents - General purpose conversational agents
import { c010 } from "./agents/pure/c010";

// Standalone agents - Specialized single-purpose agents
import { artifactAgent } from "./agents/standalone/artifact";
// Temporarily disabled browser agent to fix playwright client-side bundling
// import { browserAgent } from "./agents/standalone/browser";
// Download agent removed - use browser or file tools instead
// import { downloadAgent } from "./agents/standalone/download";
import { planner } from "./agents/standalone/planner";
import { sandboxAgent } from "./agents/standalone/sandbox";
import { searcher } from "./agents/standalone/searcher";
import { visionAgent } from "./agents/standalone/vision";
import { voiceAgent } from "./agents/standalone/voice";

export const mastra = new Mastra({
	agents: {
		// Experimental Agents - Latest experimental versions
		a010: a010,
		a011: a011,

		// Pure Agents - General purpose
		c010: c010,

		// Standalone Agents - Specialized tools
		artifact: artifactAgent,
		// browser: browserAgent, // Temporarily disabled for playwright bundling fix
		// download: downloadAgent, // Removed - use browser or file tools instead
		planner: planner,
		sandbox: sandboxAgent,
		searcher: searcher,
		vision: visionAgent,
		voice: voiceAgent,
	},
	aiSdkCompat: "v4",
});
