import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createTool } from "./tool";

interface TestRuntimeContext {
	sessionId: string;
	resourceId: string;
}

describe("createTool", () => {
	it("should create a tool factory function", () => {
		const toolFactory = createTool<TestRuntimeContext>({
			description: "Test tool",
			inputSchema: z.object({
				message: z.string(),
			}),
			execute: ({ message }, context) => {
				return Promise.resolve({ result: `Hello ${message} from ${context.sessionId}` });
			},
		});

		expect(typeof toolFactory).toBe("function");
	});

	it("should create a tool that can be executed with runtime context", async () => {
		const toolFactory = createTool<TestRuntimeContext>({
			description: "Test tool",
			inputSchema: z.object({
				message: z.string(),
			}),
			execute: ({ message }, context) => {
				return Promise.resolve({ result: `Hello ${message} from ${context.sessionId}` });
			},
		});

		const context: TestRuntimeContext = {
			sessionId: "test-session-123",
			resourceId: "user-456",
		};

		const tool = toolFactory(context);

		// The aiTool has different properties - description is not directly accessible
		expect(typeof tool.execute).toBe("function");

		// Test tool execution
		const result = await tool.execute?.({ message: "world" }, { toolCallId: "test", messages: [] });
		expect(result).toEqual({ result: "Hello world from test-session-123" });
	});

	it("should validate input schema", async () => {
		const toolFactory = createTool<TestRuntimeContext>({
			description: "Test tool with validation",
			inputSchema: z.object({
				count: z.number().min(1).max(10),
				name: z.string().min(2),
			}),
			execute: ({ count, name }, _context) => {
				return Promise.resolve({ result: `${name}: ${count}` });
			},
		});

		const context: TestRuntimeContext = {
			sessionId: "test-session",
			resourceId: "test-user",
		};

		const tool = toolFactory(context);

		// Valid input should work
		const validResult = await tool.execute?.({ count: 5, name: "test" }, { toolCallId: "test", messages: [] });
		expect(validResult).toEqual({ result: "test: 5" });
	});

	it("should handle tools with output schema", async () => {
		const toolFactory = createTool<TestRuntimeContext>({
			description: "Tool with output schema",
			inputSchema: z.object({
				value: z.string(),
			}),
			outputSchema: z.object({
				processed: z.string(),
				timestamp: z.number(),
			}),
			execute: ({ value }, _context) => {
				return Promise.resolve({
					processed: value.toUpperCase(),
					timestamp: Date.now(),
				});
			},
		});

		const context: TestRuntimeContext = {
			sessionId: "test-session",
			resourceId: "test-user",
		};

		const tool = toolFactory(context);
		const result = await tool.execute?.({ value: "hello" }, { toolCallId: "test", messages: [] });

		expect(result).toMatchObject({
			processed: "HELLO",
			timestamp: expect.any(Number),
		});
	});

	it("should handle async execution", async () => {
		const toolFactory = createTool<TestRuntimeContext>({
			description: "Async tool",
			inputSchema: z.object({
				delay: z.number(),
			}),
			execute: async ({ delay }, context) => {
				await new Promise((resolve) => setTimeout(resolve, delay));
				return { completed: true, sessionId: context.sessionId };
			},
		});

		const context: TestRuntimeContext = {
			sessionId: "async-session",
			resourceId: "async-user",
		};

		const tool = toolFactory(context);
		const start = Date.now();
		const result = await tool.execute?.({ delay: 10 }, { toolCallId: "test", messages: [] });
		const end = Date.now();

		expect(result).toEqual({
			completed: true,
			sessionId: "async-session",
		});
		expect(end - start).toBeGreaterThanOrEqual(10);
	});

	it("should handle tools without runtime context", async () => {
		const toolFactory = createTool({
			description: "Simple tool",
			inputSchema: z.object({
				text: z.string(),
			}),
			execute: ({ text }) => {
				return Promise.resolve({ uppercase: text.toUpperCase() });
			},
		});

		const tool = toolFactory(undefined);
		const result = await tool.execute?.({ text: "hello world" }, { toolCallId: "test", messages: [] });

		expect(result).toEqual({ uppercase: "HELLO WORLD" });
	});
});
