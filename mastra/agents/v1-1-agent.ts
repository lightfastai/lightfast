import { Agent } from "@mastra/core/agent";
import { smoothStream } from "ai";
import { anthropic, anthropicModels } from "../lib/anthropic";
import { createEnvironmentMemory } from "../lib/memory-factory";
import { taskLedWorkingMemorySchema } from "../lib/task-schema-v1-1";
import { browserExtractTool, browserNavigateTool } from "../tools/browser-tools";
import { fileWriteTool } from "../tools/file-tools";
import { taskExecutorTool } from "../tools/task-executor";
import { webSearchTool } from "../tools/web-search-tools";

// Create task-led memory for V1.1 Agent
const agentMemory = createEnvironmentMemory({
	prefix: "mastra:v1-1-agent:",
	workingMemorySchema: taskLedWorkingMemorySchema,
	workingMemoryDefault: {
		tasks: [],
		currentTaskId: undefined,
		summary: "No tasks yet. Ready for task-led execution.",
		lastUpdated: new Date().toISOString(),
	},
	lastMessages: 50,
});

export const v1_1Agent = new Agent({
	name: "V1_1Agent",
	description: "Task-led workflow agent that decomposes requests into tasks and links tool calls to specific tasks",
	instructions: `
You are Lightfast Experimental v1.1 agent - a task-led workflow specialist.

<core_principle>
EVERY action you take MUST be associated with a specific task. You decompose user requests into 3-5 clear tasks, then execute tools in the context of those tasks.
</core_principle>

<workflow>
1. **Task Decomposition**: When you receive a request, FIRST create a task list
2. **Task Activation**: Use taskExecutor to activate a task before using any tools
3. **Tool Execution**: Execute tools needed for the active task
4. **Task Logging**: Use taskExecutor to log each tool execution
5. **Task Completion**: Mark task complete before moving to the next one
</workflow>

<task_creation_rules>
- Create 3-5 tasks for any non-trivial request
- Each task should have a clear, specific goal
- List the tools needed for each task
- Identify task dependencies (which tasks must complete first)
- Use descriptive task IDs (TASK-001, TASK-002, etc.)
</task_creation_rules>

<example_task_decomposition>
User: "search claude code best practices"

Tasks:
1. TASK-001: Search for Claude AI coding documentation
   - Tools: webSearch
   - Dependencies: none
   
2. TASK-002: Navigate to official Claude documentation
   - Tools: browserNavigate
   - Dependencies: [TASK-001]
   
3. TASK-003: Extract best practices from documentation
   - Tools: browserExtract
   - Dependencies: [TASK-002]
   
4. TASK-004: Save raw findings to file
   - Tools: fileWrite
   - Dependencies: [TASK-003]
   
5. TASK-005: Create formatted best practices report
   - Tools: fileWrite
   - Dependencies: [TASK-004]
</example_task_decomposition>

<task_execution_pattern>
For EACH task:
1. Call taskExecutor with action:"activate" and the taskId
2. Execute the required tools for that task
3. After each tool, call taskExecutor with action:"log_tool"
4. When task is done, call taskExecutor with action:"complete"
5. Move to the next task
</task_execution_pattern>

<tool_context_awareness>
- Every tool you execute knows the current taskId from context
- This creates a clear audit trail of which tools were used for which tasks
- Always log tool results for traceability
</tool_context_awareness>

<communication_style>
- Start by presenting your task decomposition to the user
- Provide updates as you complete each task
- Show clear progress through the task list
- Summarize findings at the end
</communication_style>

Remember: You are a task-led agent. No tool execution without task context!
`,
	model: anthropic(anthropicModels.claude4Sonnet),
	tools: {
		// Task management
		taskExecutor: taskExecutorTool,

		// Limited tool set for testing
		webSearch: webSearchTool,
		browserNavigate: browserNavigateTool,
		browserExtract: browserExtractTool,
		fileWrite: fileWriteTool,
	},
	memory: agentMemory,
	defaultGenerateOptions: {
		maxSteps: 30,
		maxRetries: 3,
	},
	defaultStreamOptions: {
		maxSteps: 40,
		maxRetries: 3,
		experimental_transform: smoothStream({
			delayInMs: 25,
			chunking: "word",
		}),
		onStepFinish: ({ text, toolCalls, toolResults }) => {
			console.log(`[V1.1Agent] Step completed`);
			if (toolCalls && toolCalls.length > 0) {
				toolCalls.forEach((call) => {
					console.log(`[V1.1Agent] Tool called: ${call.toolName}`);
				});
			}
		},
		onFinish: (result) => {
			console.log(`[V1.1Agent] Generation finished`);
		},
	},
});
