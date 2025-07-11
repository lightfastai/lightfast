import { Mastra } from "@mastra/core";
import { commandPlanner } from "./agents/command-planner";
import { planner } from "./agents/planner";
import { repoAnalyzer } from "./agents/repo-analyzer";
import { repoCloner } from "./agents/repo-cloner";
import { sandboxExecutor } from "./agents/sandbox-executor";
import { searcher } from "./agents/searcher";
import { e2bRunnerNetwork } from "./networks/e2b-runner";
import { exampleNetwork } from "./networks/example";
import { generalSandboxExecutorNetwork } from "./networks/general-sandbox-executor";
import { repoInvestigatorNetwork } from "./networks/repo-investigator";
import { unifiedResearcherNetwork } from "./networks/unified-researcher";
import { e2bRunnerWorkflow } from "./workflows/e2b-runner-workflow";
import { generalSandboxWorkflow } from "./workflows/general-sandbox-workflow";
import { repoInvestigatorWorkflow } from "./workflows/repo-investigator-workflow";
import { taskPlannerWorkflow } from "./workflows/task-planner-workflow";

export const mastra = new Mastra({
	agents: {
		planner,
		searcher,
		commandPlanner,
		sandboxExecutor,
		repoCloner,
		repoAnalyzer,
	},
	workflows: {
		taskPlannerWorkflow,
		e2bRunnerWorkflow,
		repoInvestigatorWorkflow,
		generalSandboxWorkflow,
	},
	vnext_networks: {
		exampleNetwork,
		unifiedResearcherNetwork,
		e2bRunnerNetwork,
		repoInvestigatorNetwork,
		generalSandboxExecutorNetwork,
	},
});
