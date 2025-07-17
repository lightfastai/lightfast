import { NewAgentNetwork } from "@mastra/core/network/vNext";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { artifactAgent } from "../agents/artifact";
import { browserAgent } from "../agents/browser";
import { planner } from "../agents/planner";
import { searcher } from "../agents/searcher";
import { visionAgent } from "../agents/vision";
import { models, openrouter } from "../lib/openrouter";

// Create shared memory for the network with todo tracking template
const networkMemory = new Memory({
	storage: new LibSQLStore({
		url: "file:./mastra.db",
	}),
	options: {
		workingMemory: {
			enabled: true,
			scope: "thread",
			template: `
# Network Task List

## Active Tasks
- None yet

## In Progress
- None yet

## Completed Tasks
- None yet

## Notes
- Task format: [TASK-ID] Description (Agent: agent-name, Priority: high/medium/low)
- Update this list as you work through multi-step tasks
- Each agent should check this list and update their progress
`,
		},
		lastMessages: 50,
	},
});

export const v1Network = new NewAgentNetwork({
	id: "v1-network",
	name: "V1 Multi-Agent Network",
	instructions: `You are an intelligent network that can handle planning, web search, browser automation, and visual analysis tasks.

## CRITICAL ROUTING RULES:

1. **ALWAYS START WITH PLANNER**: For ANY new task or request, you MUST call the Planner agent first.
   - The Planner will analyze the task and create a structured plan
   - The Planner will populate the task list in working memory
   - NO other agent should be called before the Planner has created the initial plan

2. **FOLLOW THE PLAN**: After the Planner creates the task list:
   - Execute tasks in the order specified by the Planner
   - Use the appropriate agent for each task:
     - **Searcher**: For web research and current information
     - **Browser**: For web automation, scraping, and downloads
     - **Vision**: For image analysis and visual tasks
   
3. **UPDATE PROGRESS**: Each agent must:
   - Check the task list when starting work
   - Update their assigned tasks to "in progress"
   - Mark tasks as completed when done
   - Add new subtasks if discovered

## AGENT CAPABILITIES:
- **Planner**: Strategic task decomposition and todo list management (MUST BE CALLED FIRST)
- **Searcher**: Web search and information retrieval
- **Browser**: Web automation, data extraction, and downloads
- **Vision**: Image analysis and visual content understanding
- **Artifact**: File management and persistent storage

## ENFORCEMENT:
If any agent is called before the Planner, immediately stop and call the Planner first.
The only exception is if the user explicitly says "skip planning" or "no planning needed".

Remember: Planner → Task List → Execute with appropriate agents → Update progress`,
	model: openrouter(models.claude4Sonnet),
	agents: {
		planner,
		searcher,
		browser: browserAgent,
		vision: visionAgent,
		artifact: artifactAgent,
	},
	memory: networkMemory,
});
