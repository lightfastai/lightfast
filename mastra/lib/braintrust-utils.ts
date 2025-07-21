import type { CoreMessage } from "ai";
import { initLogger } from "braintrust";
import { env } from "../../env";

// Initialize Braintrust logger with local development support
const isDevelopment = env.NODE_ENV === "development";

const braintrust = initLogger({
	projectName: "hal9000-agents",
	apiKey: env.BRAINTRUST_API_KEY,
});

// Local logging fallback for development
const localLog = (data: Record<string, unknown>) => {
	if (isDevelopment && !env.BRAINTRUST_API_KEY) {
		console.log("[BRAINTRUST LOCAL]", JSON.stringify(data, null, 2));
	}
};

// Enhanced logging wrapper that supports local development
const safeBraintrustLog = async (data: Record<string, unknown>) => {
	try {
		// In development without API key, use local logging
		if (isDevelopment && !env.BRAINTRUST_API_KEY) {
			localLog(data);
			return { success: true, mode: "local" };
		}

		return await braintrust.log(data);
	} catch (error) {
		// Fallback to local logging if Braintrust fails
		if (isDevelopment) {
			console.warn("[BRAINTRUST] Remote logging failed, falling back to local:", error);
			localLog(data);
		}
		return { success: false, error };
	}
};

/**
 * Configuration for Braintrust evaluation experiments
 */
export interface BraintrustConfig {
	project: string;
	experiment?: string;
	dataset?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Standard evaluation scores for agent interactions
 */
export interface AgentEvaluationScores {
	// Core quality metrics
	relevancy?: number;
	completeness?: number;
	accuracy?: number;
	helpfulness?: number;

	// Safety and bias metrics
	toxicity?: number;
	bias?: number;
	safety?: number;

	// Task-specific metrics
	task_completion?: number;
	tool_success_rate?: number;
	response_time?: number;

	// Content quality
	clarity?: number;
	coherence?: number;
	factual_accuracy?: number;
	response_quality?: number;
}

/**
 * Input data structure for agent evaluations
 */
export interface AgentEvaluationInput {
	messages: CoreMessage[];
	threadId?: string;
	resourceId?: string;
	agentName: string;
	tools?: string[];
	context?: Record<string, unknown>;
}

/**
 * Output data structure for agent evaluations
 */
export interface AgentEvaluationOutput {
	response: string;
	tool_calls?: Array<{
		name: string;
		result: unknown;
		success: boolean;
		duration?: number;
	}>;
	metadata?: Record<string, unknown>;
}

/**
 * Tool execution evaluation data
 */
export interface ToolEvaluationData {
	tool_name: string;
	input: Record<string, unknown>;
	output: unknown;
	success: boolean;
	duration: number;
	error?: string;
	context?: {
		threadId?: string;
		resourceId?: string;
		agentName?: string;
	};
}

/**
 * Conversation-level evaluation data
 */
export interface ConversationEvaluationData {
	messages: CoreMessage[];
	final_response: string;
	thread_id: string;
	agent_name: string;
	duration: number;
	tool_calls_count: number;
	success: boolean;
}

/**
 * Creates a new Braintrust evaluation session for agent testing
 */
export async function createAgentEvaluation(_config: BraintrustConfig) {
	// With initLogger, we don't need to create separate evaluations
	// The logger handles all the logging automatically
	return braintrust;
}

/**
 * Logs an agent interaction to Braintrust
 */
export async function logAgentInteraction(
	input: AgentEvaluationInput,
	output: AgentEvaluationOutput,
	scores?: AgentEvaluationScores,
	metadata?: Record<string, unknown>,
) {
	return safeBraintrustLog({
		input: {
			messages: input.messages,
			agent: input.agentName,
			thread_id: input.threadId,
			resource_id: input.resourceId,
			tools_available: input.tools || [],
			context: input.context,
		},
		output: {
			response: output.response,
			tool_calls: output.tool_calls || [],
			metadata: output.metadata,
		},
		scores: (scores as Record<string, number | null>) || {},
		metadata: {
			timestamp: new Date().toISOString(),
			agent_name: input.agentName,
			thread_id: input.threadId,
			...metadata,
		},
	});
}

/**
 * Logs tool execution data to Braintrust
 */
export async function logToolExecution(data: ToolEvaluationData) {
	return safeBraintrustLog({
		input: {
			tool: data.tool_name,
			parameters: data.input,
			context: data.context,
		},
		output: {
			result: data.output,
			success: data.success,
			duration_ms: data.duration,
			error: data.error,
		},
		scores: {
			success: data.success ? 1 : 0,
			performance: data.duration < 1000 ? 1 : data.duration < 5000 ? 0.7 : 0.3,
		},
		metadata: {
			timestamp: new Date().toISOString(),
			tool_name: data.tool_name,
			agent_name: data.context?.agentName,
			thread_id: data.context?.threadId,
		},
	});
}

/**
 * Logs conversation-level evaluation data
 */
export async function logConversationEvaluation(data: ConversationEvaluationData) {
	return safeBraintrustLog({
		input: {
			conversation: data.messages,
			agent: data.agent_name,
			thread_id: data.thread_id,
		},
		output: {
			final_response: data.final_response,
			duration_ms: data.duration,
			tool_calls_count: data.tool_calls_count,
			success: data.success,
		},
		scores: {
			success: data.success ? 1 : 0,
			efficiency: data.duration < 5000 ? 1 : data.duration < 15000 ? 0.7 : 0.3,
			tool_usage: data.tool_calls_count > 0 ? 1 : 0.5,
		},
		metadata: {
			timestamp: new Date().toISOString(),
			agent_name: data.agent_name,
			thread_id: data.thread_id,
			conversation_length: data.messages.length,
		},
	});
}

/**
 * Evaluates response relevancy using a simple heuristic
 * In production, this could be enhanced with ML models
 */
export async function evaluateRelevancy(question: string, response: string): Promise<number> {
	// Simple keyword overlap heuristic
	const questionWords = question.toLowerCase().split(/\s+/);
	const responseWords = response.toLowerCase().split(/\s+/);

	const questionKeywords = questionWords.filter((word) => word.length > 3);
	const relevantWords = questionKeywords.filter((keyword) =>
		responseWords.some((word) => word.includes(keyword) || keyword.includes(word)),
	);

	return questionKeywords.length > 0 ? relevantWords.length / questionKeywords.length : 0;
}

/**
 * Evaluates task completion based on response content
 */
export async function evaluateTaskCompletion(messages: CoreMessage[], response: string): Promise<number> {
	const lastUserMessage = messages.findLast((m) => m.role === "user")?.content;
	if (!lastUserMessage || typeof lastUserMessage !== "string") return 0;

	// Check for completion indicators
	const completionIndicators = [
		"done",
		"completed",
		"finished",
		"ready",
		"success",
		"created",
		"generated",
		"saved",
		"processed",
	];

	const responseText = response.toLowerCase();
	const hasCompletionIndicator = completionIndicators.some((indicator) => responseText.includes(indicator));

	// Check for error indicators
	const errorIndicators = ["error", "failed", "couldn't", "unable", "sorry"];

	const hasErrorIndicator = errorIndicators.some((indicator) => responseText.includes(indicator));

	if (hasErrorIndicator) return 0;
	if (hasCompletionIndicator) return 1;

	// Moderate score for responses that don't clearly indicate completion
	return 0.5;
}

/**
 * Evaluates response quality based on length, coherence, and helpfulness
 */
export async function evaluateResponseQuality(response: string): Promise<number> {
	let score = 0;

	// Length check (not too short, not too verbose)
	const wordCount = response.split(/\s+/).length;
	if (wordCount >= 10 && wordCount <= 500) score += 0.3;
	else if (wordCount > 500 && wordCount <= 1000) score += 0.2;

	// Coherence check (has proper structure)
	const sentences = response.split(/[.!?]+/).filter((s) => s.trim().length > 0);
	if (sentences.length >= 2) score += 0.3;

	// Helpfulness indicators
	const helpfulPhrases = [
		"here's",
		"you can",
		"try",
		"consider",
		"recommend",
		"solution",
		"approach",
		"method",
		"way to",
	];

	const hasHelpfulContent = helpfulPhrases.some((phrase) => response.toLowerCase().includes(phrase));

	if (hasHelpfulContent) score += 0.4;

	return Math.min(score, 1);
}

/**
 * Creates a comprehensive evaluation for agent step completion
 */
export async function createStepEvaluation(
	text: string,
	toolCalls?: Array<{ toolName: string }>,
	toolResults?: unknown[],
): Promise<AgentEvaluationScores> {
	const scores: AgentEvaluationScores = {};

	// Evaluate response quality
	scores.helpfulness = await evaluateResponseQuality(text);

	// Tool usage evaluation
	if (toolCalls && toolCalls.length > 0) {
		scores.tool_success_rate = toolResults
			? toolResults.filter((result) => result !== null).length / toolResults.length
			: 0.5;
	}

	// Response time (would need to be passed in)
	scores.response_time = 1; // Placeholder - should be actual timing

	// Basic safety check (no toxic content)
	scores.safety = text.toLowerCase().includes("error") ? 0.5 : 1;

	return scores;
}

/**
 * Utility to safely extract string content from messages
 */
export function extractMessageContent(message: CoreMessage): string {
	if (typeof message.content === "string") {
		return message.content;
	}

	if (Array.isArray(message.content)) {
		return message.content
			.filter((part) => part.type === "text")
			.map((part) => ("text" in part ? part.text : ""))
			.join(" ");
	}

	return "";
}

/**
 * Creates a project-specific Braintrust configuration
 */
export function createProjectConfig(projectName: string, experimentName?: string): BraintrustConfig {
	return {
		project: `hal9000-${projectName}`,
		experiment: experimentName || `experiment-${Date.now()}`,
		metadata: {
			platform: "hal9000",
			framework: "mastra",
			model: "claude-4-sonnet",
			timestamp: new Date().toISOString(),
		},
	};
}
