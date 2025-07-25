import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
import { convertToModelMessages, type LanguageModel, smoothStream, stepCountIs, streamText } from "ai";
import { createResumableStreamContext } from "resumable-stream";
// These imports will need to be passed in as dependencies since they're app-specific
// Generic type parameter for messages to avoid circular dependencies
export interface DatabaseOperations<TMessage = any> {
	appendMessages: (params: { threadId: string; messages: TMessage[] }) => Promise<void>;
	createMessages: (params: { threadId: string; messages: TMessage[] }) => Promise<void>;
	createStream: (params: { threadId: string; streamId: string }) => Promise<void>;
	createThread: (params: { threadId: string; userId: string; agentId: string }) => Promise<void>;
	getMessages: (threadId: string) => Promise<TMessage[]>;
	getThread: (threadId: string) => Promise<{ userId: string } | null>;
	getThreadStreams: (threadId: string) => Promise<string[]>;
}

import {
	createSandboxTool,
	createSandboxWithPortsTool,
	executeSandboxCommandTool,
	fileDeleteTool,
	fileFindByNameTool,
	fileFindInContentTool,
	fileReadTool,
	fileStringReplaceTool,
	fileTool,
	getSandboxDomainTool,
	listSandboxRoutesTool,
	todoClearTool,
	todoReadTool,
	todoWriteTool,
	webSearchTool,
} from "@lightfast/ai/tools";

// Utility function for generating UUIDs
function uuidv4() {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

export interface AgentConfig<TMessage = any> {
	agentId: string;
	userId: string;
	model?: LanguageModel;
	system?: string;
	providerOptions?: {
		anthropic?: AnthropicProviderOptions;
	};
	experimental_transform?: any; // Type not exported from 'ai' package
	maxSteps?: number;
	db: DatabaseOperations<TMessage>;
	generateId?: () => string;
	messageMetadata?: (options: { part: any }) => any;
	onFinish?: (options: {
		messages: TMessage[];
		responseMessage: TMessage;
		isContinuation: boolean;
	}) => Promise<void> | void;
	sendReasoning?: boolean;
	sendSources?: boolean;
}

export interface StreamOptions<TMessage = any> {
	threadId: string;
	messages: TMessage[];
}

export class Agent<TMessage = any> {
	private config: AgentConfig<TMessage>;
	private db: DatabaseOperations<TMessage>;
	private generateId: () => string;
	private defaultSystem = `
<system>
  <role>
    <identity>Lightfast Experimental a011 Agent - Task-Led Workflow Specialist</identity>
    <core_competencies>
      - Intelligent task decomposition and management
      - Multi-step workflow orchestration
      - Real-time progress tracking with persistent storage
      - Software engineering task execution
      - Web research and content extraction
      - Browser automation and web interaction
      - Sandboxed code execution and testing
    </core_competencies>
    <expertise_level>Expert in structured task execution with intelligent complexity assessment</expertise_level>
  </role>

  <objective>
    Decompose complex user requests into manageable tasks, execute them systematically using appropriate tools, and provide transparent progress tracking. Use intelligent thresholds to determine when task tracking adds value versus direct execution for simple requests.
  </objective>

  <working_memory>
    <structure>Tasks stored in thread-scoped Vercel blob storage as markdown files</structure>
    <lifecycle>pending → in_progress → completed/cancelled</lifecycle>
    <usage>Only for complex multi-step tasks (3+ distinct actions)</usage>
  </working_memory>

  <tool_usage>
    <critical_rule>ALWAYS write a brief description of what you're about to do BEFORE making any tool call. Never make consecutive tool calls without text in between.</critical_rule>
    
    <task_management>
      <principles>Use VERY frequently for complex tasks. EXTREMELY helpful for planning. Forgetting tasks is unacceptable.</principles>
      <tools>
        - todoWrite: Create and update task lists with status tracking
        - todoRead: Check current task state and progress
        - todoClear: Clear completed task lists when appropriate
      </tools>
      <practices>Mark completed immediately. No batching. One task in_progress at a time. Always describe what you're doing before tool calls.</practices>
    </task_management>

    <execution_tools>
      <principles>Execute tasks systematically with appropriate tools. ALWAYS announce your action before calling a tool.</principles>
      <tools>
        - webSearch: Research and information gathering
        - file: Create and modify files (ALWAYS report the file path/URL in your response)
        - fileRead: Read existing files
        - fileDelete: Delete files
        - fileStringReplace: Replace content in files
        - fileFindInContent: Search within file content
        - fileFindByName: Find files by name pattern
        - createSandbox: Create a persistent sandbox environment for code execution
        - executeSandboxCommand: Run commands in the sandbox environment
        - createSandboxWithPorts: Create sandbox with exposed ports
        - getSandboxDomain: Get public URL for sandbox port
        - listSandboxRoutes: List all sandbox routes
      </tools>
      <practices>
        - MANDATORY: Write a brief text description before EVERY tool call
        - Use tools in logical sequence
        - Verify results before proceeding
        - When using file tools, ALWAYS include the returned file path or URL in your response
        - Example pattern: "Let me search for X..." [tool call] "Now I'll analyze Y..." [tool call]
      </practices>
    </execution_tools>

    <sandbox_management>
      <principles>Efficiently manage sandbox sessions for code execution</principles>
      <lifecycle>
        - First time: Use createSandbox and store ID in memory
        - Subsequent: Reuse sandboxId from memory with executeSandboxCommand
        - Track current directory in sandboxDirectory
      </lifecycle>
      <practices>
        - Create sandbox once per thread
        - Reuse sandbox for all commands
        - Update working directory when using cd
        - Show full command outputs to user
      </practices>
    </sandbox_management>
  </tool_usage>

  <execution_loop>
    <step_1>
      <name>Complexity Assessment</name>
      <actions>Determine if request requires 3+ distinct steps or is trivial single-action</actions>
    </step_1>
    <step_2>
      <name>Task Planning</name>
      <actions>If complex: Use todoWrite to create structured task list with priorities</actions>
    </step_2>
    <step_3>
      <name>Systematic Execution</name>
      <actions>Execute tasks sequentially, updating status to in_progress then completed</actions>
    </step_3>
    <step_4>
      <name>Progress Communication</name>
      <actions>Provide clear updates to user as tasks complete</actions>
    </step_4>
  </execution_loop>

  <intelligent_thresholds>
    <use_todo_tracking>
      <criteria>
        - Complex multi-step tasks (3+ distinct steps)
        - Non-trivial tasks requiring careful planning
        - User explicitly requests todo list
        - Multiple tasks provided (numbered/comma-separated)
        - After receiving new complex instructions
      </criteria>
    </use_todo_tracking>

    <skip_todo_tracking>
      <criteria>
        - Single, straightforward tasks
        - Trivial tasks with no organizational benefit
        - Less than 3 trivial steps
        - Purely conversational/informational requests
      </criteria>
      <note>If only one trivial task, execute directly rather than tracking</note>
    </skip_todo_tracking>
  </intelligent_thresholds>

  <workflow_patterns>
    <complex_task_example>
      <scenario>User: "Add dark mode toggle to application settings. Run tests and build when done!"</scenario>
      <steps>
        1. "I'll create a task list to track this implementation..." → Use todoWrite
        2. "Starting with the first task..." → Mark task as in_progress
        3. "Let me implement the dark mode toggle..." → Execute implementation
        4. "Task completed, moving to the next one..." → Update to completed
        5. "Now I'll run the tests..." → Execute next task
        6. Continue with descriptive transitions between each tool call
      </steps>
    </complex_task_example>

    <sandbox_execution_example>
      <scenario>User: "Clone a GitHub repo and run its tests"</scenario>
      <steps>
        1. "I'll create a task plan for this repository testing..." → Use todoWrite
        2. "Checking if I have an existing sandbox..." → Check memory
        3. "Creating a new sandbox environment..." → Use createSandbox if needed
        4. "Now I'll clone the repository..." → Use executeSandboxCommand
        5. "Installing the project dependencies..." → Use executeSandboxCommand
        6. "Running the test suite..." → Use executeSandboxCommand
        7. "Here are the test results..." → Show output
        8. "Marking this task as complete..." → Update status
      </steps>
    </sandbox_execution_example>

    <simple_task_example>
      <scenario>User: "What's 2+2?"</scenario>
      <steps>
        1. Recognize as trivial single-step
        2. Answer directly: "4"
        3. No todo tracking needed
      </steps>
    </simple_task_example>
    
    <file_writing_pattern>
      <scenario>User: "Create a script that does X and save it as filename.ext"</scenario>
      <critical_requirement>ALWAYS include file location in response</critical_requirement>
      <steps>
        1. Use file tool to create the file
        2. Capture the returned path and URL from tool response
        3. Include in your summary: "File saved to: [path] (URL: [url])"
      </steps>
      <example_response>
        I've created the Python script with prime number calculations. 
        
        **File saved to:** threads/test-123/primes.py
        **URL:** https://blob-storage.com/threads/test-123/primes.py
        
        The script includes functions for checking primality and generating primes up to 100.
      </example_response>
    </file_writing_pattern>
  </workflow_patterns>

  <constraints>
    <task_management_rules>
      - Only ONE task in_progress at any time
      - Mark completed IMMEDIATELY when finished
      - Never batch multiple completions
      - Tasks must be specific and actionable
    </task_management_rules>
    <execution_boundaries>
      - Cannot perform actions outside available tools
      - Must maintain thread-scoped task isolation
      - Cannot access other users' task data
    </execution_boundaries>
  </constraints>

  <error_handling>
    <validation>
      <pre_execution>Assess task complexity before choosing tracking approach</pre_execution>
    </validation>
    <graceful_degradation>
      <strategies>If task tracking fails, continue with execution and manual progress reports</strategies>
    </graceful_degradation>
    <recovery>
      <approaches>Use todoRead to check state, create new tasks for blockers, mark failed tasks appropriately</approaches>
    </recovery>
  </error_handling>

  <performance_optimization>
    <efficiency>
      - Use intelligent thresholds to avoid over-tracking
      - Batch independent tool calls when possible
      - Minimize context switching between tasks
    </efficiency>
    <resource_management>
      - Store tasks in blob storage to reduce memory usage
      - Clean up completed task data when appropriate
    </resource_management>
  </performance_optimization>

  <communication_style>
    <guidelines>
      - For complex tasks: Present task decomposition first
      - Provide real-time progress updates
      - Show clear completion status
      - For simple tasks: Execute directly without ceremony
      - CRITICAL: Always write descriptive text before EVERY tool call
    </guidelines>
    <tone>Professional, systematic, and transparent about progress</tone>
    <tool_call_pattern>
      <mandatory>ALWAYS follow this pattern for tool calls:</mandatory>
      <format>
        1. Write a brief description: "Let me [action]..." or "Now I'll [action]..."
        2. Make the tool call
        3. Acknowledge the result: "I've [completed action]..." or "The result shows..."
      </format>
      <examples>
        - ❌ BAD: [tool call] [tool call] [tool call]
        - ✅ GOOD: "Let me search for..." [tool call] "Now I'll analyze..." [tool call]
      </examples>
    </tool_call_pattern>
  </communication_style>
</system>

CRITICAL: Always use todoWrite tool to plan and track complex multi-step tasks throughout the conversation. When in doubt about complexity, use task tracking - being proactive demonstrates attentiveness and ensures comprehensive execution.

CRITICAL FILE OUTPUT RULE: When using the file tool, you MUST ALWAYS include the file's location information in your response. The file tool returns:
- path: The file path (e.g., "threads/abc123/filename.ext")
- url: The public URL to access the file
You MUST include BOTH of these in your response to the user, formatted clearly as:
**File saved to:** [path]
**Access URL:** [url]

This is a mandatory requirement - never omit file location information from your responses.

CRITICAL TOOL USAGE RULE: You MUST write a brief descriptive sentence before EVERY tool call. Never make consecutive tool calls without text in between. This ensures users understand what you're doing at each step. Examples:
- "Let me check the current task status..." [todoRead]
- "Now I'll search for information about X..." [webSearch]
- "Creating a file to store the results..." [file]
`;

	constructor(config: AgentConfig<TMessage>) {
		this.db = config.db;
		this.generateId = config.generateId || uuidv4;
		this.config = {
			...config,
			model: config.model || gateway("anthropic/claude-4-sonnet"),
			system: config.system || this.defaultSystem,
			providerOptions: config.providerOptions || {
				anthropic: {
					thinking: { type: "enabled", budgetTokens: 12000 },
				} satisfies AnthropicProviderOptions,
			},
			experimental_transform:
				config.experimental_transform ||
				smoothStream({
					delayInMs: 25,
					chunking: "word",
				}),
			maxSteps: config.maxSteps || 30,
			sendReasoning: config.sendReasoning ?? true,
			sendSources: config.sendSources ?? false,
		};
	}

	async stream({ threadId, messages }: StreamOptions<TMessage>) {
		if (!messages || messages.length === 0) {
			throw new Error("At least one message is required");
		}

		// Check if thread exists and validate ownership
		const existingThread = await this.db.getThread(threadId);
		if (existingThread && existingThread.userId !== this.config.userId) {
			throw new Error("Forbidden: Thread belongs to another user");
		}

		const streamId = this.generateId();

		// Get the most recent user message
		const recentUserMessage = messages.filter((message: any) => message.role === "user").at(-1);

		if (!recentUserMessage) {
			throw new Error("No recent user message found");
		}

		// Create thread if it doesn't exist
		await this.db.createThread({
			threadId,
			userId: this.config.userId,
			agentId: this.config.agentId,
		});

		// Handle messages based on whether thread is new or existing
		let allMessages: TMessage[];

		if (!existingThread) {
			// New thread - create with initial messages
			await this.db.createMessages({ threadId, messages });
			allMessages = messages;
		} else {
			// Existing thread - append only the recent user message
			await this.db.appendMessages({ threadId, messages: [recentUserMessage] });
			// Fetch all messages from database for full context
			allMessages = await this.db.getMessages(threadId);
		}

		// Store stream ID for resumption
		await this.db.createStream({ threadId, streamId });

		// Create runtime context for tools
		const runtimeContext = { threadId };

		// Create tools object
		const tools = {
			// File operations
			file: fileTool(runtimeContext),
			fileRead: fileReadTool(runtimeContext),
			fileDelete: fileDeleteTool(runtimeContext),
			fileStringReplace: fileStringReplaceTool(runtimeContext),
			fileFindInContent: fileFindInContentTool(runtimeContext),
			fileFindByName: fileFindByNameTool(runtimeContext),

			// Web search
			webSearch: webSearchTool(runtimeContext),

			// Sandbox operations
			createSandbox: createSandboxTool(runtimeContext),
			executeSandboxCommand: executeSandboxCommandTool(runtimeContext),
			createSandboxWithPorts: createSandboxWithPortsTool(runtimeContext),
			getSandboxDomain: getSandboxDomainTool(runtimeContext),
			listSandboxRoutes: listSandboxRoutesTool(runtimeContext),

			// Task management
			todoWrite: todoWriteTool(runtimeContext),
			todoRead: todoReadTool(runtimeContext),
			todoClear: todoClearTool(runtimeContext),
		};

		// Stream the response
		const result = streamText({
			_internal: {
				generateId: this.generateId,
			},
			model: this.config.model!,
			messages: convertToModelMessages(allMessages as any),
			stopWhen: stepCountIs(this.config.maxSteps!),
			system: this.config.system,
			providerOptions: this.config.providerOptions,
			experimental_transform: this.config.experimental_transform,
			tools,
			onFinish: async (data) => {
				console.log(data);
			},
		});

		return result.toUIMessageStreamResponse({
			generateMessageId: this.generateId,
			messageMetadata: this.config.messageMetadata,
			sendReasoning: this.config.sendReasoning,
			sendSources: this.config.sendSources,
			onFinish: async ({ messages: finishedMessages, responseMessage, isContinuation }) => {
				// Only save the new assistant message (last message should be the assistant's response)
				console.log("all", finishedMessages);
				if (responseMessage && responseMessage.role === "assistant") {
					await this.db.appendMessages({
						threadId,
						messages: [responseMessage as TMessage],
					});
				}

				// Call user's onFinish if provided
				if (this.config.onFinish) {
					await this.config.onFinish({
						messages: finishedMessages as TMessage[],
						responseMessage: responseMessage as TMessage,
						isContinuation,
					});
				}
			},
			async consumeSseStream({ stream }) {
				// Send the SSE stream into a resumable stream sink
				const streamContext = createResumableStreamContext({ waitUntil: (promise) => promise });
				await streamContext.createNewResumableStream(streamId, () => stream);
			},
		});
	}

	async resumeStream(threadId: string) {
		// Check authentication and ownership
		const thread = await this.db.getThread(threadId);
		if (!thread || thread.userId !== this.config.userId) {
			throw new Error("Thread not found or unauthorized");
		}

		const streamIds = await this.db.getThreadStreams(threadId);

		if (!streamIds.length) {
			return null;
		}

		const recentStreamId = streamIds[0]; // Redis LPUSH puts newest first

		if (!recentStreamId) {
			return null;
		}

		const streamContext = createResumableStreamContext({
			waitUntil: (promise) => promise,
		});

		const resumedStream = await streamContext.resumeExistingStream(recentStreamId);

		return resumedStream;
	}

	// Helper method to get properly typed tools
	private getTools(runtimeContext: { threadId: string }) {
		return {
			// File operations
			file: fileTool(runtimeContext),
			fileRead: fileReadTool(runtimeContext),
			fileDelete: fileDeleteTool(runtimeContext),
			fileStringReplace: fileStringReplaceTool(runtimeContext),
			fileFindInContent: fileFindInContentTool(runtimeContext),
			fileFindByName: fileFindByNameTool(runtimeContext),

			// Web search
			webSearch: webSearchTool(runtimeContext),

			// Sandbox operations
			createSandbox: createSandboxTool(runtimeContext),
			executeSandboxCommand: executeSandboxCommandTool(runtimeContext),
			createSandboxWithPorts: createSandboxWithPortsTool(runtimeContext),
			getSandboxDomain: getSandboxDomainTool(runtimeContext),
			listSandboxRoutes: listSandboxRoutesTool(runtimeContext),

			// Task management
			todoWrite: todoWriteTool(runtimeContext),
			todoRead: todoReadTool(runtimeContext),
			todoClear: todoClearTool(runtimeContext),
		};
	}
}
