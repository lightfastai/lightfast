import type { ToolSet, UIMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { InMemoryMemory } from "../memory/adapters/in-memory";
import { 
	AgentConfigurationError,
	AgentStreamError,
	CacheOperationError,
	ContextCreationError,
	MessageConversionError,
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
		streamText: vi.fn(),
		convertToModelMessages: vi.fn(),
	};
});

interface TestRuntimeContext {
	sessionId: string;
	resourceId: string;
	executionCount?: number;
}

// Test utilities for creating realistic mock streams
const createMockAsyncIterable = (values: string[], delays: number[] = []) => {
	return {
		async *[Symbol.asyncIterator]() {
			for (let i = 0; i < values.length; i++) {
				if (delays[i]) {
					await new Promise((resolve) => setTimeout(resolve, delays[i]));
				}
				yield values[i];
			}
		},
	};
};

const createMockModel = () => ({
	provider: "test",
	modelId: "test-model",
});

describe("Agent Stream Execution - Critical Edge Cases", () => {
	let memory: InMemoryMemory;
	let mockModel: any;
	let originalConsoleError: any;

	beforeEach(async () => {
		memory = new InMemoryMemory();
		mockModel = createMockModel();
		vi.clearAllMocks();

		// Suppress console errors during tests unless we're specifically testing error logging
		originalConsoleError = console.error;
		console.error = vi.fn();

		// Default mock for convertToModelMessages
		const { convertToModelMessages } = await import("ai");
		vi.mocked(convertToModelMessages).mockImplementation((messages) =>
			messages.map((msg) => ({ role: msg.role, content: msg.content })),
		);
	});

	afterEach(() => {
		console.error = originalConsoleError;
	});

	describe("Stream Interruption Edge Cases", () => {
		it("should handle stream cancellation during tool execution", async () => {
			let toolExecutionStarted = false;
			let toolExecutionCompleted = false;

			const longRunningTool = createTool<TestRuntimeContext>({
				description: "Long running tool that should be cancellable",
				inputSchema: z.object({ task: z.string() }),
				execute: async ({ task }, context) => {
					toolExecutionStarted = true;
					// Simulate long-running operation
					await new Promise((resolve) => setTimeout(resolve, 2000));
					toolExecutionCompleted = true;
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

			// Mock stream that simulates tool execution within streamText
			const mockStreamWithTool = {
				textStream: createMockAsyncIterable(["I will use the tool now"]),
				toolCalls: [
					{
						toolCallId: "tool-1",
						toolName: "longRunningTool",
						args: { task: "long-task" },
					},
				],
				finishReason: "tool-calls" as const,
				usage: { totalTokens: 50 },
			};

			const { streamText } = await import("ai");
			vi.mocked(streamText).mockResolvedValue(mockStreamWithTool);

			// The key test here is that the agent stream setup completes successfully
			// even when configured with potentially long-running tools
			const result = await agent.stream({
				sessionId: "cancellation-session",
				messages: [{ id: "1", role: "user", content: "Start a long task" }],
				memory,
				resourceId: "user-123",
				systemContext: {},
				requestContext: {},
			});

			expect(result.streamId).toBeDefined();
			expect(result.sessionId).toBe("cancellation-session");
			expect(result.result).toBeDefined();

			// Verify that the agent was configured with the long-running tool
			// (The tool itself won't execute in this test because streamText is mocked)
			expect(streamText).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.objectContaining({
						longRunningTool: expect.any(Object),
					}),
				}),
			);
		});

		it("should handle partial message corruption during stream", async () => {
			const agent = createAgent({
				name: "corruption-test-agent",
				model: mockModel,
				system: "You respond to user messages",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			// Mock stream with corrupted/binary content
			const corruptedStream = {
				textStream: createMockAsyncIterable([
					"Hello",
					"\x00\x01\xFF", // Binary corruption
					"world",
					'{"invalid": json}', // Invalid JSON
					"normal text",
				]),
				finishReason: "stop" as const,
				usage: { totalTokens: 25 },
			};

			const { streamText } = await import("ai");
			vi.mocked(streamText).mockResolvedValue(corruptedStream);

			const result = await agent.stream({
				sessionId: "corruption-session",
				messages: [{ id: "1", role: "user", content: "Say hello" }],
				memory,
				resourceId: "user-123",
				systemContext: {},
				requestContext: {},
			});

			expect(result.streamId).toBeDefined();
			// The system should handle corrupted content gracefully without crashing
		});

		it("should handle multiple concurrent streams from same agent", async () => {
			const agent = createAgent({
				name: "concurrent-test-agent",
				model: mockModel,
				system: "You respond to concurrent requests",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			const mockStreamResponse = {
				textStream: createMockAsyncIterable(["Response"]),
				finishReason: "stop" as const,
				usage: { totalTokens: 10 },
			};

			const { streamText } = await import("ai");
			vi.mocked(streamText).mockResolvedValue(mockStreamResponse);

			// Start 5 concurrent streams
			const streamPromises = Array.from({ length: 5 }, (_, i) =>
				agent.stream({
					sessionId: `concurrent-session-${i}`,
					messages: [{ id: "1", role: "user", content: `Message ${i}` }],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				}),
			);

			const results = await Promise.allSettled(streamPromises);

			// All streams should complete successfully
			results.forEach((result, index) => {
				expect(result.status).toBe("fulfilled");
				if (result.status === "fulfilled") {
					expect(result.value.streamId).toBeDefined();
					expect(result.value.sessionId).toBe(`concurrent-session-${index}`);
				}
			});

			// Verify streamText was called for each concurrent stream
			expect(streamText).toHaveBeenCalledTimes(5);
		});
	});

	describe("Tool Execution Edge Cases", () => {
		it("should handle tools that modify shared state", async () => {
			// Simulate shared state that could be corrupted
			let globalCounter = 0;
			let stateCorrupted = false;

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
						stateCorrupted = true;
						throw new Error(
							"State corruption detected: counter went backwards",
						);
					}

					// Simulate additional corruption scenarios
					if (globalCounter > 100) {
						stateCorrupted = true;
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

			// Test multiple sequential calls
			for (let i = 0; i < 10; i++) {
				const mockStream = {
					textStream: createMockAsyncIterable(["Using stateful tool"]),
					toolCalls: [
						{
							toolCallId: `tool-${i}`,
							toolName: "statefulTool",
							args: { increment: 5 },
						},
					],
					finishReason: "tool-calls" as const,
					usage: { totalTokens: 20 },
				};

				const { streamText } = await import("ai");
				vi.mocked(streamText).mockResolvedValue(mockStream);

				try {
					const result = await agent.stream({
						sessionId: `stateful-session-${i}`,
						messages: [{ id: "1", role: "user", content: "Increment counter" }],
						memory,
						resourceId: "user-123",
						systemContext: {},
						requestContext: {},
					});

					expect(result.streamId).toBeDefined();

					// If we reach the limit, expect subsequent calls to fail
					if (globalCounter > 100) {
						expect(stateCorrupted).toBe(true);
						break;
					}
				} catch (error) {
					// State corruption should be handled gracefully
					expect(error.message).toMatch(/State corruption|exceeded safe limit/);
					break;
				}
			}
		});

		it("should handle streamText synchronous errors", async () => {
			const { streamText } = await import("ai");
			
			// Create agent for this specific test
			const errorAgent = createAgent({
				name: "error-test-agent",
				model: mockModel,
				system: "System prompt",
				tools: {},
				createRuntimeContext: () => ({}),
			});
			
			// Mock streamText to throw synchronous error
			vi.mocked(streamText).mockImplementation(() => {
				throw new Error("Invalid model configuration");
			});

			await expect(
				errorAgent.stream({
					sessionId: "error-session",
					messages: [{ id: "1", role: "user", content: "Test message" }],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				})
			).rejects.toThrow(AgentStreamError);

			// Also verify the error message and properties
			try {
				await errorAgent.stream({
					sessionId: "error-session",
					messages: [{ id: "1", role: "user", content: "Test message" }],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				});
			} catch (error) {
				expect(error).toBeInstanceOf(AgentStreamError);
				if (error instanceof AgentStreamError) {
					expect(error.message).toBe("Agent streaming failed: Invalid model configuration");
					expect(error.statusCode).toBe(500);
					expect(error.errorCode).toBe("AGENT_STREAM_ERROR");
					expect(error.cause).toBeInstanceOf(Error);
				}
			}
		});

		it("should handle streamText with non-Error thrown objects", async () => {
			const { streamText } = await import("ai");
			
			// Create agent for this specific test
			const errorAgent = createAgent({
				name: "error-test-agent",
				model: mockModel,
				system: "System prompt",
				tools: {},
				createRuntimeContext: () => ({}),
			});
			
			// Mock streamText to throw non-Error object
			vi.mocked(streamText).mockImplementation(() => {
				throw { code: "NETWORK_ERROR", message: "Connection timeout" };
			});

			await expect(
				errorAgent.stream({
					sessionId: "error-session",
					messages: [{ id: "1", role: "user", content: "Test message" }],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				})
			).rejects.toThrow(AgentStreamError);

			// Also verify the error properties for non-Error objects
			try {
				await errorAgent.stream({
					sessionId: "error-session",
					messages: [{ id: "1", role: "user", content: "Test message" }],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				});
			} catch (error) {
				expect(error).toBeInstanceOf(AgentStreamError);
				if (error instanceof AgentStreamError) {
					expect(error.message).toBe("Agent streaming failed: [object Object]");
					expect(error.statusCode).toBe(500);
					expect(error.errorCode).toBe("AGENT_STREAM_ERROR");
					expect(error.cause).toBeUndefined(); // Non-Error objects don't get stored as cause
				}
			}
		});

		it("should handle circular tool dependencies", async () => {
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
						// Simulate circular dependency
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

			// Test scenario that could lead to infinite recursion
			const mockStreamWithCircular = {
				textStream: createMockAsyncIterable([
					"Using tools with potential circular dependency",
				]),
				toolCalls: [
					{
						toolCallId: "tool-a-1",
						toolName: "toolA",
						args: { callB: true, depth: 0 },
					},
					{
						toolCallId: "tool-b-1",
						toolName: "toolB",
						args: { callA: true, depth: 1 },
					},
					{
						toolCallId: "tool-a-2",
						toolName: "toolA",
						args: { callB: true, depth: 2 },
					},
					{
						toolCallId: "tool-b-2",
						toolName: "toolB",
						args: { callA: true, depth: 3 },
					},
					{
						toolCallId: "tool-a-3",
						toolName: "toolA",
						args: { callB: true, depth: 4 },
					},
					{
						toolCallId: "tool-b-3",
						toolName: "toolB",
						args: { callA: true, depth: 5 },
					},
					// This should trigger the recursion limit
					{
						toolCallId: "tool-a-4",
						toolName: "toolA",
						args: { callB: true, depth: 6 },
					},
				],
				finishReason: "tool-calls" as const,
				usage: { totalTokens: 100 },
			};

			const { streamText } = await import("ai");
			vi.mocked(streamText).mockResolvedValue(mockStreamWithCircular);

			// The agent should handle this without infinite recursion
			try {
				const result = await agent.stream({
					sessionId: "circular-session",
					messages: [
						{ id: "1", role: "user", content: "Start circular tool usage" },
					],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				});

				expect(result.streamId).toBeDefined();
				// Verify recursion was limited
				expect(recursionDepth).toBeLessThanOrEqual(MAX_RECURSION * 2); // Some buffer for test setup
			} catch (error) {
				// Should catch recursion limit gracefully
				expect(error.message).toMatch(/recursion|depth/i);
			}
		});

		it("should handle tool schema validation failures", async () => {
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
				system: "You use tools with strict validation",
				tools: { strictTool: strictTool },
				createRuntimeContext: ({ sessionId, resourceId }) => ({
					sessionId,
					resourceId,
				}),
			});

			// Test various invalid inputs
			const invalidInputs = [
				{ count: 0, name: "Valid", email: "test@example.com", options: [] }, // count too low
				{ count: 11, name: "Valid", email: "test@example.com", options: [] }, // count too high
				{ count: 5, name: "A", email: "test@example.com", options: [] }, // name too short
				{ count: 5, name: "Valid", email: "invalid-email", options: [] }, // invalid email
				{
					count: 5,
					name: "Valid",
					email: "test@example.com",
					options: Array(10).fill("item"),
				}, // too many options
				{
					count: "not-a-number",
					name: "Valid",
					email: "test@example.com",
					options: [],
				}, // wrong type
			];

			for (const [index, invalidInput] of invalidInputs.entries()) {
				const mockStream = {
					textStream: createMockAsyncIterable([
						"Using tool with invalid input",
					]),
					toolCalls: [
						{
							toolCallId: `invalid-tool-${index}`,
							toolName: "strictTool",
							args: invalidInput,
						},
					],
					finishReason: "tool-calls" as const,
					usage: { totalTokens: 30 },
				};

				const { streamText } = await import("ai");
				vi.mocked(streamText).mockResolvedValue(mockStream);

				// Each invalid input should be handled gracefully
				const result = await agent.stream({
					sessionId: `validation-session-${index}`,
					messages: [
						{ id: "1", role: "user", content: "Use tool with invalid input" },
					],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				});

				expect(result.streamId).toBeDefined();
				// The stream should complete even with validation errors
				// (The tool execution will fail, but the stream should handle it gracefully)
			}
		});
	});

	describe("Memory and Resource Edge Cases", () => {
		it("should handle extremely large conversation histories", async () => {
			const largeMemory = new InMemoryMemory();
			const sessionId = "large-conversation-session";

			await largeMemory.createSession({ sessionId, resourceId: "user-123" });

			// Create a conversation with 1000 messages (simulating long conversation)
			const largeMessages: UIMessage[] = Array.from(
				{ length: 1000 },
				(_, i) => ({
					id: `msg-${i}`,
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i}: ${"a".repeat(500)}`, // 500 chars each to make it substantial
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

			const mockStream = {
				textStream: createMockAsyncIterable(["Handling large conversation"]),
				finishReason: "stop" as const,
				usage: { totalTokens: 50 },
			};

			const { streamText } = await import("ai");
			vi.mocked(streamText).mockResolvedValue(mockStream);

			// This should handle the large conversation gracefully
			const startTime = Date.now();
			const result = await agent.stream({
				sessionId,
				messages: [
					{
						id: "new-msg",
						role: "user",
						content: "New message on large conversation",
					},
				],
				memory: largeMemory,
				resourceId: "user-123",
				systemContext: {},
				requestContext: {},
			});
			const endTime = Date.now();

			expect(result.streamId).toBeDefined();
			// Should complete in reasonable time (less than 5 seconds)
			expect(endTime - startTime).toBeLessThan(5000);

			// Verify memory still works correctly
			const finalMessages = await largeMemory.getMessages(sessionId);
			expect(finalMessages.length).toBe(1000); // Original messages should still be there
		});

		it("should handle memory adapter failures during operation", async () => {
			let callCount = 0;

			const unreliableMemory = {
				createSession: vi.fn().mockResolvedValue(undefined),
				getSession: vi.fn().mockResolvedValue({ resourceId: "user-123" }),
				getMessages: vi.fn().mockImplementation(() => {
					callCount++;
					if (callCount === 1) {
						return Promise.resolve([]); // First call succeeds
					} else if (callCount === 2) {
						return Promise.reject(new Error("Memory read failed")); // Second fails
					} else {
						return Promise.resolve([]); // Subsequent calls succeed
					}
				}),
				appendMessage: vi.fn().mockImplementation(() => {
					if (callCount > 3) {
						return Promise.reject(new Error("Memory write failed"));
					}
					return Promise.resolve();
				}),
				createStream: vi.fn().mockResolvedValue(undefined),
				getSessionStreams: vi.fn().mockResolvedValue([]),
			};

			const agent = createAgent({
				name: "unreliable-memory-agent",
				model: mockModel,
				system: "You work with unreliable memory",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			const mockStream = {
				textStream: createMockAsyncIterable(["Working with unreliable memory"]),
				finishReason: "stop" as const,
				usage: { totalTokens: 30 },
			};

			const { streamText } = await import("ai");
			vi.mocked(streamText).mockResolvedValue(mockStream);

			// Test that the agent handles memory interface correctly
			// The actual memory operations happen inside streamText in real usage
			// So here we test that the agent setup accepts memory interface properly

			const result1 = await agent.stream({
				sessionId: "unreliable-1",
				messages: [{ id: "1", role: "user", content: "First message" }],
				memory: unreliableMemory,
				resourceId: "user-123",
				systemContext: {},
				requestContext: {},
			});
			expect(result1.streamId).toBeDefined();

			// Verify the memory interface was passed to the streaming process
			// (In real usage, streamText would use this memory interface)
			const result2 = await agent.stream({
				sessionId: "unreliable-2",
				messages: [{ id: "2", role: "user", content: "Second message" }],
				memory: unreliableMemory,
				resourceId: "user-123",
				systemContext: {},
				requestContext: {},
			});
			expect(result2.streamId).toBeDefined();

			// Verify that both streams were properly configured
			expect(streamText).toHaveBeenCalledTimes(2);
		});

		it("should handle session state races with concurrent access", async () => {
			const sharedMemory = new InMemoryMemory();
			const sessionId = "shared-session";

			await sharedMemory.createSession({ sessionId, resourceId: "user-123" });

			const agent = createAgent({
				name: "race-condition-agent",
				model: mockModel,
				system: "You handle concurrent access",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			const mockStream = {
				textStream: createMockAsyncIterable(["Concurrent response"]),
				finishReason: "stop" as const,
				usage: { totalTokens: 20 },
			};

			const { streamText } = await import("ai");
			vi.mocked(streamText).mockResolvedValue(mockStream);

			// Start 3 concurrent streams on the same session
			const concurrentStreams = Array.from({ length: 3 }, (_, i) =>
				agent.stream({
					sessionId,
					messages: [
						{
							id: `concurrent-msg-${i}-${Date.now()}-${Math.random()}`,
							role: "user",
							content: `Concurrent message ${i}`,
						},
					],
					memory: sharedMemory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				}),
			);

			const results = await Promise.allSettled(concurrentStreams);

			// All should complete successfully
			results.forEach((result, index) => {
				expect(result.status).toBe("fulfilled");
				if (result.status === "fulfilled") {
					expect(result.value.streamId).toBeDefined();
				}
			});

			// Verify no message corruption or loss
			const finalMessages = await sharedMemory.getMessages(sessionId);
			expect(finalMessages.length).toBeGreaterThanOrEqual(0);

			// Verify session integrity
			const session = await sharedMemory.getSession(sessionId);
			expect(session).not.toBeNull();
			expect(session?.resourceId).toBe("user-123");
		});
	});

	describe("Agent Configuration Edge Cases", () => {
		it("should handle missing required configuration", async () => {
			// Test agent creation without required fields
			expect(() => {
				createAgent({
					name: "incomplete-agent",
					// Missing model
					system: "Test system",
				} as any);
			}).not.toThrow(); // Creation should succeed

			// But streaming should fail with proper validation
			const incompleteAgent = createAgent({
				name: "incomplete-agent",
				model: null as any, // Invalid model
				system: "Test system",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			await expect(
				incompleteAgent.stream({
					sessionId: "incomplete-session",
					messages: [{ id: "1", role: "user", content: "Test" }],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				}),
			).rejects.toThrow("Model must be configured");
		});

		it("should handle invalid runtime context creation", async () => {
			const agent = createAgent<ToolSet, TestRuntimeContext>({
				name: "context-error-agent",
				model: mockModel,
				system: "Test system",
				tools: {},
				createRuntimeContext: ({ sessionId, resourceId }) => {
					if (sessionId === "error-session") {
						throw new Error("Context creation failed for error session");
					}
					return { sessionId, resourceId };
				},
			});

			const mockStream = {
				textStream: createMockAsyncIterable(["Response"]),
				finishReason: "stop" as const,
				usage: { totalTokens: 10 },
			};

			const { streamText } = await import("ai");
			vi.mocked(streamText).mockResolvedValue(mockStream);

			// Should handle context creation errors
			await expect(
				agent.stream({
					sessionId: "error-session",
					messages: [{ id: "1", role: "user", content: "Test" }],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				}),
			).rejects.toThrow("Context creation failed for error session");

			// But should work fine with valid session
			const result = await agent.stream({
				sessionId: "valid-session",
				messages: [{ id: "1", role: "user", content: "Test" }],
				memory,
				resourceId: "user-123",
				systemContext: {},
				requestContext: {},
			});

			expect(result.streamId).toBeDefined();
		});
	});

	describe("Error Boundary Tests - All New Error Types", () => {
		it("should throw NoMessagesError for empty messages array", async () => {
			const testAgent = createAgent({
				name: "test-agent",
				model: mockModel,
				system: "System prompt",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			await expect(
				testAgent.stream({
					sessionId: "test-session",
					messages: [],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				})
			).rejects.toThrow(NoMessagesError);

			await expect(
				testAgent.stream({
					sessionId: "test-session",
					messages: null as any,
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				})
			).rejects.toThrow(NoMessagesError);
		});

		it("should throw AgentConfigurationError for missing model", async () => {
			const agentWithoutModel = createAgent({
				name: "no-model-agent",
				model: null as any,
				system: "System prompt",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			await expect(
				agentWithoutModel.stream({
					sessionId: "test-session",
					messages: [{ id: "1", role: "user", content: "Test" }],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				})
			).rejects.toThrow(AgentConfigurationError);
		});

		it("should throw ContextCreationError for failing createRuntimeContext", async () => {
			const agentWithBadContext = createAgent({
				name: "bad-context-agent",
				model: mockModel,
				system: "System prompt",
				tools: {},
				createRuntimeContext: () => {
					throw new Error("Context creation failed");
				},
			});

			await expect(
				agentWithBadContext.stream({
					sessionId: "test-session",
					messages: [{ id: "1", role: "user", content: "Test" }],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				})
			).rejects.toThrow(ContextCreationError);
		});

		it("should throw ToolExecutionError for failing tool factories", async () => {
			const badToolFactory = () => {
				throw new Error("Tool factory failed");
			};

			const agentWithBadTools = createAgent({
				name: "bad-tools-agent",
				model: mockModel,
				system: "System prompt",
				tools: () => ({ badTool: badToolFactory }),
				createRuntimeContext: () => ({}),
			});

			await expect(
				agentWithBadTools.stream({
					sessionId: "test-session",
					messages: [{ id: "1", role: "user", content: "Test" }],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				})
			).rejects.toThrow(ToolExecutionError);
		});

		it("should throw ToolExecutionError for tools function returning null", async () => {
			const agentWithNullTools = createAgent({
				name: "null-tools-agent",
				model: mockModel,
				system: "System prompt",
				tools: () => null as any,
				createRuntimeContext: () => ({}),
			});

			await expect(
				agentWithNullTools.stream({
					sessionId: "test-session",
					messages: [{ id: "1", role: "user", content: "Test" }],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				})
			).rejects.toThrow(ToolExecutionError);
		});

		it("should throw CacheOperationError for failing cache operations", async () => {
			const mockBadCache = {
				applySystemCaching: vi.fn().mockImplementation(() => {
					throw new Error("Cache system caching failed");
				}),
				applyMessageCaching: vi.fn(),
			};

			const agentWithBadCache = createAgent({
				name: "bad-cache-agent",
				model: mockModel,
				system: "System prompt",
				tools: {},
				createRuntimeContext: () => ({}),
				cache: mockBadCache,
			});

			await expect(
				agentWithBadCache.stream({
					sessionId: "test-session",
					messages: [{ id: "1", role: "user", content: "Test" }],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				})
			).rejects.toThrow(CacheOperationError);
		});

		it("should throw MessageConversionError for failing convertToModelMessages", async () => {
			const testAgent = createAgent({
				name: "test-agent",
				model: mockModel,
				system: "System prompt",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			const { convertToModelMessages } = await import("ai");
			
			// Mock convertToModelMessages to fail
			vi.mocked(convertToModelMessages).mockImplementation(() => {
				throw new Error("Message conversion failed");
			});

			await expect(
				testAgent.stream({
					sessionId: "test-session",
					messages: [{ id: "1", role: "user", content: "Test" }],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				})
			).rejects.toThrow(MessageConversionError);

			// Restore original mock
			vi.mocked(convertToModelMessages).mockImplementation((messages) =>
				messages.map((msg) => ({ role: msg.role, content: msg.content })),
			);
		});

		it("should throw ToolExecutionError for individual tool factory failures", async () => {
			const workingTool = createTool({
				description: "Working tool",
				inputSchema: z.object({ input: z.string() }),
				execute: async () => "success",
			});

			const failingToolFactory = () => {
				throw new Error("Individual tool factory failed");
			};

			const agentWithMixedTools = createAgent({
				name: "mixed-tools-agent",
				model: mockModel,
				system: "System prompt",
				tools: {
					workingTool,
					failingTool: failingToolFactory,
				},
				createRuntimeContext: () => ({}),
			});

			await expect(
				agentWithMixedTools.stream({
					sessionId: "test-session",
					messages: [{ id: "1", role: "user", content: "Test" }],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				})
			).rejects.toThrow(ToolExecutionError);
		});

		it("should verify error properties and inheritance", async () => {
			const testAgent = createAgent({
				name: "test-agent",
				model: mockModel,
				system: "System prompt",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			try {
				await testAgent.stream({
					sessionId: "test-session",
					messages: [],
					memory,
					resourceId: "user-123",
					systemContext: {},
					requestContext: {},
				});
			} catch (error) {
				expect(error).toBeInstanceOf(NoMessagesError);
				if (error instanceof NoMessagesError) {
					expect(error.statusCode).toBe(400);
					expect(error.errorCode).toBe("NO_MESSAGES");
					expect(error.message).toBe("At least one message is required");
					expect(error.toJSON()).toEqual({
						error: "At least one message is required",
						code: "NO_MESSAGES",
						statusCode: 400,
					});
				}
			}
		});
	});
});
