import { NewAgentNetwork } from "@mastra/core/network/vNext";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
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
import {
	createSandboxTool,
	createSandboxWithPortsTool,
	executeSandboxCommandTool,
	getSandboxDomainTool,
	listSandboxRoutesTool,
} from "../tools/sandbox-tools";
import { saveCriticalInfoTool } from "../tools/save-critical-info";
import { webSearchTool } from "../tools/web-search-tools";

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
- **createSandboxWithPorts**: Create sandbox with exposed ports for web applications
- **executeSandboxCommand**: Execute shell commands in sandbox with full output
- **getSandboxDomain**: Get public URL for exposed sandbox ports
- **listSandboxRoutes**: List all exposed ports and their public URLs
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
		createSandboxWithPorts: createSandboxWithPortsTool,
		executeSandboxCommand: executeSandboxCommandTool,
		getSandboxDomain: getSandboxDomainTool,
		listSandboxRoutes: listSandboxRoutesTool,
	},
	memory: networkMemory,
});
