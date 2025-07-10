import { Mastra } from "@mastra/core";
import { taskExecutorAgent } from "./agents/simple-task-agent";

export const mastra = new Mastra({
	agents: {
		taskExecutorAgent,
	},
});
