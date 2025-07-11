import { Mastra } from "@mastra/core";
import { commandPlanner } from "./agents/command-planner";
import { planner } from "./agents/planner";
import { sandboxExecutor } from "./agents/sandbox-executor";
import { searcher } from "./agents/searcher";
import { e2bRunnerNetwork } from "./networks/e2b-runner";
import { exampleNetwork } from "./networks/example";
import { unifiedResearcherNetwork } from "./networks/unified-researcher";
import { e2bRunnerWorkflow } from "./workflows/e2b-runner-workflow";
import { taskPlannerWorkflow } from "./workflows/task-planner-workflow";

export const mastra = new Mastra({
	agents: {
		planner,
		searcher,
		commandPlanner,
		sandboxExecutor,
	},
	workflows: {
		taskPlannerWorkflow,
		e2bRunnerWorkflow,
	},
	vnext_networks: {
		exampleNetwork,
		unifiedResearcherNetwork,
		e2bRunnerNetwork,
	},
});
