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
 * export const myTool = createTool<RuntimeContext>((context) => ({
 *   description: "My tool description",
 *   inputSchema: z.object({
 *     query: z.string(),
 *   }),
 *   execute: async ({ query }) => {
 *     // Access runtime context here
 *     console.log("Thread ID:", context.threadId);
 *     console.log("User ID:", context.userId);
 *
 *     // Tool implementation
 *     return { result: `Processed ${query}` };
 *   },
 * }));
 * ```
 */
export function createTool<
	TRuntimeContext = unknown,
	TInputSchema extends z.ZodType = z.ZodType,
	TOutputSchema extends z.ZodType = z.ZodType,
>(
	toolDefinition: (context: TRuntimeContext) => {
		description: string;
		inputSchema: TInputSchema;
		outputSchema?: TOutputSchema;
		execute: (
			input: z.infer<TInputSchema>,
		) =>
			| Promise<TOutputSchema extends z.ZodType ? z.infer<TOutputSchema> : unknown>
			| (TOutputSchema extends z.ZodType ? z.infer<TOutputSchema> : unknown);
	},
): ToolFactory<TRuntimeContext> {
	return (context: TRuntimeContext) => {
		const config = toolDefinition(context);
		// The AI SDK's tool function expects a specific format, we need to cast through unknown
		return aiTool(config as unknown as Parameters<typeof aiTool>[0]);
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
