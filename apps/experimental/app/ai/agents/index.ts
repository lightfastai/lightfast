import { gateway } from "@ai-sdk/gateway";
import { Agent } from "@lightfast/ai/agent";
import { smoothStream, stepCountIs } from "ai";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";
import { A011_SYSTEM_PROMPT, type A011Tools, createA011Tools } from "./a011";

/**
 * Creates all available agents
 */
export function createAgents() {
	return [
		new Agent<LightfastUIMessage, A011Tools>({
			name: "a011",
			system: A011_SYSTEM_PROMPT,
			tools: createA011Tools,
			model: gateway("anthropic/claude-4-sonnet"),
			experimental_transform: smoothStream({
				delayInMs: 25,
				chunking: "word",
			}),
			stopWhen: stepCountIs(30),
		}),
		// Future agents can be added here
		// new Agent({
		//   name: "vision",
		//   system: VISION_SYSTEM_PROMPT,
		//   tools: createVisionTools,
		//   model: gateway("anthropic/claude-4-vision"),
		//   ...
		// }),
	];
}

/**
 * Get the list of available agent names
 */
export function getAvailableAgents(): string[] {
	return ["a011"]; // Add more agent names as they are created
}
