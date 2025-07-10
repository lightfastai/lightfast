import { Mastra } from "@mastra/core";
import { executorAgent } from "./agents/executor-agent";
import { plannerAgent } from "./agents/planner-agent";
import { taskExecutorAgent } from "./agents/simple-task-agent";
import { synthesizerAgent } from "./agents/synthesizer-agent";
import {
	environmentSetupAgent,
	executionAgent,
	scriptGeneratorAgent,
	taskAnalyzerAgent,
} from "./agents/task-executor-agents";
import { taskPlannerNetwork } from "./networks/task-planner-network";
import { taskExecutorWorkflow } from "./workflows/task-executor-workflow";

export const mastra = new Mastra({
	agents: {
		// Original agents
		taskExecutorAgent,
		taskAnalyzerAgent,
		environmentSetupAgent,
		scriptGeneratorAgent,
		executionAgent,
		// Network agents
		plannerAgent,
		executorAgent,
		synthesizerAgent,
	},
	workflows: {
		taskExecutorWorkflow,
	},
	vnext_networks: {
		taskPlannerNetwork,
	},
});

// Export everything
export { taskExecutorWorkflow };
export { cleanupExecutorSandbox, executeStep, executorAgent } from "./agents/executor-agent";
export { generateTaskPlan, plannerAgent } from "./agents/planner-agent";
export { synthesizeResults, synthesizerAgent } from "./agents/synthesizer-agent";
