/**
 * Basic Lightfast setup example
 * This is what a typical src/lightfast/index.ts would look like
 */

import { Lightfast, createAgent } from "lightfast";
import { anthropic } from "@ai-sdk/anthropic";

// Define your agent
const someAgent = createAgent({
	name: "my-assistant",
	system: "You are a helpful AI assistant",
	model: anthropic("claude-3-5-sonnet-20241022"),
});

// Create and export the Lightfast instance
const lightfast = new Lightfast({
	agents: { 
		someAgent 
	}
});

export default lightfast;