import { NewAgentNetwork } from "@mastra/core/network/vNext";
// Import web search tool from searcher agent
import { createTool } from "@mastra/core/tools";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import Exa, { type RegularSearchOptions, type SearchResponse } from "exa-js";
import { z } from "zod";
import { env } from "../../env";
import { models, openrouter } from "../lib/openrouter";
import { browserActTool, browserExtractTool, browserNavigateTool, browserObserveTool } from "../tools/browser-tools";
import {
	downloadDirectFileTool,
	downloadFileTool,
	downloadImageTool,
	listDownloadsTool,
} from "../tools/download-tools";
// Import tools directly instead of agents
import {
	fileDeleteTool,
	fileFindByNameTool,
	fileFindInContentTool,
	fileReadTool,
	fileStringReplaceTool,
	fileWriteTool,
} from "../tools/file-tools";
import { saveCriticalInfoTool } from "../tools/save-critical-info";
import { createSandboxTool, executeSandboxCommandTool } from "../tools/sandbox-tools";

const webSearchTool = createTool({
	id: "web_search",
	description: "Advanced web search with optimized content retrieval using Exa",
	inputSchema: z.object({
		query: z.string().describe("The search query"),
		useAutoprompt: z.boolean().default(true).describe("Whether to enhance the query automatically"),
		numResults: z.number().min(1).max(10).default(5).describe("Number of results to return"),
		contentType: z
			.enum(["highlights", "summary", "text"])
			.default("highlights")
			.describe("Type of content to retrieve: highlights (excerpts), summary (AI-generated), or text (full)"),
	}),
	outputSchema: z.object({
		results: z.array(
			z.object({
				title: z.string(),
				url: z.string(),
				content: z.string().describe("The retrieved content based on contentType"),
				contentType: z.enum(["highlights", "summary", "text"]),
				score: z.number().optional(),
			}),
		),
		query: z.string(),
		tokensEstimate: z.number().describe("Estimated tokens used for content retrieval"),
	}),
	execute: async ({ context }) => {
		try {
			const exa = new Exa(env.EXA_API_KEY);
			const baseOptions: RegularSearchOptions = {
				useAutoprompt: context.useAutoprompt,
				numResults: context.numResults,
				type: "auto",
			};

			let response: any;
			switch (context.contentType) {
				case "highlights":
					response = await exa.searchAndContents(context.query, { ...baseOptions, highlights: true });
					break;
				case "summary":
					response = await exa.searchAndContents(context.query, { ...baseOptions, summary: { query: context.query } });
					break;
				case "text":
					response = await exa.searchAndContents(context.query, { ...baseOptions, text: { maxCharacters: 2000 } });
					break;
			}

			let totalCharacters = 0;
			const results = response.results.map((result: any) => {
				let content = "";
				if (context.contentType === "highlights" && "highlights" in result) {
					content = result.highlights.join(" ... ");
				} else if (context.contentType === "summary" && "summary" in result) {
					content = result.summary;
				} else if ("text" in result) {
					content = result.text;
				}

				totalCharacters += content.length;
				return {
					title: result.title || "Untitled",
					url: result.url,
					content,
					contentType: context.contentType,
					score: result.score || undefined,
				};
			});

			return {
				results,
				query: context.query,
				tokensEstimate: Math.ceil(totalCharacters / 4),
			};
		} catch (error) {
			console.error("Web search error:", error);
			throw new Error(`Search failed: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	},
});

// Create shared memory for the network
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
- Task format: [TASK-ID] Description (Priority: high/medium/low)
- Update this list as you work through multi-step tasks
- Tools available: fileWrite, fileRead, searchWeb, browserAction, download, saveCriticalInfo
`,
		},
		lastMessages: 50,
	},
});

export const v11Network = new NewAgentNetwork({
	id: "v1-1-network",
	name: "V1.1 Tool-Based Network",
	instructions: `You are an intelligent network that can handle planning, web search, browser automation, visual analysis, and file management tasks using tools directly.

## CRITICAL APPROACH:

1. **DIRECT TOOL USAGE**: Instead of delegating to agents, you have direct access to all tools:
   - **fileWrite/fileRead/fileDelete**: For persistent file storage and organization
   - **searchWeb**: For web research and current information
   - **browserAction**: For web automation, scraping, and interactions
   - **download**: For downloading files and resources
   - **saveCriticalInfo**: For saving important strategic information

2. **TASK PLANNING**: For any complex task:
   - Break it down into clear steps
   - Use the working memory task list to track progress
   - Execute steps sequentially using appropriate tools
   - Update progress as you complete each step

3. **FILE ORGANIZATION**: 
   - Use descriptive filenames with timestamps when appropriate
   - The system automatically organizes files by thread/conversation
   - Save analysis results, research findings, and important data

4. **WORKFLOW PATTERNS**:
   - Research → Analysis → Documentation → Storage
   - Planning → Execution → Validation → Reporting
   - Data Collection → Processing → Export → Archive

## TOOL CAPABILITIES:
- **fileWrite**: Save content to files (markdown, JSON, text, etc.)
- **fileRead**: Retrieve previously saved files
- **fileDelete**: Clean up unnecessary files
- **fileStringReplace**: Replace specific text in files with new content
- **fileFindInContent**: Search for regex patterns within file content
- **fileFindByName**: Find files by glob patterns (limited by blob storage)
- **webSearch**: Web search for current information using Exa
- **browserAct**: Perform browser actions (click, type, interact)
- **browserExtract**: Extract structured data from web pages
- **browserObserve**: Observe and analyze web page elements
- **browserNavigate**: Navigate to URLs and handle page loading
- **downloadFile**: Download files from web pages using browser actions
- **downloadDirectFile**: Download files directly from URLs  
- **downloadImage**: Download images using right-click save
- **listDownloads**: List files downloaded in current session
- **createSandbox**: Create isolated Vercel sandbox environments (Node.js/Python)
- **executeSandboxCommand**: Execute shell commands in sandbox with full output
- **saveCriticalInfo**: Store strategic decisions and key insights

## ADVANTAGES OF DIRECT TOOL USAGE:
- ThreadId context preserved for proper file organization
- No delegation overhead between agents
- Direct control over tool execution
- Simplified debugging and error handling
- Consistent execution context

Remember: You now have direct access to all capabilities without needing to route through specialized agents. Use tools efficiently and maintain clear task tracking.`,
	model: openrouter(models.claude4Sonnet),
	// No agents - using tools directly
	agents: {},
	tools: {
		fileWrite: fileWriteTool,
		fileRead: fileReadTool,
		fileDelete: fileDeleteTool,
		fileStringReplace: fileStringReplaceTool,
		fileFindInContent: fileFindInContentTool,
		fileFindByName: fileFindByNameTool,
		saveCriticalInfo: saveCriticalInfoTool,
		webSearch: webSearchTool,
		browserAct: browserActTool,
		browserExtract: browserExtractTool,
		browserObserve: browserObserveTool,
		browserNavigate: browserNavigateTool,
		downloadFile: downloadFileTool,
		downloadDirectFile: downloadDirectFileTool,
		downloadImage: downloadImageTool,
		listDownloads: listDownloadsTool,
		createSandbox: createSandboxTool,
		executeSandboxCommand: executeSandboxCommandTool,
	},
	memory: networkMemory,
});
