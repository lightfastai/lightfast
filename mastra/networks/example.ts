import { anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core/agent";
import { NewAgentNetwork } from "@mastra/core/network/vNext";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

const agentStep1 = createStep({
	id: "agent-step",
	description: "This step is used to do research and text synthesis.",
	inputSchema: z.object({
		city: z.string().describe("The city to research"),
	}),
	outputSchema: z.object({
		text: z.string(),
	}),
	execute: async ({ inputData }) => {
		const resp = await agent1.generate(inputData.city, {
			output: z.object({
				text: z.string(),
			}),
		});

		return { text: resp.object.text };
	},
});

const agentStep2 = createStep({
	id: "agent-step-two",
	description: "This step is used to do research and text synthesis.",
	inputSchema: z.object({
		text: z.string().describe("The city to research"),
	}),
	outputSchema: z.object({
		text: z.string(),
	}),
	execute: async ({ inputData }) => {
		const resp = await agent2.generate(inputData.text, {
			output: z.object({
				text: z.string(),
			}),
		});

		return { text: resp.object.text };
	},
});

const workflow1 = createWorkflow({
	id: "workflow1",
	description:
		"This workflow is perfect for researching a specific city. It should be used when you have a city in mind to research.",
	steps: [],
	inputSchema: z.object({
		city: z.string(),
	}),
	outputSchema: z.object({
		text: z.string(),
	}),
})
	.then(agentStep1)
	.then(agentStep2)
	.commit();

const agent1 = new Agent({
	name: "agent1",
	instructions:
		"This agent is used to do research, but not create full responses. Answer in bullet points only and be concise.",
	description:
		"This agent is used to do research, but not create full responses. Answer in bullet points only and be concise.",
	model: anthropic("claude-4-sonnet-20250514"),
});

const agent2 = new Agent({
	name: "agent2",
	description:
		"This agent is used to do text synthesis on researched material. Write a full report based on the researched material. Writes reports in full paragraphs. Should be used to synthesize text from different sources together as a final report.",
	instructions:
		"This agent is used to do text synthesis on researched material. Write a full report based on the researched material. Do not use bullet points. Write full paragraphs. There should not be a single bullet point in the final report.",
	model: anthropic("claude-4-sonnet-20250514"),
});

export const exampleNetwork = new NewAgentNetwork({
	id: "test-network",
	name: "Test Network",
	instructions:
		"You are a network of writers and researchers. The user will ask you to research a topic. You always need to answer with a full report. Bullet points are NOT a full report. WRITE FULL PARAGRAPHS like this is a blog post or something similar. You should not rely on partial information.",
	model: anthropic("claude-4-sonnet-20250514"),
	agents: {
		agent1,
		agent2,
	},
	workflows: {
		workflow1,
	},
});

// const runtimeContext = new RuntimeContext();

// console.log(
// 	// specifying the task, note that there is a mention here about using an agent for synthesis. This is because the routing agent can actually do some synthesis on results on its own, so this will force it to use agent2 instead
// 	await exampleNetwork.loop(
// 		"What are the biggest cities in France? Give me 3. How are they like? Find cities, then do thorough research on each city, and give me a final full report synthesizing all that information. Make sure to use an agent for synthesis.",
// 		{ runtimeContext },
// 	),
// );
