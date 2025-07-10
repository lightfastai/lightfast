import { anthropic } from "@ai-sdk/anthropic";
import { NewAgentNetwork } from "@mastra/core/network/vNext";
import { executorAgent } from "../agents/executor-agent";
import { plannerAgent } from "../agents/planner-agent";
import { synthesizerAgent } from "../agents/synthesizer-agent";

// For now, we'll create a simple network structure that can be used with Mastra
// This follows the pattern of agents working together
export const taskPlannerNetwork = new NewAgentNetwork({
	id: "task-planner-network",
	name: "Task Planner Network",
	instructions: "Multi-agent network that plans and executes tasks",
	agents: {
		plannerAgent,
		executorAgent,
		synthesizerAgent,
	},
	model: anthropic("claude-4-sonnet-20250514"),
	// The network execution logic is embedded in the agents themselves
	// They work together through the helper functions:
	// 1. generateTaskPlan (from planner)
	// 2. executeStep (from executor)
	// 3. synthesizeResults (from synthesizer)
});
