import { openrouter, models } from "../lib/openrouter";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { z } from "zod";
import { browserActTool, browserExtractTool, browserObserveTool } from "../tools/browser-tools";

// Schema for browser working memory
const browserMemorySchema = z.object({
	sessionActive: z.boolean().default(false),
	currentUrl: z.string().nullable().default(null),
	pageHistory: z
		.array(
			z.object({
				url: z.string(),
				timestamp: z.string(),
				action: z.string(),
			}),
		)
		.default([]),
	extractedData: z.record(z.any()).default({}),
});

export const browserAgent = new Agent({
	name: "Browser",
	description: "Automates browser tasks using Stagehand with AI capabilities",
	// 	instructions: `You are a browser automation agent that uses Stagehand to perform web tasks.

	// ## How to Work

	// 1. **First Time Only - Create Browser Session**:
	//    - Create a new Stagehand browser session using create_browser_session
	//    - Store the sessionId in your working memory
	//    - This session will be reused for all subsequent actions

	// 2. **Execute Browser Actions**:
	//    - Use execute_browser_action with the sessionId from memory
	//    - Available actions:
	//      - navigate: Go to a URL
	//      - act: Use AI to perform actions (click, type, etc.)
	//      - extract: Extract structured data from the page
	//      - observe: Get observations about the page
	//      - screenshot: Take screenshots
	//      - evaluate: Run JavaScript
	//    - Track page history in memory

	// 3. **For Complex Tasks**:
	//    - First create an AI agent using create_browser_agent
	//    - Then use execute_browser_agent_task for multi-step operations
	//    - The agent can handle complex workflows autonomously

	// 4. **Memory Management**:
	//    - sessionId: Set once when creating browser
	//    - currentUrl: Track current page
	//    - pageHistory: Track visited pages
	//    - extractedData: Store extracted information
	//    - screenshots: Store screenshot references
	//    - agentConfigured: Track if AI agent is set up

	// ## First Step - ALWAYS
	// If sessionId is not in your memory:
	// 1. Use create_browser_session tool to create a new browser
	// 2. Store the returned sessionId in your working memory
	// 3. Use this ID for all subsequent browser actions

	// ## Example Tasks:
	// - Web scraping with data extraction
	// - Form filling and submission
	// - Navigation and interaction flows
	// - Screenshot capture for documentation
	// - Automated testing scenarios`,
	instructions: `You are a helpful web assistant that can navigate websites and extract information.

      Your primary functions are:
      - Navigate to websites
      - Observe elements on webpages
      - Perform actions like clicking buttons or filling forms
      - Extract data from webpages

      When responding:
      - Ask for a specific URL if none is provided
      - Be specific about what actions to perform
      - When extracting data, be clear about what information you need

      Use the stagehandActTool to perform actions on webpages.
      Use the stagehandObserveTool to find elements on webpages.
`,
	model: openrouter(models.claude4Sonnet),
	memory: new Memory({
		options: {
			workingMemory: {
				enabled: true,
				scope: "thread",
				schema: browserMemorySchema,
			},
			lastMessages: 20,
		},
	}),
	tools: {
		browserActTool,
		browserObserveTool,
		browserExtractTool,
	},
	defaultGenerateOptions: {
		maxSteps: 25,
		maxRetries: 3,
		maxTokens: 20000,
	},
	defaultStreamOptions: {
		maxSteps: 40,
		maxRetries: 3,
		maxTokens: 20000,
		onChunk: ({ chunk }) => {
			console.log(chunk);
		},
		onFinish: (res) => {
			console.log(res);
		},
	},
});
