/**
 * Server-side provider for @lightfast/ai
 *
 * This file exports all AI functionality including browser tools
 * and is intended for server-side use only. It should never be
 * imported by client-side code to avoid bundling issues.
 */

import { Mastra } from "@mastra/core";

// Experimental agents - Latest versions under active development
import { a010 } from "./agents/experimental/a010";
import { a011 } from "./agents/experimental/a011";

// Pure agents - General purpose conversational agents
import { c010 } from "./agents/pure/c010";

// Standalone agents - Specialized single-purpose agents
import { artifactAgent } from "./agents/standalone/artifact";
import { planner } from "./agents/standalone/planner";
import { sandboxAgent } from "./agents/standalone/sandbox";
import { searcher } from "./agents/standalone/searcher";
import { visionAgent } from "./agents/standalone/vision";
import { voiceAgent } from "./agents/standalone/voice";

// Export the server-side Mastra instance with standard agents
// Browser tools are temporarily excluded to avoid bundling issues
export const mastraServer: Mastra = new Mastra({
	agents: {
		// Experimental Agents - Latest experimental versions
		a010: a010,
		a011: a011, // Standard version without browser tools for now

		// Pure Agents - General purpose
		c010: c010,

		// Standalone Agents - Specialized tools
		artifact: artifactAgent,
		// browser: browserAgent, // Temporarily disabled for bundling fix
		planner: planner,
		sandbox: sandboxAgent,
		searcher: searcher,
		vision: visionAgent,
		voice: voiceAgent,
	},
	aiSdkCompat: "v4",
});

// Also export as 'mastra' for backward compatibility
export const mastra: Mastra = mastraServer;
