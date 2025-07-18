import { Agent } from "@mastra/core/agent";
import { anthropic, anthropicModels } from "../lib/anthropic";

export const chatAgent = new Agent({
	name: "ChatAgent",
	description: "A simple conversational agent without tools for general chat interactions",
	instructions: `
You are Claude, an AI assistant created by Anthropic. You communicate clearly and concisely, 
providing thoughtful responses to user queries.

Key guidelines:
- Be conversational and friendly
- Provide accurate and helpful information
- Ask clarifying questions when needed
- Admit when you don't know something
- Keep responses focused and relevant
`,
	model: anthropic(anthropicModels.claude4Sonnet),
	tools: {}, // No tools for this agent
	defaultGenerateOptions: {
		maxSteps: 1, // Single response, no tool calls
		maxRetries: 3,
	},
	defaultStreamOptions: {
		// maxSteps: 1, // Single response, no tool calls
		maxRetries: 3,
		onError: ({ error }) => {
			console.error(`[ChatAgent] Stream error:`, error);
		},
		onStepFinish: ({ text }) => {
			console.log(`[ChatAgent] Step completed`);
		},
		onFinish: (result) => {
			console.log(`[ChatAgent] Generation finished`);
		},
	},
});
