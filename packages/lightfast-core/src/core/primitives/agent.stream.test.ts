import type { ToolSet, UIMessage } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { InMemoryMemory } from "../memory/adapters/in-memory";
import { 
	AgentConfigurationError,
	ContextCreationError,
	NoMessagesError,
	ToolExecutionError
} from "../server/errors";
import { createAgent } from "./agent";
import { createTool } from "./tool";

// Mock the AI SDK with more realistic behavior
vi.mock("ai", async () => {
	const actual = await vi.importActual("ai");
	return {
		...actual,
		convertToModelMessages: vi.fn(),
	};
});

interface TestRuntimeContext {
	sessionId: string;
	resourceId: string;
	executionCount?: number;
}

const createMockModel = () => ({
	provider: "test",
	modelId: "test-model",
});

describe("Agent buildStreamParams - Critical Edge Cases", () => {
	let memory: InMemoryMemory;
	let mockModel: any;

	beforeEach(async () => {
		memory = new InMemoryMemory();
		mockModel = createMockModel();
		vi.clearAllMocks();

		// Default mock for convertToModelMessages
		const { convertToModelMessages } = await import("ai");
		vi.mocked(convertToModelMessages).mockImplementation((messages) =>
			messages.map((msg) => ({ role: msg.role, content: msg.content })),
		);
	});

	describe("Stream Parameter Building Edge Cases", () => {
		it("should build stream params with cancellable tools", () => {
			const longRunningTool = createTool<TestRuntimeContext>({
				description: "Long running tool that should be cancellable",
				inputSchema: z.object({ task: z.string() }),
				execute: async ({ task }, context) => {
					// Simulate long-running operation
					await new Promise((resolve) => setTimeout(resolve, 2000));
					return { result: `Completed: ${task}` };
				},
			});

			const agent = createAgent<ToolSet, TestRuntimeContext>({
				name: "cancellation-test-agent",
				model: mockModel,
				system: "You can use tools to help users",
				tools: { longRunningTool: longRunningTool },
				createRuntimeContext: ({ sessionId, resourceId }) => ({
					sessionId,
					resourceId,
					executionCount: 0,
				}),
			});

			// The key test here is that the agent builds stream params successfully
			// even when configured with potentially long-running tools
			const streamParams = agent.buildStreamParams({
				sessionId: "cancellation-session",
				messages: [{ id: "1", role: "user", content: "Start a long task" }],
				memory,
				resourceId: "user-123",
				systemContext: {},
				requestContext: {},
			});

			expect(streamParams).toBeDefined();
			expect(streamParams.model).toBeDefined();
			expect(streamParams.messages).toBeDefined();
			expect(streamParams.tools).toBeDefined();

			// Verify that the stream params contain the long-running tool
			expect(streamParams.tools).toHaveProperty("longRunningTool");
			expect(streamParams.tools.longRunningTool).toHaveProperty("execute");
		});

		it("should build params for handling partial message corruption", () => {
			const agent = createAgent({
				name: "corruption-test-agent",
				model: mockModel,
				system: "You respond to user messages",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			const streamParams = agent.buildStreamParams({
				sessionId: "corruption-session",
				messages: [{ id: "1", role: "user", content: "Say hello" }],
				memory,
				resourceId: "user-123",
				systemContext: {},
				requestContext: {},
			});

			expect(streamParams).toBeDefined();
			expect(streamParams.model).toBeDefined();
			// The stream params should be valid even if content might be corrupted later
		});

		it("should build params for multiple concurrent streams from same agent", () => {
			const agent = createAgent({
				name: "concurrent-test-agent",
				model: mockModel,
				system: "You respond to concurrent requests",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			// Build params for 5 concurrent streams
			const streamParams = Array.from({ length: 5 }, (_, i) =>
				agent.buildStreamParams({
					sessionId: `concurrent-session-${i}`,
					messages: [{ id: "1", role: "user", content: `Message ${i}` }],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				}),
			);

			// All param builds should succeed
			expect(streamParams).toHaveLength(5);
			streamParams.forEach((params) => {
				expect(params.model).toBeDefined();
				expect(params.messages).toBeDefined();
				expect(params.tools).toBeDefined();
			});
		});
	});

	describe("Tool Configuration Edge Cases", () => {
		it("should configure tools that modify shared state", () => {
			let globalCounter = 0;

			const statefulTool = createTool<TestRuntimeContext>({
				description: "Tool that modifies global state",
				inputSchema: z.object({ increment: z.number() }),
				execute: async ({ increment }, context) => {
					const currentValue = globalCounter;
					// Simulate async operation that could cause race conditions
					await new Promise((resolve) =>
						setTimeout(resolve, Math.random() * 50),
					);

					globalCounter = currentValue + increment;

					// Check for state corruption (simple race condition detection)
					if (globalCounter < currentValue) {
						throw new Error(
							"State corruption detected: counter went backwards",
						);
					}

					// Simulate additional corruption scenarios
					if (globalCounter > 100) {
						throw new Error("State corruption: counter exceeded safe limit");
					}

					return {
						counter: globalCounter,
						contextInfo: `Session: ${context.sessionId}`,
					};
				},
			});

			const agent = createAgent<ToolSet, TestRuntimeContext>({
				name: "stateful-test-agent",
				model: mockModel,
				system: "You can increment counters",
				tools: { statefulTool: statefulTool },
				createRuntimeContext: ({ sessionId, resourceId }) => ({
					sessionId,
					resourceId,
				}),
			});

			// Test that stream params can be built multiple times with stateful tools
			for (let i = 0; i < 3; i++) {
				const streamParams = agent.buildStreamParams({
					sessionId: `stateful-session-${i}`,
					messages: [{ id: "1", role: "user", content: "Increment counter" }],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				});

				expect(streamParams).toBeDefined();
				expect(streamParams.tools).toHaveProperty("statefulTool");
				expect(streamParams.tools.statefulTool).toHaveProperty("execute");
				expect(typeof streamParams.tools.statefulTool.execute).toBe("function");
			}
		});

		it("should handle errors when building stream params", () => {
			// Create agent with invalid configuration
			const errorAgent = createAgent({
				name: "error-test-agent",
				model: null as any, // Invalid model
				system: "System prompt",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			// Building stream params should throw when model is invalid
			expect(() => {
				errorAgent.buildStreamParams({
					sessionId: "error-session",
					messages: [{ id: "1", role: "user", content: "Test message" }],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				});
			}).toThrow(AgentConfigurationError);
		});

		it("should handle errors in createRuntimeContext", () => {
			// Create agent with failing createRuntimeContext
			const errorAgent = createAgent({
				name: "error-test-agent",
				model: mockModel,
				system: "System prompt",
				tools: {},
				createRuntimeContext: () => {
					throw new Error("Context creation failed");
				},
			});

			// Building stream params should throw when context creation fails
			expect(() => {
				errorAgent.buildStreamParams({
					sessionId: "error-session",
					messages: [{ id: "1", role: "user", content: "Test message" }],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				});
			}).toThrow(ContextCreationError);
		});

		it("should configure tools with potential circular dependencies", () => {
			let recursionDepth = 0;
			const MAX_RECURSION = 5;

			const toolA = createTool<TestRuntimeContext>({
				description: "Tool A that can call Tool B",
				inputSchema: z.object({
					callB: z.boolean().optional(),
					depth: z.number().default(0),
				}),
				execute: async ({ callB, depth }, context) => {
					recursionDepth++;

					if (depth > MAX_RECURSION) {
						throw new Error("Maximum recursion depth exceeded");
					}

					if (callB) {
						// In a real scenario, this would somehow trigger Tool B
						// For testing, we simulate the circular dependency
						return {
							result: "A called B",
							depth: depth + 1,
							recursionDepth,
						};
					}
					return { result: "A completed", depth, recursionDepth };
				},
			});

			const toolB = createTool<TestRuntimeContext>({
				description: "Tool B that can call Tool A",
				inputSchema: z.object({
					callA: z.boolean().optional(),
					depth: z.number().default(0),
				}),
				execute: async ({ callA, depth }, context) => {
					recursionDepth++;

					if (depth > MAX_RECURSION) {
						throw new Error("Maximum recursion depth exceeded");
					}

					if (callA) {
						// In a real scenario, this would somehow trigger Tool A
						return {
							result: "B called A",
							depth: depth + 1,
							recursionDepth,
						};
					}
					return { result: "B completed", depth, recursionDepth };
				},
			});

			const agent = createAgent<ToolSet, TestRuntimeContext>({
				name: "circular-test-agent",
				model: mockModel,
				system: "You can use tools that might call each other",
				tools: { toolA: toolA, toolB: toolB },
				createRuntimeContext: ({ sessionId, resourceId }) => ({
					sessionId,
					resourceId,
				}),
			});

			// Test that stream params can be built with tools that have circular dependencies
			const streamParams = agent.buildStreamParams({
				sessionId: "circular-session",
				messages: [
					{ id: "1", role: "user", content: "Start circular tool usage" },
				],
				memory,
				resourceId: "user-123",
				systemContext: {},
				requestContext: {},
			});

			expect(streamParams).toBeDefined();
			expect(streamParams.tools).toHaveProperty("toolA");
			expect(streamParams.tools).toHaveProperty("toolB");
			// Both tools should be properly configured even with circular dependencies
			expect(typeof streamParams.tools.toolA.execute).toBe("function");
			expect(typeof streamParams.tools.toolB.execute).toBe("function");
		});

		it("should configure tools with strict schema validation", () => {
			const strictTool = createTool<TestRuntimeContext>({
				description: "Tool with strict validation",
				inputSchema: z.object({
					count: z.number().min(1).max(10),
					name: z.string().min(2).max(50),
					email: z.string().email(),
					options: z.array(z.string()).max(5),
				}),
				execute: async (validatedInput, context) => {
					return { result: "Validation passed", input: validatedInput };
				},
			});

			const agent = createAgent<ToolSet, TestRuntimeContext>({
				name: "validation-test-agent",
				model: mockModel,
				system: "You use tools with strict input requirements",
				tools: { strictTool: strictTool },
				createRuntimeContext: ({ sessionId, resourceId }) => ({
					sessionId,
					resourceId,
				}),
			});

			// Test various invalid inputs - these would fail at tool execution time
			const invalidInputs = [
				{ count: 0 }, // count too low
				{ count: 11 }, // count too high
				{ name: "a" }, // name too short
				{ email: "not-an-email" }, // invalid email
				{ options: Array(10).fill("opt") }, // too many options
			];

			for (const [index, invalidInput] of invalidInputs.entries()) {
				// Build stream params with tool configured
				const streamParams = agent.buildStreamParams({
					sessionId: `validation-session-${index}`,
					messages: [
						{ id: "1", role: "user", content: "Use tool with invalid input" },
					],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				});

				expect(streamParams).toBeDefined();
				expect(streamParams.tools).toHaveProperty("strictTool");
				// The tool should be configured even though validation might fail at execution
			}
		});
	});

	describe("Memory and Resource Edge Cases", () => {
		it("should build params with large conversation histories", async () => {
			const largeMemory = new InMemoryMemory();
			const sessionId = "large-conversation-session";

			await largeMemory.createSession({ sessionId, resourceId: "user-123" });

			// Create a conversation with many messages
			const largeMessages: UIMessage[] = Array.from(
				{ length: 100 },
				(_, i) => ({
					id: `msg-${i}`,
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i}`,
				}),
			);

			// Add all messages to memory
			for (const message of largeMessages) {
				await largeMemory.appendMessage({ sessionId, message });
			}

			const agent = createAgent({
				name: "memory-pressure-agent",
				model: mockModel,
				system: "You handle large conversations",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			// This should handle the large conversation gracefully
			const startTime = Date.now();
			const streamParams = agent.buildStreamParams({
				sessionId,
				messages: largeMessages.slice(-2), // Use only the last 2 messages for the immediate request
				memory: largeMemory,
				resourceId: "user-123",
				systemContext: {},
				requestContext: {},
			});
			const endTime = Date.now();

			expect(streamParams).toBeDefined();
			expect(streamParams.messages).toBeDefined();
			// Performance check: should build params within reasonable time
			expect(endTime - startTime).toBeLessThan(1000); // 1 second for param building
		});

		it("should handle empty message arrays", () => {
			const agent = createAgent({
				name: "empty-message-agent",
				model: mockModel,
				system: "You handle edge cases",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			// Should throw NoMessagesError when messages array is empty
			expect(() => {
				agent.buildStreamParams({
					sessionId: "empty-session",
					messages: [],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				});
			}).toThrow(NoMessagesError);
		});

		it("should handle tool factory errors", () => {
			const errorTool = (context: TestRuntimeContext) => {
				throw new Error("Tool factory failed");
			};

			const agent = createAgent<any, TestRuntimeContext>({
				name: "tool-factory-error-agent",
				model: mockModel,
				system: "You use tools",
				tools: { errorTool: errorTool as any },
				createRuntimeContext: ({ sessionId, resourceId }) => ({
					sessionId,
					resourceId,
				}),
			});

			// Should throw ToolExecutionError when tool factory fails
			expect(() => {
				agent.buildStreamParams({
					sessionId: "factory-error-session",
					messages: [{ id: "1", role: "user", content: "Test" }],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				});
			}).toThrow(ToolExecutionError);
		});
	});
});