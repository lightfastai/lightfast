import { Agent } from "@mastra/core/agent";
import { smoothStream } from "ai";
import { z } from "zod";
import { anthropic, anthropicModels } from "@/lib/ai/provider";
import { createEnvironmentMemory } from "../../lib/memory-factory";
import { browserExtractTool, browserNavigateTool } from "../../tools/browser-tools";
import { fileWriteTool } from "../../tools/file-tools";
import { taskExecutorTool } from "../../tools/task-executor";
import { webSearchTool } from "../../tools/web-search-tools";

// Schema for tool execution tracking
const toolExecutionSchema = z.object({
	toolName: z.string().describe("Name of the tool executed"),
	executedAt: z.string().describe("ISO timestamp when tool was executed"),
	success: z.boolean().describe("Whether the tool execution succeeded"),
	resultSummary: z.string().optional().describe("Brief summary of the tool result"),
});

// Enhanced schema for task-led workflow in a011 agent
const taskLedWorkingMemorySchema = z.object({
	tasks: z
		.array(
			z.object({
				id: z.string().describe("Unique task identifier (e.g., TASK-001)"),
				description: z.string().describe("Clear description of what needs to be done"),
				status: z.enum(["pending", "active", "completed", "failed"]).describe("Current status of the task"),
				priority: z.enum(["high", "medium", "low"]).describe("Task priority level"),
				requiredTools: z.array(z.string()).describe("List of tools needed for this task"),
				toolCalls: z.array(toolExecutionSchema).default([]).describe("Track tool executions for this task"),
				dependencies: z.array(z.string()).default([]).describe("Task IDs that must complete before this one"),
				notes: z.string().optional().describe("Additional context or progress notes"),
				createdAt: z.string().describe("ISO timestamp when task was created"),
				startedAt: z.string().optional().describe("ISO timestamp when task execution started"),
				completedAt: z.string().optional().describe("ISO timestamp when task was completed"),
			}),
		)
		.default([]),
	currentTaskId: z.string().optional().describe("ID of the currently active task"),
	summary: z.string().describe("Overall progress summary or context"),
	lastUpdated: z.string().describe("ISO timestamp of last update"),
});

export type TaskLedWorkingMemory = z.infer<typeof taskLedWorkingMemorySchema>;

// Helper function to create a new task
export function createTask(params: {
	id: string;
	description: string;
	requiredTools: string[];
	dependencies?: string[];
	priority?: "high" | "medium" | "low";
}): TaskLedWorkingMemory["tasks"][0] {
	return {
		id: params.id,
		description: params.description,
		status: "pending",
		priority: params.priority || "medium",
		requiredTools: params.requiredTools,
		toolCalls: [],
		dependencies: params.dependencies || [],
		createdAt: new Date().toISOString(),
	};
}

// Create task-led memory for a011 Agent
const agentMemory = createEnvironmentMemory({
	prefix: "mastra:a011-agent:",
	workingMemorySchema: taskLedWorkingMemorySchema,
	workingMemoryDefault: {
		tasks: [],
		currentTaskId: undefined,
		summary: "No tasks yet. Ready for task-led execution.",
		lastUpdated: new Date().toISOString(),
	},
	lastMessages: 50,
});

export const a011 = new Agent({
	name: "a011",
	description: "Task-led workflow agent that decomposes requests into tasks and links tool calls to specific tasks",
	instructions: `
You are Lightfast Experimental a011 agent - a task-led workflow specialist.

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
			console.log(`[a011] Step completed`);
			if (toolCalls && toolCalls.length > 0) {
				toolCalls.forEach((call) => {
					console.log(`[a011] Tool called: ${call.toolName}`);
				});
			}
		},
		onFinish: (result) => {
			console.log(`[a011] Generation finished`);
		},
	},
});
