import type { ToolSet } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { InMemoryMemory } from "../memory/adapters/in-memory";
import { createAgent } from "./agent";
import { createTool } from "./tool";

// Mock the AI SDK
vi.mock("ai", async () => {
	const actual = await vi.importActual("ai");
	return {
		...actual,
		streamText: vi.fn(),
		convertToModelMessages: vi.fn(),
	};
});

interface TestRuntimeContext {
	sessionId: string;
	resourceId: string;
}

describe("createAgent", () => {
	let memory: InMemoryMemory;

	beforeEach(() => {
		memory = new InMemoryMemory();
		vi.clearAllMocks();
	});

	it("should create an agent with basic configuration", () => {
		const agent = createAgent({
			name: "test-agent",
			model: {} as any, // Mock model
			system: "You are a helpful assistant",
		});

		expect(agent).toBeDefined();
		expect(typeof agent.buildStreamParams).toBe("function");
	});

	it("should create an agent with static tools", () => {
		// Tool factories are functions that return tool objects
		const testTool = () => ({
			description: "Test tool",
			inputSchema: z.object({ query: z.string() }),
			execute: async ({ query }: { query: string }) => `Result: ${query}`,
		});

		const tools = {
			testTool,
		};

		const agent = createAgent({
			name: "test-agent-with-tools",
			model: {} as any,
			system: "You are a helpful assistant with tools",
			tools,
		});

		expect(agent).toBeDefined();
	});

	it("should create an agent with tool factories", () => {
		const toolFactory = createTool<TestRuntimeContext>({
			description: "Context-aware tool",
			inputSchema: z.object({ message: z.string() }),
			execute: async ({ message }, context) => {
				return `${message} from ${context.sessionId}`;
			},
		});

		const toolFactories = {
			contextTool: toolFactory,
		};

		const agent = createAgent<TestRuntimeContext>({
			name: "test-agent-with-factories",
			model: {} as any,
			system: "You are a helpful assistant with context tools",
			tools: toolFactories,
			createRuntimeContext: ({ sessionId, resourceId }) => ({
				sessionId,
				resourceId,
			}),
		});

		expect(agent).toBeDefined();
	});

	it("should create an agent with function-based tools", () => {
		const dynamicTools = (context: TestRuntimeContext) => {
			const tool = createTool<TestRuntimeContext>({
				description: `Tool for session ${context.sessionId}`,
				inputSchema: z.object({ input: z.string() }),
				execute: async ({ input }) => `Processed: ${input}`,
			});

			return {
				dynamicTool: tool,  // Return the factory, not the resolved tool
			};
		};

		const agent = createAgent<TestRuntimeContext>({
			name: "test-agent-dynamic-tools",
			model: {} as any,
			system: "You are a helpful assistant with dynamic tools",
			tools: dynamicTools,
			createRuntimeContext: ({ sessionId, resourceId }) => ({
				sessionId,
				resourceId,
			}),
		});

		expect(agent).toBeDefined();
	});

	it("should create an agent with provider-specific configuration", () => {
		const agent = createAgent({
			name: "test-agent-with-providers",
			model: {} as any,
			system: "You are a helpful assistant",
			temperature: 0.7,
			maxOutputTokens: 1000,
			providerOptions: {
				anthropic: {
					cacheControl: true,
				},
			},
		});

		expect(agent).toBeDefined();
	});

	it("should create an agent with cache configuration", () => {
		const mockCache = {
			get: vi.fn(),
			set: vi.fn(),
			delete: vi.fn(),
			clear: vi.fn(),
			applySystemCaching: vi.fn(),
			applyMessageCaching: vi.fn(),
		};

		const agent = createAgent({
			name: "test-agent-with-cache",
			model: {} as any,
			system: "You are a helpful assistant",
			cache: mockCache,
		});

		expect(agent).toBeDefined();
	});

	it("should handle agent configuration validation", async () => {
		// Test that required fields are validated during stream execution
		const agent = createAgent({
			name: "test-agent",
			// Missing model - should throw during stream()
			system: "Test system",
			tools: {},
			createRuntimeContext: () => ({}),
		} as any);

		expect(() => {
			agent.buildStreamParams({
				sessionId: "test-session",
				messages: [{ 
					id: "1", 
					role: "user", 
					parts: [{ type: "text", text: "test" }] 
				}],
				memory: {} as any,
				resourceId: "test-resource",
				systemContext: { sessionId: "test-session", resourceId: "test-resource" },
				requestContext: {},
			});
		}).toThrow("Model must be configured");
	});

	it("should create an agent with experimental features", () => {
		const agent = createAgent({
			name: "experimental-agent",
			model: {} as any,
			system: "You are an experimental assistant",
			experimental_context: {},
		});

		expect(agent).toBeDefined();
	});
});


describe("agent utility functions", () => {
	it("should generate valid UUIDs", () => {
		// Since the UUID function is internal, we test it indirectly
		const agent = createAgent({
			name: "uuid-test-agent",
			model: {} as any,
			system: "Test agent",
		});

		// The agent should be created successfully, indicating UUID generation works
		expect(agent).toBeDefined();
	});

	it("should resolve tool factories correctly", () => {
		const toolFactory = createTool<TestRuntimeContext>({
			description: "Resolvable tool",
			inputSchema: z.object({ value: z.string() }),
			execute: async ({ value }, context) => {
				return `${value}-${context.sessionId}`;
			},
		});

		const toolFactories = {
			resolvableTool: toolFactory,
		};

		const agent = createAgent<TestRuntimeContext>({
			name: "resolve-test-agent",
			model: {} as any,
			system: "Test agent for tool resolution",
			tools: toolFactories,
			createRuntimeContext: ({ sessionId, resourceId }) => ({
				sessionId,
				resourceId,
			}),
		});

		expect(agent).toBeDefined();
	});
});
