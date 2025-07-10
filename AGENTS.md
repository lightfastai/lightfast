# AGENTS.md - Mastra Best Practices Guide

This guide provides comprehensive best practices for creating agents, workflows, and networks with Mastra, enforcing strict TypeScript typing and following project conventions.

## Table of Contents

- [Core Principles](#core-principles)
- [Project Structure](#project-structure)
- [Agents](#agents)
- [Tools](#tools)
- [Workflows](#workflows)
- [Networks](#networks)
- [Memory](#memory)
- [Voice](#voice)
- [Type Safety](#type-safety)
- [Error Handling](#error-handling)
- [Performance](#performance)

## Core Principles

### 1. Strict TypeScript
- **NO `any` types** - Always use proper typing with Zod schemas
- Use `z.infer<>` for type inference from Zod schemas
- Prefer explicit return types for functions
- Use strict null checks and proper error handling

### 2. Code Formatting (Biome)
- Use tabs for indentation (width: 2)
- Double quotes for strings
- Trailing commas everywhere
- Semicolons always required
- Line width: 120 characters

### 3. Import Convention
- **NEVER create index.ts files** for re-importing/re-exporting
- Always use direct imports to specific files
- This improves tree-shaking, reduces bundle size, and makes dependencies explicit

```typescript
// ❌ Wrong - NO index.ts files for re-exports
import { bugAnalysisAgent } from "@/lib/agent-kit/agents";

// ✅ Correct - Direct imports to specific files
import { bugAnalysisAgent } from "@/lib/agent-kit/agents/bug-analysis-agent";
```

```typescript
// ❌ Wrong - Don't create index.ts files like this
// src/mastra/agents/index.ts
export { taskAnalyzerAgent } from "./task-analyzer-agent";
export { environmentSetupAgent } from "./environment-setup-agent";

// ❌ Wrong - Don't import from index files
import { taskAnalyzerAgent, environmentSetupAgent } from "@/mastra/agents";

// ✅ Correct - Import directly from source files
import { taskAnalyzerAgent } from "@/mastra/agents/task-analyzer-agent";
import { environmentSetupAgent } from "@/mastra/agents/environment-setup-agent";
```

## Project Structure

```
src/
├── mastra/
│   ├── agents/
│   │   ├── task-analyzer-agent.ts
│   │   ├── environment-setup-agent.ts
│   │   └── script-generator-agent.ts
│   ├── tools/
│   │   ├── sandbox-executor-tool.ts
│   │   ├── file-operations-tool.ts
│   │   └── system-commands-tool.ts
│   ├── workflows/
│   │   ├── task-execution-workflow.ts
│   │   └── code-generation-workflow.ts
│   ├── networks/
│   │   └── task-executor-network.ts
│   └── index.ts
```

## Agents

### Basic Agent Structure

```typescript
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { RuntimeContext } from "@mastra/core/runtime-context";

// Define input/output schemas
const TaskAnalysisInputSchema = z.object({
	task: z.string().describe("The task to analyze"),
	context: z.string().optional().describe("Additional context"),
});

const TaskAnalysisOutputSchema = z.object({
	analysis: z.string().describe("Detailed task analysis"),
	requirements: z.array(z.string()).describe("List of requirements"),
	complexity: z.enum(["low", "medium", "high"]).describe("Task complexity"),
});

export const taskAnalyzerAgent = new Agent({
	name: "TaskAnalyzer",
	description: "Analyzes computational tasks and breaks them down into actionable steps",
	instructions: `You are a task analysis expert. Your role is to:
1. Analyze the given task thoroughly
2. Identify all requirements and dependencies
3. Assess the complexity level
4. Provide clear, actionable insights

Always be precise and comprehensive in your analysis.`,
	model: openai("gpt-4o"),
	// Optional: Dynamic configuration based on runtime context
	tools: ({ runtimeContext }: { runtimeContext: RuntimeContext }) => {
		const userTier = runtimeContext.get("user-tier");
		return userTier === "premium" ? { advancedAnalysis: advancedAnalysisTool } : {};
	},
});

// Type-safe agent usage
export type TaskAnalysisInput = z.infer<typeof TaskAnalysisInputSchema>;
export type TaskAnalysisOutput = z.infer<typeof TaskAnalysisOutputSchema>;
```

### Agent with Memory

```typescript
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";

const memory = new Memory({
	storage: new LibSQLStore({
		url: "file:../memory.db",
	}),
});

export const conversationalAgent = new Agent({
	name: "ConversationalAssistant",
	description: "A helpful assistant that remembers previous conversations",
	instructions: "You are a helpful assistant with memory. Reference previous conversations when relevant.",
	model: openai("gpt-4o"),
	memory,
});

// Usage with memory
const response = await conversationalAgent.generate("What did we discuss last time?", {
	memory: {
		thread: "user-session-123",
		resource: "user-456",
		options: {
			lastMessages: 10,
			semanticRecall: {
				topK: 5,
				messageRange: { before: 5, after: 5 },
			},
		},
	},
});
```

### Agent with Voice

```typescript
import { OpenAIVoice } from "@mastra/voice-openai";
import { CompositeVoice } from "@mastra/core/voice";
import { ElevenLabsVoice } from "@mastra/voice-elevenlabs";

const voice = new CompositeVoice({
	input: new OpenAIVoice(), // For speech-to-text
	output: new ElevenLabsVoice({ // For text-to-speech
		apiKey: process.env.ELEVENLABS_API_KEY!,
	}),
});

export const voiceAgent = new Agent({
	name: "VoiceAssistant",
	description: "A voice-enabled assistant",
	instructions: "You are a helpful voice assistant. Keep responses conversational and natural.",
	model: openai("gpt-4o"),
	voice,
});
```

## Tools

### Tool Creation Best Practices

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// Define schemas first
const SandboxExecutionInputSchema = z.object({
	command: z.string().describe("The command to execute"),
	workingDirectory: z.string().optional().describe("Working directory path"),
	timeout: z.number().optional().default(30000).describe("Timeout in milliseconds"),
	environment: z.record(z.string()).optional().describe("Environment variables"),
});

const SandboxExecutionOutputSchema = z.object({
	stdout: z.string().describe("Standard output"),
	stderr: z.string().describe("Standard error"),
	exitCode: z.number().describe("Exit code"),
	executionTime: z.number().describe("Execution time in milliseconds"),
});

export const sandboxExecutorTool = createTool({
	id: "executeSandboxCommand",
	description: "Executes commands in a secure sandbox environment with proper error handling and timeout",
	inputSchema: SandboxExecutionInputSchema,
	outputSchema: SandboxExecutionOutputSchema,
	execute: async ({ context, threadId, resourceId, mastra }) => {
		const { command, workingDirectory = "/tmp", timeout = 30000, environment = {} } = context;
		
		try {
			// Validate command safety
			if (command.includes("rm -rf") || command.includes("sudo")) {
				throw new Error("Unsafe command detected");
			}

			const startTime = Date.now();
			
			// Execute command with timeout
			const result = await executeWithTimeout(command, {
				cwd: workingDirectory,
				env: { ...process.env, ...environment },
				timeout,
			});

			const executionTime = Date.now() - startTime;

			return {
				stdout: result.stdout,
				stderr: result.stderr,
				exitCode: result.exitCode,
				executionTime,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			return {
				stdout: "",
				stderr: errorMessage,
				exitCode: 1,
				executionTime: 0,
			};
		}
	},
});

// Helper function with proper typing
async function executeWithTimeout(
	command: string,
	options: { cwd: string; env: Record<string, string>; timeout: number }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	// Implementation here
	return { stdout: "", stderr: "", exitCode: 0 };
}

// Export types for reuse
export type SandboxExecutionInput = z.infer<typeof SandboxExecutionInputSchema>;
export type SandboxExecutionOutput = z.infer<typeof SandboxExecutionOutputSchema>;
```

### Tool with Runtime Context

```typescript
export const contextAwareTool = createTool({
	id: "contextAwareOperation",
	description: "Performs operations based on runtime context",
	inputSchema: z.object({
		operation: z.string().describe("Operation to perform"),
	}),
	outputSchema: z.object({
		result: z.string().describe("Operation result"),
		context: z.record(z.unknown()).describe("Context used"),
	}),
	execute: async ({ context, runtimeContext }) => {
		const userTier = runtimeContext?.get("user-tier") ?? "free";
		const apiKey = runtimeContext?.get("api-key");

		if (!apiKey) {
			throw new Error("API key required in runtime context");
		}

		// Perform operation based on user tier
		const result = userTier === "premium" 
			? await performPremiumOperation(context.operation, apiKey)
			: await performBasicOperation(context.operation, apiKey);

		return {
			result,
			context: { userTier, hasApiKey: Boolean(apiKey) },
		};
	},
});
```

## Workflows

### Basic Workflow Structure

```typescript
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

// Define workflow schemas
const TaskExecutionInputSchema = z.object({
	task: z.string().describe("Task description"),
	priority: z.enum(["low", "medium", "high"]).default("medium"),
});

const TaskExecutionOutputSchema = z.object({
	result: z.string().describe("Execution result"),
	steps: z.array(z.string()).describe("Steps taken"),
	success: z.boolean().describe("Whether task succeeded"),
});

// Create individual steps
const analyzeTaskStep = createStep({
	id: "analyze-task",
	description: "Analyze the incoming task",
	inputSchema: TaskExecutionInputSchema,
	outputSchema: z.object({
		analysis: z.string(),
		requirements: z.array(z.string()),
		estimatedTime: z.number(),
	}),
	execute: async ({ inputData, mastra }) => {
		const agent = mastra?.getAgent("taskAnalyzer");
		if (!agent) {
			throw new Error("Task analyzer agent not found");
		}

		const result = await agent.generate(`Analyze this task: ${inputData.task}`, {
			output: z.object({
				analysis: z.string(),
				requirements: z.array(z.string()),
				estimatedTime: z.number(),
			}),
		});

		return result.object;
	},
});

const setupEnvironmentStep = createStep({
	id: "setup-environment",
	description: "Set up the execution environment",
	inputSchema: z.object({
		requirements: z.array(z.string()),
	}),
	outputSchema: z.object({
		environmentReady: z.boolean(),
		setupCommands: z.array(z.string()),
	}),
	execute: async ({ inputData, mastra }) => {
		// Environment setup logic
		const setupCommands: string[] = [];
		
		for (const requirement of inputData.requirements) {
			if (requirement.includes("python")) {
				setupCommands.push("python3 --version");
			}
			if (requirement.includes("node")) {
				setupCommands.push("node --version");
			}
		}

		return {
			environmentReady: true,
			setupCommands,
		};
	},
});

const executeTaskStep = createStep({
	id: "execute-task",
	description: "Execute the main task",
	inputSchema: z.object({
		analysis: z.string(),
		environmentReady: z.boolean(),
		setupCommands: z.array(z.string()),
	}),
	outputSchema: TaskExecutionOutputSchema,
	execute: async ({ inputData, getInitData }) => {
		const initData = getInitData<typeof TaskExecutionInputSchema>();
		
		if (!inputData.environmentReady) {
			throw new Error("Environment not ready for execution");
		}

		// Execute the task
		const steps = [
			"Environment validated",
			"Task analyzed",
			"Execution started",
			"Task completed",
		];

		return {
			result: `Successfully executed: ${initData.task}`,
			steps,
			success: true,
		};
	},
});

// Create the workflow
export const taskExecutionWorkflow = createWorkflow({
	id: "task-execution",
	description: "Comprehensive task execution workflow",
	inputSchema: TaskExecutionInputSchema,
	outputSchema: TaskExecutionOutputSchema,
})
	.then(analyzeTaskStep)
	.map(({ inputData }) => ({
		requirements: inputData.requirements,
	}))
	.then(setupEnvironmentStep)
	.map(({ inputData, getStepResult }) => {
		const analysisResult = getStepResult(analyzeTaskStep);
		return {
			analysis: analysisResult.analysis,
			environmentReady: inputData.environmentReady,
			setupCommands: inputData.setupCommands,
		};
	})
	.then(executeTaskStep)
	.commit();

// Export types
export type TaskExecutionInput = z.infer<typeof TaskExecutionInputSchema>;
export type TaskExecutionOutput = z.infer<typeof TaskExecutionOutputSchema>;
```

### Workflow with Conditional Logic

```typescript
const conditionalWorkflow = createWorkflow({
	id: "conditional-execution",
	inputSchema: z.object({
		taskType: z.enum(["simple", "complex"]),
		data: z.string(),
	}),
	outputSchema: z.object({
		result: z.string(),
		path: z.string(),
	}),
})
	.branch([
		[
			async ({ inputData }) => inputData.taskType === "simple",
			simpleProcessingStep,
		],
		[
			async ({ inputData }) => inputData.taskType === "complex",
			complexProcessingStep,
		],
	])
	.commit();
```

### Workflow with Suspend/Resume

```typescript
const humanInLoopStep = createStep({
	id: "human-approval",
	description: "Wait for human approval",
	inputSchema: z.object({
		request: z.string(),
	}),
	outputSchema: z.object({
		approved: z.boolean(),
		feedback: z.string(),
	}),
	suspendSchema: z.object({
		requestId: z.string(),
		timestamp: z.number(),
	}),
	resumeSchema: z.object({
		approved: z.boolean(),
		feedback: z.string(),
	}),
	execute: async ({ inputData, resumeData, suspend }) => {
		if (!resumeData) {
			// First execution - suspend and wait for approval
			await suspend({
				requestId: `req_${Date.now()}`,
				timestamp: Date.now(),
			});
			return { approved: false, feedback: "" };
		}

		// Resumed with approval data
		return {
			approved: resumeData.approved,
			feedback: resumeData.feedback,
		};
	},
});

export const approvalWorkflow = createWorkflow({
	id: "approval-workflow",
	inputSchema: z.object({
		request: z.string(),
	}),
	outputSchema: z.object({
		approved: z.boolean(),
		feedback: z.string(),
	}),
})
	.then(humanInLoopStep)
	.commit();
```

## Networks

### Agent Network Structure

```typescript
import { NewAgentNetwork } from "@mastra/core/network/vNext";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";

const memory = new Memory({
	storage: new LibSQLStore({
		url: "file:../network-memory.db",
	}),
});

export const taskExecutorNetwork = new NewAgentNetwork({
	id: "task-executor-network",
	name: "Task Executor Network",
	instructions: `You are a network of specialized agents for executing computational tasks.
	
Available agents:
- Task Analyzer: Breaks down complex tasks into manageable steps
- Environment Setup: Prepares execution environments
- Script Generator: Creates executable scripts
- Execution Agent: Runs scripts and commands safely

Use the most appropriate agent(s) for each task. For complex tasks requiring multiple steps,
coordinate between agents to ensure proper execution flow.`,
	model: openai("gpt-4o"),
	agents: {
		taskAnalyzer: taskAnalyzerAgent,
		environmentSetup: environmentSetupAgent,
		scriptGenerator: scriptGeneratorAgent,
		executionAgent: executionAgent,
	},
	workflows: {
		taskExecution: taskExecutionWorkflow,
		codeGeneration: codeGenerationWorkflow,
	},
	memory,
});

// Usage examples
export async function executeComplexTask(task: string, runtimeContext: RuntimeContext): Promise<string> {
	// For complex multi-step tasks
	const result = await taskExecutorNetwork.loop(
		`Execute this complex task: ${task}. Break it down, set up the environment, generate any needed scripts, and execute them safely.`,
		{ runtimeContext }
	);
	return result;
}

export async function quickTaskExecution(task: string, runtimeContext: RuntimeContext): Promise<string> {
	// For simple single-step tasks
	const result = await taskExecutorNetwork.generate(
		`Execute this task: ${task}`,
		{ runtimeContext }
	);
	return result;
}
```

## Memory

### Memory Configuration

```typescript
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";

const memory = new Memory({
	storage: new LibSQLStore({
		url: process.env.DATABASE_URL || "file:../mastra-memory.db",
		authToken: process.env.DATABASE_AUTH_TOKEN,
	}),
});

// Memory usage in agents
export const memoryEnabledAgent = new Agent({
	name: "MemoryAgent",
	description: "Agent with comprehensive memory capabilities",
	instructions: "You remember all previous conversations and can reference them.",
	model: openai("gpt-4o"),
	memory,
});

// Advanced memory usage
const response = await memoryEnabledAgent.generate("What did we discuss about TypeScript?", {
	memory: {
		thread: { 
			id: "typescript-discussion",
			metadata: { topic: "programming", language: "typescript" },
			title: "TypeScript Best Practices Discussion"
		},
		resource: "user-123",
		options: {
			lastMessages: 20,
			semanticRecall: {
				topK: 10,
				messageRange: { before: 5, after: 5 },
			},
			workingMemory: {
				enabled: true,
				template: "Key points from our TypeScript discussion: {{summary}}",
			},
			threads: {
				generateTitle: {
					model: openai("gpt-4o-mini"), // Cost optimization
					instructions: "Generate a concise title for this programming discussion",
				},
			},
		},
	},
});
```

## Type Safety

### Strict Type Definitions

```typescript
// Define all schemas at the top level
export const UserInputSchema = z.object({
	userId: z.string().uuid(),
	query: z.string().min(1).max(1000),
	context: z.record(z.unknown()).optional(),
});

export const AgentResponseSchema = z.object({
	response: z.string(),
	confidence: z.number().min(0).max(1),
	sources: z.array(z.string()).optional(),
	metadata: z.record(z.unknown()).optional(),
});

// Use type inference
export type UserInput = z.infer<typeof UserInputSchema>;
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// Type-safe agent function
export async function processUserQuery(
	input: UserInput,
	agent: Agent
): Promise<AgentResponse> {
	// Validate input
	const validatedInput = UserInputSchema.parse(input);
	
	const result = await agent.generate(validatedInput.query, {
		output: AgentResponseSchema,
		context: validatedInput.context ? [
			{ role: "system", content: JSON.stringify(validatedInput.context) }
		] : undefined,
	});

	return result.object;
}
```

### Runtime Type Validation

```typescript
import { z } from "zod";

// Runtime validation helper
export function validateAndTransform<T>(
	data: unknown,
	schema: z.ZodSchema<T>
): T {
	try {
		return schema.parse(data);
	} catch (error) {
		if (error instanceof z.ZodError) {
			throw new Error(`Validation failed: ${error.errors.map(e => e.message).join(", ")}`);
		}
		throw error;
	}
}

// Usage in tools
export const validatedTool = createTool({
	id: "validated-operation",
	description: "Tool with strict validation",
	inputSchema: z.object({
		data: z.unknown(),
		expectedType: z.enum(["string", "number", "object"]),
	}),
	outputSchema: z.object({
		validatedData: z.unknown(),
		type: z.string(),
	}),
	execute: async ({ context }) => {
		let schema: z.ZodSchema;
		
		switch (context.expectedType) {
			case "string":
				schema = z.string();
				break;
			case "number":
				schema = z.number();
				break;
			case "object":
				schema = z.record(z.unknown());
				break;
			default:
				throw new Error(`Unsupported type: ${context.expectedType}`);
		}

		const validatedData = validateAndTransform(context.data, schema);
		
		return {
			validatedData,
			type: typeof validatedData,
		};
	},
});
```

## Error Handling

### Comprehensive Error Handling

```typescript
// Custom error types
export class MastraError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly context?: Record<string, unknown>
	) {
		super(message);
		this.name = "MastraError";
	}
}

export class AgentExecutionError extends MastraError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, "AGENT_EXECUTION_ERROR", context);
		this.name = "AgentExecutionError";
	}
}

export class ToolExecutionError extends MastraError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, "TOOL_EXECUTION_ERROR", context);
		this.name = "ToolExecutionError";
	}
}

// Error handling in tools
export const robustTool = createTool({
	id: "robust-operation",
	description: "Tool with comprehensive error handling",
	inputSchema: z.object({
		operation: z.string(),
		retries: z.number().default(3),
	}),
	outputSchema: z.object({
		result: z.string(),
		attempts: z.number(),
		errors: z.array(z.string()).optional(),
	}),
	execute: async ({ context }) => {
		const errors: string[] = [];
		let attempts = 0;

		for (let i = 0; i < context.retries; i++) {
			attempts++;
			try {
				const result = await performOperation(context.operation);
				return {
					result,
					attempts,
					errors: errors.length > 0 ? errors : undefined,
				};
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				errors.push(`Attempt ${attempts}: ${errorMessage}`);
				
				if (i === context.retries - 1) {
					throw new ToolExecutionError(
						`Operation failed after ${attempts} attempts`,
						{ operation: context.operation, errors }
					);
				}
				
				// Wait before retry
				await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
			}
		}

		throw new ToolExecutionError("Unexpected error in retry loop");
	},
});

async function performOperation(operation: string): Promise<string> {
	// Simulate operation that might fail
	if (Math.random() < 0.3) {
		throw new Error("Random operation failure");
	}
	return `Completed: ${operation}`;
}
```

### Workflow Error Handling

```typescript
const errorHandlingStep = createStep({
	id: "error-handling-step",
	description: "Step with comprehensive error handling",
	inputSchema: z.object({
		data: z.string(),
	}),
	outputSchema: z.object({
		result: z.string(),
		success: z.boolean(),
		error: z.string().optional(),
	}),
	execute: async ({ inputData, runCount = 0 }) => {
		try {
			// Attempt operation
			const result = await riskyOperation(inputData.data);
			return {
				result,
				success: true,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			
			// Log error with context
			console.error(`Step execution failed (attempt ${runCount + 1}):`, {
				error: errorMessage,
				inputData,
				runCount,
			});

			// Return error state instead of throwing
			return {
				result: "",
				success: false,
				error: errorMessage,
			};
		}
	},
});

async function riskyOperation(data: string): Promise<string> {
	// Simulate risky operation
	if (data.includes("error")) {
		throw new Error("Operation failed due to error in data");
	}
	return `Processed: ${data}`;
}
```

## Performance

### Optimization Best Practices

```typescript
// 1. Use appropriate model sizes
const efficientAgent = new Agent({
	name: "EfficientAgent",
	instructions: "You are a cost-effective assistant.",
	model: ({ runtimeContext }) => {
		const taskComplexity = runtimeContext.get("task-complexity");
		// Use smaller models for simple tasks
		return taskComplexity === "simple" 
			? openai("gpt-4o-mini") 
			: openai("gpt-4o");
	},
});

// 2. Implement caching for expensive operations
const cachedResults = new Map<string, unknown>();

export const cachingTool = createTool({
	id: "cached-operation",
	description: "Tool with result caching",
	inputSchema: z.object({
		query: z.string(),
		useCache: z.boolean().default(true),
	}),
	outputSchema: z.object({
		result: z.string(),
		fromCache: z.boolean(),
	}),
	execute: async ({ context }) => {
		const cacheKey = `query:${context.query}`;
		
		if (context.useCache && cachedResults.has(cacheKey)) {
			return {
				result: cachedResults.get(cacheKey) as string,
				fromCache: true,
			};
		}

		const result = await expensiveOperation(context.query);
		
		if (context.useCache) {
			cachedResults.set(cacheKey, result);
		}

		return {
			result,
			fromCache: false,
		};
	},
});

async function expensiveOperation(query: string): Promise<string> {
	// Simulate expensive operation
	await new Promise(resolve => setTimeout(resolve, 1000));
	return `Processed: ${query}`;
}

// 3. Batch operations when possible
export const batchProcessingTool = createTool({
	id: "batch-processor",
	description: "Process multiple items in batches",
	inputSchema: z.object({
		items: z.array(z.string()),
		batchSize: z.number().default(10),
	}),
	outputSchema: z.object({
		results: z.array(z.string()),
		batchCount: z.number(),
	}),
	execute: async ({ context }) => {
		const { items, batchSize } = context;
		const results: string[] = [];
		const batches = Math.ceil(items.length / batchSize);

		for (let i = 0; i < items.length; i += batchSize) {
			const batch = items.slice(i, i + batchSize);
			const batchResults = await Promise.all(
				batch.map(item => processItem(item))
			);
			results.push(...batchResults);
		}

		return {
			results,
			batchCount: batches,
		};
	},
});

async function processItem(item: string): Promise<string> {
	// Process individual item
	return `Processed: ${item}`;
}
```

### Memory Optimization

```typescript
// Optimize memory usage in workflows
export const memoryOptimizedWorkflow = createWorkflow({
	id: "memory-optimized",
	inputSchema: z.object({
		data: z.array(z.string()),
	}),
	outputSchema: z.object({
		summary: z.string(),
	}),
})
	.foreach(
		createStep({
			id: "process-item",
			inputSchema: z.object({
				item: z.string(),
			}),
			outputSchema: z.object({
				processed: z.string(),
			}),
			execute: async ({ inputData }) => {
				// Process item without storing large intermediate results
				const processed = inputData.item.toUpperCase();
				return { processed };
			},
		}),
		{ concurrency: 5 } // Limit concurrency to manage memory
	)
	.map(({ inputData }) => {
		// Summarize results instead of keeping all data
		const summary = `Processed ${inputData.length} items`;
		return { summary };
	})
	.commit();
```

## Commands

```bash
# Development
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm typecheck    # TypeScript check
pnpm lint         # Run Biome linter

# Check specific file for errors
pnpm biome check --write lib/mastra/agents/task-analyzer-agent.ts
```

## Key Takeaways

1. **Always use Zod schemas** for input/output validation
2. **No `any` types** - maintain strict TypeScript typing
3. **Follow Biome formatting rules** - tabs, double quotes, trailing commas
4. **Use direct imports** - avoid index.ts files
5. **Implement comprehensive error handling** with custom error types
6. **Test all components** thoroughly with proper type checking
7. **Optimize for performance** with appropriate model selection and caching
8. **Use memory efficiently** in workflows and long-running processes
9. **Validate runtime context** and handle missing dependencies gracefully
10. **Document all schemas and types** for better maintainability

This guide ensures your Mastra implementation follows best practices while maintaining strict type safety and optimal performance.