import { type AnthropicProviderOptions, anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core/agent";
import { smoothStream } from "ai";
import { gatewayModels } from "../../../lib/ai/provider";

export const c010 = new Agent({
	name: "c010",
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
	model: gatewayModels.claude4Sonnet,
	tools: {}, // No tools for this agent
	defaultGenerateOptions: {
		maxSteps: 1, // Single response, no tool calls
		maxRetries: 3,
		providerOptions: {
			anthropic: {
				thinking: { type: "enabled", budgetTokens: 12000 },
			} satisfies AnthropicProviderOptions,
		},
	},
	defaultStreamOptions: {
		// maxSteps: 1, // Single response, no tool calls
		maxRetries: 3,
		experimental_transform: smoothStream({
			// Faster delay for more responsive chat
			delayInMs: 15,
			// Chunk by word for natural conversation
			chunking: "word",
		}),
		onError: ({ error }) => {
			console.error(`[c010] Stream error:`, error);
		},
		onStepFinish: (_step) => {
			console.log(`[c010] Step completed`);
		},
		onFinish: (_result) => {
			console.log(`[c010] Generation finished`);
		},
	},
});
