import { type Tool as AiTool, tool as aiTool } from "ai";
import type { z } from "zod";

/**
 * A tool factory function that creates a tool with runtime context
 */
export type ToolFactory<TRuntimeContext = unknown> = (context: TRuntimeContext) => AiTool;

/**
 * Type for a collection of tool factories
 */
export type ToolFactorySet<TRuntimeContext = unknown> = Record<string, ToolFactory<TRuntimeContext>>;

/**
 * Creates a tool that injects runtime context
 *
 * This wrapper allows tools to access runtime context (like threadId, userId, etc.)
 * that is provided at request time rather than tool creation time.
 *
 * @example
 * ```typescript
 * export const myTool = createTool<RuntimeContext>({
 *   description: "My tool description",
 *   inputSchema: z.object({
 *     query: z.string(),
 *   }),
 *   execute: async ({ query }, context) => {
 *     // Direct access to runtime context
 *     console.log("Thread ID:", context.threadId);
 *     console.log("User ID:", context.resourceId);
 *
 *     // Tool implementation
 *     return { result: `Processed ${query}` };
 *   },
 * });
 * ```
 */
export function createTool<
	TRuntimeContext = unknown,
	TInputSchema extends z.ZodType = z.ZodType,
	TOutputSchema extends z.ZodType = z.ZodType,
>(config: {
	description: string;
	inputSchema: TInputSchema;
	outputSchema?: TOutputSchema;
	execute: (
		input: z.infer<TInputSchema>,
		context: TRuntimeContext,
	) => Promise<TOutputSchema extends z.ZodType ? z.infer<TOutputSchema> : unknown>
		| (TOutputSchema extends z.ZodType ? z.infer<TOutputSchema> : unknown);
}): ToolFactory<TRuntimeContext> {
	return (context: TRuntimeContext) => {
		return aiTool({
			description: config.description,
			inputSchema: config.inputSchema,
			outputSchema: config.outputSchema,
			execute: async (input: z.infer<TInputSchema>) => {
				// Inject the runtime context as the second parameter
				return config.execute(input, context);
			},
		} as unknown as Parameters<typeof aiTool>[0]);
	};
}

/**
 * Type helper to extract the runtime context type from a tool factory
 */
export type InferToolContext<T> = T extends ToolFactory<infer C> ? C : never;

/**
 * Type helper to extract the return type of a tool factory
 */
export type InferTool<T> = T extends ToolFactory<infer _> ? ReturnType<T> : never;
