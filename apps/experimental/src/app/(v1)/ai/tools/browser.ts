import type { RuntimeContext } from "@lightfast/core/agent/server/adapters/types";
import { createTool } from "@lightfast/core/tool";
import {
	StagehandSessionManager,
	performWebAction,
	performWebObservation,
	performWebExtraction,
	performWebNavigation,
} from "@lightfast/lightfast-tools/browserbase";
import { currentSpan, wrapTraced } from "braintrust";
import { z } from "zod";
import type { AppRuntimeContext } from "@/app/(v1)/ai/types";
import { env } from "@/env";

// Initialize the session manager with config
const sessionManager = StagehandSessionManager.getInstance({
	apiKey: env.BROWSERBASE_API_KEY,
	projectId: env.BROWSERBASE_PROJECT_ID,
	anthropicApiKey: env.ANTHROPIC_API_KEY,
	modelName: "claude-3-7-sonnet-latest",
	enableCaptchaSolving: true,
	enableAdvancedStealth: false, // Set to true if on Scale Plan
	viewportWidth: 1280,
	viewportHeight: 720,
});

/**
 * Wrapped stagehand act execution function with Braintrust tracing
 */
const executeStagehandAct = wrapTraced(
	async function executeStagehandAct(
		{
			url,
			action,
		}: {
			url?: string;
			action: string;
		},
		context: RuntimeContext<AppRuntimeContext>,
	) {
		// Log metadata
		currentSpan().log({
			metadata: {
				url: url || "current page",
				action,
				contextInfo: {
					sessionId: context.sessionId,
					resourceId: context.resourceId,
				},
			},
		});
		
		try {
			const result = await performWebAction(sessionManager, url, action);
			
			// Log success
			currentSpan().log({
				metadata: {
					success: true,
					actionPerformed: action,
				},
			});
			
			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			// Log error
			currentSpan().log({
				metadata: {
					error: {
						message: errorMessage,
						type: error instanceof Error ? error.constructor.name : "UnknownError",
						action,
						url,
					},
				},
			});
			throw error;
		}
	},
	{ type: "tool", name: "stagehandAct" },
);

export const stagehandActTool = createTool<RuntimeContext<AppRuntimeContext>>({
	description: "Take an action on a webpage using Stagehand",
	inputSchema: z.object({
		url: z.string().optional().describe("URL to navigate to (optional if already on a page)"),
		action: z.string().describe('Action to perform (e.g., "click sign in button", "type hello in search field")'),
	}),
	execute: executeStagehandAct,
});

/**
 * Wrapped stagehand observe execution function with Braintrust tracing
 */
const executeStagehandObserve = wrapTraced(
	async function executeStagehandObserve(
		{
			url,
			instruction,
		}: {
			url?: string;
			instruction: string;
		},
		context: RuntimeContext<AppRuntimeContext>,
	) {
		// Log metadata
		currentSpan().log({
			metadata: {
				url: url || "current page",
				instruction,
				contextInfo: {
					sessionId: context.sessionId,
					resourceId: context.resourceId,
				},
			},
		});
		
		try {
			const actions = await performWebObservation(sessionManager, url, instruction);
			
			// Log observation results
			currentSpan().log({
				metadata: {
					actionsFound: Array.isArray(actions) ? actions.length : 0,
					instruction,
				},
			});
			
			return actions;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			// Log error
			currentSpan().log({
				metadata: {
					error: {
						message: errorMessage,
						type: error instanceof Error ? error.constructor.name : "UnknownError",
						instruction,
						url,
					},
				},
			});
			throw error;
		}
	},
	{ type: "tool", name: "stagehandObserve" },
);

export const stagehandObserveTool = createTool<RuntimeContext<AppRuntimeContext>>({
	description: "Observe elements on a webpage using Stagehand to plan actions",
	inputSchema: z.object({
		url: z.string().optional().describe("URL to navigate to (optional if already on a page)"),
		instruction: z.string().describe('What to observe (e.g., "find the sign in button")'),
	}),
	outputSchema: z.array(z.unknown()).describe("Array of observable actions"),
	execute: executeStagehandObserve,
});

/**
 * Wrapped stagehand extract execution function with Braintrust tracing
 */
const executeStagehandExtract = wrapTraced(
	async function executeStagehandExtract(
		{
			url,
			instruction,
			schema,
			useTextExtract,
		}: {
			url?: string;
			instruction: string;
			schema?: Record<string, unknown>;
			useTextExtract?: boolean;
		},
		context: RuntimeContext<AppRuntimeContext>,
	) {
		// Log metadata
		currentSpan().log({
			metadata: {
				url: url || "current page",
				instruction,
				hasSchema: !!schema,
				useTextExtract: !!useTextExtract,
				contextInfo: {
					sessionId: context.sessionId,
					resourceId: context.resourceId,
				},
			},
		});

		// Create a default schema if none is provided
		const defaultSchema = {
			content: z.string(),
		};

		try {
			const result = await performWebExtraction(
				sessionManager,
				url,
				instruction,
				(schema as Record<string, z.ZodTypeAny>) || defaultSchema,
				useTextExtract,
			);
			
			// Log extraction results
			currentSpan().log({
				metadata: {
					extractionSuccessful: true,
					instruction,
					useTextExtract: !!useTextExtract,
				},
			});
			
			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			// Log error
			currentSpan().log({
				metadata: {
					error: {
						message: errorMessage,
						type: error instanceof Error ? error.constructor.name : "UnknownError",
						instruction,
						url,
					},
				},
			});
			throw error;
		}
	},
	{ type: "tool", name: "stagehandExtract" },
);

export const stagehandExtractTool = createTool<RuntimeContext<AppRuntimeContext>>({
	description: "Extract data from a webpage using Stagehand",
	inputSchema: z.object({
		url: z.string().optional().describe("URL to navigate to (optional if already on a page)"),
		instruction: z.string().describe('What to extract (e.g., "extract all product prices")'),
		schema: z.record(z.unknown()).optional().describe("Zod schema definition for data extraction"),
		useTextExtract: z
			.boolean()
			.optional()
			.describe("Set true for larger-scale extractions, false for small extractions"),
	}),
	outputSchema: z.unknown().describe("Extracted data according to schema"),
	execute: executeStagehandExtract,
});

/**
 * Wrapped stagehand navigate execution function with Braintrust tracing
 */
const executeStagehandNavigate = wrapTraced(
	async function executeStagehandNavigate(
		{
			url,
		}: {
			url: string;
		},
		context: RuntimeContext<AppRuntimeContext>,
	) {
		// Log metadata
		currentSpan().log({
			metadata: {
				url,
				contextInfo: {
					sessionId: context.sessionId,
					resourceId: context.resourceId,
				},
			},
		});

		try {
			const result = await performWebNavigation(sessionManager, url);

			// Log result
			currentSpan().log({
				metadata: result,
			});

			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			// Log error
			currentSpan().log({
				metadata: {
					error: {
						message: errorMessage,
						type: error instanceof Error ? error.constructor.name : "UnknownError",
						url,
					},
				},
			});
			return {
				success: false,
				message: `Navigation failed: ${errorMessage}`,
			};
		}
	},
	{ type: "tool", name: "stagehandNavigate" },
);

// Add a navigation tool for convenience
export const stagehandNavigateTool = createTool<RuntimeContext<AppRuntimeContext>>({
	description: "Navigate to a URL in the browser",
	inputSchema: z.object({
		url: z.string().describe("URL to navigate to"),
	}),
	execute: executeStagehandNavigate,
});