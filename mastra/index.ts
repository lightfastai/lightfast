import { Mastra } from "@mastra/core";
import { planner } from "./agents/planner";
import { searcher } from "./agents/searcher";
import { taskPlannerWorkflow } from "./workflows/task-planner-workflow";

export const mastra = new Mastra({
	agents: {
		planner,
		searcher,
	},
	workflows: {
		taskPlannerWorkflow,
	},
	vnext_networks: {},
});
