import { Agent } from "@mastra/core/agent";
import { anthropic, anthropicModels } from "@/lib/ai/provider";
import { browserExtractTool, browserNavigateTool, browserObserveTool } from "../../tools/browser-tools";
import { granularBrowserTools } from "../../tools/browser-tools-granular";

// Note: Working memory schemas moved to network level for proper context handling

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
      - Navigate to websites using browserNavigate
      - View current page content with browserView
      - Click elements using browserClick
      - Type text into inputs using browserType
      - Select dropdown options using browserSelectOption
      - Scroll pages using browserScroll
      - Press keyboard keys using browserPressKey
      - Wait for page elements using browserWait
      - Take screenshots using browserScreenshot
      - Execute JavaScript using browserConsoleExec
      - Extract structured data using browserExtract
      - Observe page elements using browserObserve

      When responding:
      - Ask for a specific URL if none is provided
      - Use browserView to check current page state
      - Be specific about what actions to perform
      - Chain actions logically for complex workflows
      - When extracting data, be clear about what information you need
      - Use browserWait to handle dynamic content
`,
	model: anthropic(anthropicModels.claude4Sonnet),
	// Note: Memory is handled at network level when used in networks
	// Individual agent memory can cause context conflicts in network execution
	tools: {
		// Granular browser tools
		browserNavigate: browserNavigateTool,
		browserView: granularBrowserTools.browserView,
		browserClick: granularBrowserTools.browserClick,
		browserType: granularBrowserTools.browserType,
		browserSelectOption: granularBrowserTools.browserSelectOption,
		browserScroll: granularBrowserTools.browserScroll,
		browserPressKey: granularBrowserTools.browserPressKey,
		browserMoveMouse: granularBrowserTools.browserMoveMouse,
		browserWait: granularBrowserTools.browserWait,
		browserScreenshot: granularBrowserTools.browserScreenshot,
		browserConsoleExec: granularBrowserTools.browserConsoleExec,
		browserReload: granularBrowserTools.browserReload,
		browserHistory: granularBrowserTools.browserHistory,
		// Higher-level browser tools
		browserObserve: browserObserveTool,
		browserExtract: browserExtractTool,
	},
	defaultGenerateOptions: {
		maxSteps: 25,
		maxRetries: 3,
	},
	defaultStreamOptions: {
		maxSteps: 40,
		maxRetries: 3,
		onChunk: ({ chunk }) => {
			console.log(`[Browser] Chunk:`, chunk);
		},
		onError: ({ error }) => {
			console.error(`[Browser] Stream error:`, error);
		},
		onStepFinish: (step) => {
			if (step.toolResults) {
				step.toolResults.forEach((result, index) => {
					if (
						result.type === "tool-result" &&
						result.output &&
						typeof result.output === "object" &&
						"error" in result.output
					) {
						console.error(`[Browser] Tool ${index} error:`, result.output.error);
					}
				});
			}
			console.log(`[Browser] Step completed`);
		},
		onFinish: (result) => {
			console.log(`[Browser] Generation finished:`, result);
		},
	},
});
