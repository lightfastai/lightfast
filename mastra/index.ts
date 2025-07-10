import { Mastra } from "@mastra/core";
import { taskExecutorAgent } from "./agents/simple-task-agent";
import {
	environmentSetupAgent,
	executionAgent,
	scriptGeneratorAgent,
	taskAnalyzerAgent,
} from "./agents/task-executor-agents";

export const mastra = new Mastra({
	agents: {
		taskExecutorAgent,
		taskAnalyzerAgent,
		environmentSetupAgent,
		scriptGeneratorAgent,
		executionAgent,
	},
});
