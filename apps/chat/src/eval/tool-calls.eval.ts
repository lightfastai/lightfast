/**
 * Braintrust evaluation for tool calling capabilities across all AI models
 *
 * Tests all active models for:
 * 1. Tool call success rate (ability to generate valid tool calls)
 * 2. Parameter accuracy (correct parameter names and types)
 * 3. JSON formatting compliance
 * 4. Complex tool call scenarios
 * 5. Error handling and graceful degradation
 */

import { Eval, initLogger } from "braintrust";
import type { EvalCase, EvalScorerArgs } from "braintrust";
import { gateway } from "@ai-sdk/gateway";
import { generateText, wrapLanguageModel, tool } from "ai";
import { BraintrustMiddleware } from "braintrust";
import { ACTIVE_MODELS } from "../ai/providers/models/active";
import type { ModelId } from "../ai/providers";
import { buildAuthenticatedSystemPrompt } from "../ai/prompts/builders/system-prompt-builder";
import { getBraintrustConfig } from "@repo/ai/braintrust-env";
import { evalTools } from "./tools/eval-tools";

// Extract model IDs from the centralized model definitions (only active models)
const ACTIVE_MODEL_IDS = Object.keys(ACTIVE_MODELS) as ModelId[];

// Mock runtime context for tool testing
const createMockRuntimeContext = () => ({
	sessionId: "test-session",
	messageId: "test-message",
	resourceId: "test-resource",
	dataStream: {
		write: () => {},
	},
});

// Test model with tool calling capabilities AND execute tools
async function testModelWithTools(
	prompt: string,
	modelId: ModelId,
): Promise<{ 
	text: string; 
	toolCalls: any[]; 
	toolExecutions: any[];
	errors: string[];
	executionResults: any[];
}> {
	try {
		console.log("testModelWithTools called with:", { prompt, modelId });
		
		const systemPrompt = buildAuthenticatedSystemPrompt(false) + "\n\nYou have access to the following tools:\n- createDocument: Create documents for coding, writing, or content creation\n- webSearch: Search the web for information\n- calculator: Perform mathematical calculations\n\nUse tools when they would be helpful to fulfill the user's request.";
		
		const result = await generateText({
			model: wrapLanguageModel({
				model: gateway(modelId),
				middleware: BraintrustMiddleware({ debug: true }),
			}),
			system: systemPrompt,
			prompt,
			tools: {
				createDocument: tool({
					description: evalTools.createDocument.description,
					inputSchema: evalTools.createDocument.inputSchema,
					execute: evalTools.createDocument.execute,
				}),
				webSearch: tool({
					description: evalTools.webSearch.description,
					inputSchema: evalTools.webSearch.inputSchema,
					execute: evalTools.webSearch.execute,
				}),
				calculator: tool({
					description: evalTools.calculator.description,
					inputSchema: evalTools.calculator.inputSchema,
					execute: evalTools.calculator.execute,
				})
			},
			maxToolRoundtrips: 1,
			experimental_telemetry: {
				isEnabled: true,
				functionId: "tool-calls-evaluation",
				metadata: {
					context: "experiment",
					experimentType: "tool-call-validation",
					modelId: modelId,
					toolsAvailable: ['createDocument', 'webSearch', 'calculator'],
					evaluationName: "Tool Call Validation - All Models",
				},
			},
		});

		// Extract tool calls from the result
		const toolCalls = result.toolCalls || [];
		const errors: string[] = [];
		const toolExecutions: any[] = [];
		const executionResults: any[] = [];

		// Basic validation of tool calls
		for (const toolCall of toolCalls) {
			if (!toolCall.toolName) {
				errors.push("Missing tool name");
			}
			if (!toolCall.args) {
				errors.push("Missing tool arguments");
			}
			try {
				JSON.stringify(toolCall.args);
			} catch (e) {
				errors.push("Invalid JSON in tool arguments");
			}
		}

		// Tool executions are handled automatically by AI SDK tool() helper
		// Extract tool results from the response
		const toolResults = result.toolResults || [];
		
		for (const toolCall of toolCalls) {
			const matchingResult = toolResults.find(r => r.toolCallId === toolCall.toolCallId);
			
			toolExecutions.push({
				toolName: toolCall.toolName,
				args: toolCall.args,
				success: matchingResult ? !matchingResult.isError : false,
				result: matchingResult?.result,
				error: matchingResult?.isError ? matchingResult.error : null,
			});

			executionResults.push(matchingResult?.result);
			
			if (matchingResult?.isError) {
				errors.push(`Tool execution failed: ${matchingResult.error}`);
			}
		}

		return {
			text: result.text,
			toolCalls,
			toolExecutions,
			errors,
			executionResults
		};
	} catch (error) {
		console.error("Model Error:", error);
		return {
			text: `ERROR: ${String(error)}`,
			toolCalls: [],
			toolExecutions: [],
			errors: [String(error)],
			executionResults: []
		};
	}
}

// Define types for our evaluation
interface TestInput { 
	prompt: string; 
	modelId: ModelId; 
	expectsToolCall: boolean;
	expectedTool?: string;
	complexity: 'simple' | 'medium' | 'complex';
}
interface TestExpected { 
	expectsToolCall: boolean; 
	expectedTool?: string;
	modelId: ModelId;
}
type TestOutput = { 
	text: string; 
	toolCalls: any[]; 
	toolExecutions: any[];
	errors: string[];
	executionResults: any[];
};

// Test prompts focusing on different tool call scenarios
const TEST_PROMPTS = [
	// Simple tool calls - single parameter  
	{
		prompt: "Use the createDocument tool to create a simple HTML document titled 'Hello World'",
		expectsToolCall: true,
		expectedTool: "createDocument",
		complexity: 'simple' as const,
		description: "Simple document creation - explicit tool instruction"
	},
	{
		prompt: "Use the webSearch tool to find information about React 19 features",
		expectsToolCall: true,
		expectedTool: "webSearch", 
		complexity: 'simple' as const,
		description: "Simple web search - explicit tool instruction"
	},
	{
		prompt: "Use the calculator tool to add 25 + 17",
		expectsToolCall: true,
		expectedTool: "calculator",
		complexity: 'simple' as const,
		description: "Simple calculator - explicit tool instruction"
	},
	
	// Medium complexity - multiple parameters
	{
		prompt: "I need you to create a document about React components. Use createDocument to make a 'code' document titled 'User Profile Card'",
		expectsToolCall: true,
		expectedTool: "createDocument",
		complexity: 'medium' as const,
		description: "Document creation with specific parameters"
	},
	{
		prompt: "Please search for React Server Components performance data. Use webSearch with 3 results and 'text' content type",
		expectsToolCall: true,
		expectedTool: "webSearch",
		complexity: 'medium' as const,
		description: "Web search with specific parameters"
	},
	
	// Complex scenarios - multiple tool calls
	{
		prompt: "First use webSearch to find Next.js 15 features, then use createDocument to make a summary",
		expectsToolCall: true,
		expectedTool: "webSearch", // First expected tool
		complexity: 'complex' as const,
		description: "Multi-step task requiring multiple tools"
	},
	{
		prompt: "Create a comprehensive API documentation using createDocument. Make it a 'text' document titled 'REST API Guide'",
		expectsToolCall: true,
		expectedTool: "createDocument",
		complexity: 'complex' as const,
		description: "Complex document with detailed requirements"
	},
	
	// Edge cases and error handling
	{
		prompt: "Just explain what React hooks are conceptually, no tools needed",
		expectsToolCall: false,
		complexity: 'simple' as const,
		description: "Should NOT trigger tool calls - explanation only"
	},
	{
		prompt: "Use createDocument with title 'Very Long Title That Tests Parameter Validation Edge Cases' and kind 'text'",
		expectsToolCall: true,
		expectedTool: "createDocument",
		complexity: 'medium' as const,
		description: "Edge case - long parameters with explicit instructions"
	}
];

// Generate test data: each prompt × each model = comprehensive evaluation
const TEST_DATA: EvalCase<TestInput, TestExpected, { model: string; prompt_type: string; complexity: string }>[] = [];

for (const testPrompt of TEST_PROMPTS) {
	for (const modelId of ACTIVE_MODEL_IDS) {
		TEST_DATA.push({
			input: {
				prompt: testPrompt.prompt,
				modelId,
				expectsToolCall: testPrompt.expectsToolCall,
				expectedTool: testPrompt.expectedTool,
				complexity: testPrompt.complexity
			},
			expected: {
				expectsToolCall: testPrompt.expectsToolCall,
				expectedTool: testPrompt.expectedTool,
				modelId
			},
			metadata: {
				model: modelId,
				prompt_type: testPrompt.description,
				complexity: testPrompt.complexity
			}
		});
	}
}

// Initialize Braintrust logging with configured project name
const braintrustConfig = getBraintrustConfig();
initLogger({
	apiKey: braintrustConfig.apiKey,
	projectName: braintrustConfig.projectName || "lightfast-chat-evaluation",
});

// Main evaluation
void Eval(braintrustConfig.projectName || "lightfast-chat-evaluation", {
	data: TEST_DATA,

	task: async (input: TestInput): Promise<TestOutput> => {
		console.log(`Testing ${input.modelId} with prompt: "${input.prompt.substring(0, 50)}..."`);
		
		const result = await testModelWithTools(
			input.prompt,
			input.modelId
		);
		
		return result;
	},

	scores: [
		// Tool Call Generation Success Rate
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; prompt_type: string; complexity: string }>) => {
			const modelId = args.input.modelId;
			const expectsToolCall = args.input.expectsToolCall;
			const actualToolCalls = args.output.toolCalls.length;
			
			console.log(`Scoring tool call generation for ${modelId}, expects: ${expectsToolCall}, actual: ${actualToolCalls}`);
			
			if (args.output.text.includes("ERROR:")) return 0;
			
			// If tool call is expected but none generated
			if (expectsToolCall && actualToolCalls === 0) return 0;
			
			// If no tool call expected but one was generated (still ok, just unnecessary)
			if (!expectsToolCall && actualToolCalls > 0) return 0.7;
			
			// If tool call expected and generated
			if (expectsToolCall && actualToolCalls > 0) return 1;
			
			// If no tool call expected and none generated
			if (!expectsToolCall && actualToolCalls === 0) return 1;
			
			return 0.5;
		},

		// Tool Execution Success Rate
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; prompt_type: string; complexity: string }>) => {
			const modelId = args.input.modelId;
			const toolExecutions = args.output.toolExecutions;
			
			console.log(`Scoring tool execution success for ${modelId}, executions: ${toolExecutions.length}`);
			
			if (args.output.text.includes("ERROR:")) return 0;
			if (toolExecutions.length === 0) return 1; // No tools to execute
			
			const successfulExecutions = toolExecutions.filter(exec => exec.success);
			const successRate = successfulExecutions.length / toolExecutions.length;
			
			console.log(`Tool execution success rate for ${modelId}: ${successRate} (${successfulExecutions.length}/${toolExecutions.length})`);
			
			return successRate;
		},

		// Tool Selection Accuracy
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; prompt_type: string; complexity: string }>) => {
			const modelId = args.input.modelId;
			const expectedTool = args.input.expectedTool;
			const toolCalls = args.output.toolCalls;
			
			console.log(`Scoring tool selection accuracy for ${modelId}`);
			
			if (args.output.text.includes("ERROR:")) return 0;
			if (!expectedTool || toolCalls.length === 0) return 1; // No specific tool expected
			
			// Check if the expected tool was called
			const hasExpectedTool = toolCalls.some(call => call.toolName === expectedTool);
			return hasExpectedTool ? 1 : 0;
		},

		// Tool Execution Quality Score
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; prompt_type: string; complexity: string }>) => {
			const modelId = args.input.modelId;
			const toolExecutions = args.output.toolExecutions;
			
			console.log(`Scoring tool execution quality for ${modelId}`);
			
			if (args.output.text.includes("ERROR:")) return 0;
			if (toolExecutions.length === 0) return 1; // No tools executed
			
			let qualityScore = 0;
			for (const execution of toolExecutions) {
				let execScore = 0;
				
				// Base score for successful execution
				if (execution.success) execScore += 0.6;
				
				// Bonus for reasonable parameters
				if (execution.args) {
					if (execution.toolName === 'createDocument') {
						if (execution.args.title && execution.args.kind) execScore += 0.2;
						if (execution.args.title && execution.args.title.split(' ').length <= 4) execScore += 0.1;
					} else if (execution.toolName === 'webSearch') {
						if (execution.args.query && execution.args.query.length > 5) execScore += 0.2;
						if (execution.args.numResults >= 1 && execution.args.numResults <= 10) execScore += 0.1;
					} else if (execution.toolName === 'calculator') {
						if (typeof execution.args.a === 'number' && typeof execution.args.b === 'number') execScore += 0.3;
					}
				}
				
				// Bonus for meaningful result
				if (execution.result && execution.result.success) execScore += 0.1;
				
				qualityScore += Math.min(execScore, 1);
			}
			
			return toolExecutions.length > 0 ? qualityScore / toolExecutions.length : 1;
		},

		// Overall Functionality
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; prompt_type: string; complexity: string }>) => {
			const modelId = args.input.modelId;
			
			console.log(`Scoring overall functionality for ${modelId}`);
			
			if (args.output.text.includes("ERROR:")) return 0;
			
			const hasValidResponse = args.output.text.length > 20;
			const hasMinimalErrors = args.output.errors.length <= 2;
			const toolCallsGenerated = args.output.toolCalls.length > 0;
			const toolExecutionsSuccessful = args.output.toolExecutions.filter(e => e.success).length;
			const totalExecutions = args.output.toolExecutions.length;
			
			let score = 0;
			if (hasValidResponse) score += 0.3;
			if (hasMinimalErrors) score += 0.2;
			if (toolCallsGenerated) score += 0.2;
			if (totalExecutions > 0 && toolExecutionsSuccessful === totalExecutions) score += 0.3;
			
			console.log(`Overall functionality score for ${modelId}: ${score}`);
			return score;
		}
	],
});
