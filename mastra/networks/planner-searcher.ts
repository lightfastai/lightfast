import { NewAgentNetwork } from "@mastra/core/network/vNext";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { z } from "zod";
import { browserAgent } from "../agents/browser";
import { planner } from "../agents/planner";
import { searcher } from "../agents/searcher";
import { models, openrouter } from "../lib/openrouter";


// Create shared memory for the network
const networkMemory = new Memory({
	storage: new LibSQLStore({
		url: "file:./mastra.db",
	}),
	options: {
		workingMemory: {
			enabled: true,
			scope: "thread",
		},
		lastMessages: 50,
	},
});

// No custom routing needed - NewAgentNetwork handles this automatically

export const plannerSearcherNetwork = new NewAgentNetwork({
	id: "planner-searcher-network",
	name: "Planner Searcher Browser Network",
	instructions: `You are an intelligent network that can handle planning, web search, and browser automation tasks.

You can:
- Create detailed plans and todo lists for any task
- Search the web for current, relevant information
- Automate web interactions, data extraction, and form filling

Choose the most appropriate agent based on the user's specific needs. Always aim to provide comprehensive, helpful responses.`,
	model: openrouter(models.claude4Sonnet),
	agents: {
		planner,
		searcher,
		browser: browserAgent,
	},
	memory: networkMemory,
});
