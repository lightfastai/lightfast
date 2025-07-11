import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { commandPlanner } from "./agents/command-planner";
import { contextAwareSandboxAgent } from "./agents/context-aware-sandbox";
import { planner } from "./agents/planner";
import { repoAnalyzer } from "./agents/repo-analyzer";
import { repoCloner } from "./agents/repo-cloner";
import { sandboxExecutor } from "./agents/sandbox-executor";
import { searcher } from "./agents/searcher";
import { e2bRunnerNetwork } from "./networks/e2b-runner";
import { exampleNetwork } from "./networks/example";
import { generalSandboxExecutorNetwork } from "./networks/general-sandbox-executor";
import { iterativeSandboxExplorerNetwork } from "./networks/iterative-sandbox-explorer";
import { repoInvestigatorNetwork } from "./networks/repo-investigator";
import { unifiedResearcherNetwork } from "./networks/unified-researcher";
import { e2bRunnerWorkflow } from "./workflows/e2b-runner-workflow";
import { generalSandboxWorkflow } from "./workflows/general-sandbox-workflow";
import { iterativeExplorationWorkflow } from "./workflows/iterative-exploration-workflow";
import { repoInvestigatorWorkflow } from "./workflows/repo-investigator-workflow";
import { taskPlannerWorkflow } from "./workflows/task-planner-workflow";

// Create LibSQL storage instance
const storage = new LibSQLStore({
	url: "file:./mastra.db", // Local SQLite file for development
});

export const mastra = new Mastra({
	storage, // This will be used by all Memory instances in agents
	agents: {
		planner,
		searcher,
		commandPlanner,
		sandboxExecutor,
		repoCloner,
		repoAnalyzer,
		contextAwareSandboxAgent,
	},
	workflows: {
		taskPlannerWorkflow,
		e2bRunnerWorkflow,
		repoInvestigatorWorkflow,
		generalSandboxWorkflow,
		iterativeExplorationWorkflow,
	},
	vnext_networks: {
		exampleNetwork,
		unifiedResearcherNetwork,
		e2bRunnerNetwork,
		repoInvestigatorNetwork,
		generalSandboxExecutorNetwork,
		iterativeSandboxExplorerNetwork,
	},
});
