import { Stagehand } from "@browserbasehq/stagehand";
import type { RuntimeContext } from "@lightfast/core/agent/server/adapters/types";
import { createTool } from "@lightfast/core/tool";
import { currentSpan, wrapTraced } from "braintrust";
import { z } from "zod";
import type { AppRuntimeContext } from "@/app/(v1)/ai/types";
import { env } from "@/env";

class StagehandSessionManager {
	private static instance: StagehandSessionManager;
	private stagehand: Stagehand | null = null;
	private initialized = false;
	private lastUsed = Date.now();
	private readonly sessionTimeout = 10 * 60 * 1000; // 10 minutes

	private constructor() {
		// Schedule session cleanup to prevent memory leaks
		setInterval(() => this.checkAndCleanupSession(), 60 * 1000);
	}

	/**
	 * Get the singleton instance of StagehandSessionManager
	 */
	public static getInstance(): StagehandSessionManager {
		if (!StagehandSessionManager.instance) {
			StagehandSessionManager.instance = new StagehandSessionManager();
		}
		return StagehandSessionManager.instance;
	}

	/**
	 * Ensure Stagehand is initialized and return the instance
	 */
	public async ensureStagehand(): Promise<Stagehand> {
		this.lastUsed = Date.now();

		try {
			// Initialize if not already initialized
			if (!this.stagehand || !this.initialized) {
				console.log("Creating new Stagehand instance");
				this.stagehand = new Stagehand({
					apiKey: env.BROWSERBASE_API_KEY,
					projectId: env.BROWSERBASE_PROJECT_ID,
					env: "BROWSERBASE",
					disablePino: true,
					modelName: "claude-3-7-sonnet-latest",
					modelClientOptions: {
						apiKey: env.ANTHROPIC_API_KEY,
					},
				});

				try {
					console.log("Initializing Stagehand...");
					await this.stagehand.init();
					console.log("Stagehand initialized successfully");
					this.initialized = true;
					return this.stagehand;
				} catch (initError) {
					console.error("Failed to initialize Stagehand:", initError);
					throw initError;
				}
			}

			try {
				const title = await this.stagehand.page.evaluate(() => document.title);
				console.log("Session check successful, page title:", title);
				return this.stagehand;
			} catch (error) {
				// If we get an error indicating the session is invalid, reinitialize
				console.error("Session check failed:", error);
				if (
					error instanceof Error &&
					(error.message.includes("Target page, context or browser has been closed") ||
						error.message.includes("Session expired") ||
						error.message.includes("context destroyed"))
				) {
					console.log("Browser session expired, reinitializing Stagehand...");
					this.stagehand = new Stagehand({
						apiKey: env.BROWSERBASE_API_KEY,
						projectId: env.BROWSERBASE_PROJECT_ID,
						env: "BROWSERBASE",
						disablePino: true,
						modelName: "claude-3-7-sonnet-latest",
						modelClientOptions: {
							apiKey: env.ANTHROPIC_API_KEY,
						},
					});
					await this.stagehand.init();
					this.initialized = true;
					return this.stagehand;
				}
				throw error; // Re-throw if it's a different type of error
			}
		} catch (error) {
			this.initialized = false;
			this.stagehand = null;
			const errorMsg = error instanceof Error ? error.message : String(error);
			throw new Error(`Failed to initialize/reinitialize Stagehand: ${errorMsg}`);
		}
	}

	/**
	 * Close the Stagehand session if it's been idle for too long
	 */
	private async checkAndCleanupSession(): Promise<void> {
		if (!this.stagehand || !this.initialized) return;

		const now = Date.now();
		if (now - this.lastUsed > this.sessionTimeout) {
			console.log("Cleaning up idle Stagehand session");
			try {
				await this.stagehand.close();
			} catch (error) {
				console.error(`Error closing idle session: ${error}`);
			}
			this.stagehand = null;
			this.initialized = false;
		}
	}

	/**
	 * Manually close the session
	 */
	public async close(): Promise<void> {
		if (this.stagehand) {
			try {
				await this.stagehand.close();
			} catch (error) {
				console.error(`Error closing Stagehand session: ${error}`);
			}
			this.stagehand = null;
			this.initialized = false;
		}
	}
}

// Get the singleton instance
const sessionManager = StagehandSessionManager.getInstance();

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
					threadId: context.threadId,
					resourceId: context.resourceId,
				},
			},
		});
		return await performWebAction(url, action);
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
					threadId: context.threadId,
					resourceId: context.resourceId,
				},
			},
		});
		return await performWebObservation(url, instruction);
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
					threadId: context.threadId,
					resourceId: context.resourceId,
				},
			},
		});

		// Create a default schema if none is provided
		const defaultSchema = {
			content: z.string(),
		};

		return await performWebExtraction(
			url,
			instruction,
			(schema as Record<string, z.ZodTypeAny>) || defaultSchema,
			useTextExtract,
		);
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

const performWebAction = async (url?: string, action?: string) => {
	const stagehand = await sessionManager.ensureStagehand();
	const page = stagehand.page;

	try {
		// Navigate to the URL if provided
		if (url) {
			await page.goto(url);
		}

		// Perform the action
		if (action) {
			await page.act(action);
		}

		// Log success
		currentSpan().log({
			metadata: {
				success: true,
				actionPerformed: action,
			},
		});

		return {
			success: true,
			message: `Successfully performed: ${action}`,
		};
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
		throw new Error(`Stagehand action failed: ${errorMessage}`);
	}
};

const performWebObservation = async (url?: string, instruction?: string) => {
	console.log(`Starting observation${url ? ` for ${url}` : ""} with instruction: ${instruction}`);

	try {
		const stagehand = await sessionManager.ensureStagehand();
		if (!stagehand) {
			console.error("Failed to get Stagehand instance");
			throw new Error("Failed to get Stagehand instance");
		}

		const page = stagehand.page;
		if (!page) {
			console.error("Page not available");
			throw new Error("Page not available");
		}

		try {
			// Navigate to the URL if provided
			if (url) {
				console.log(`Navigating to ${url}`);
				await page.goto(url);
				console.log(`Successfully navigated to ${url}`);
			}

			// Observe the page
			if (instruction) {
				console.log(`Observing with instruction: ${instruction}`);
				try {
					const actions = await page.observe(instruction);
					console.log(`Observation successful, found ${actions.length} actions`);
					// Log observation results
					currentSpan().log({
						metadata: {
							actionsFound: actions.length,
							instruction,
						},
					});
					return actions;
				} catch (observeError) {
					console.error("Error during observation:", observeError);
					throw observeError;
				}
			}

			return [];
		} catch (pageError) {
			console.error("Error in page operation:", pageError);
			throw pageError;
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`Full stack trace for observation error:`, error);
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
		throw new Error(`Stagehand observation failed: ${errorMessage}`);
	}
};

const performWebExtraction = async (
	url?: string,
	instruction?: string,
	schemaObj?: Record<string, z.ZodTypeAny>,
	useTextExtract?: boolean,
) => {
	console.log(`Starting extraction${url ? ` for ${url}` : ""} with instruction: ${instruction}`);

	try {
		const stagehand = await sessionManager.ensureStagehand();
		const page = stagehand.page;

		try {
			// Navigate to the URL if provided
			if (url) {
				console.log(`Navigating to ${url}`);
				await page.goto(url);
				console.log(`Successfully navigated to ${url}`);
			}

			// Extract data
			if (instruction) {
				console.log(`Extracting with instruction: ${instruction}`);

				// Create a default schema if none is provided from Mastra Agent
				const finalSchemaObj = schemaObj || { content: z.string() };

				try {
					const schema = z.object(finalSchemaObj);

					const result = await page.extract({
						instruction,
						schema,
						useTextExtract,
					});

					console.log(`Extraction successful:`, result);
					// Log extraction results
					currentSpan().log({
						metadata: {
							extractionSuccessful: true,
							instruction,
							useTextExtract: !!useTextExtract,
						},
					});
					return result;
				} catch (extractError) {
					console.error("Error during extraction:", extractError);
					throw extractError;
				}
			}

			return null;
		} catch (pageError) {
			console.error("Error in page operation:", pageError);
			throw pageError;
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`Full stack trace for extraction error:`, error);
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
		throw new Error(`Stagehand extraction failed: ${errorMessage}`);
	}
};

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
		try {
			// Log metadata
			currentSpan().log({
				metadata: {
					url,
					contextInfo: {
						threadId: context.threadId,
						resourceId: context.resourceId,
					},
				},
			});

			const stagehand = await sessionManager.ensureStagehand();

			// Navigate to the URL
			await stagehand.page.goto(url);

			// Get page title and current URL
			const title = await stagehand.page.evaluate(() => document.title);
			const currentUrl = await stagehand.page.evaluate(() => window.location.href);

			// Log success
			currentSpan().log({
				metadata: {
					success: true,
					title,
					currentUrl,
				},
			});

			return {
				success: true,
				title,
				currentUrl,
			};
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
