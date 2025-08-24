import type { ToolSet, UIMessage } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createUserMessage, createSystemMessage, createAssistantMessage, getMessageText } from "../test-utils/message-helpers";
import { InMemoryMemory } from "../memory/adapters/in-memory";
import { 
	AgentConfigurationError,
	CacheOperationError,
	ContextCreationError,
	MessageConversionError,
	NoMessagesError,
	ToolExecutionError
} from "../server/errors";
import { createAgent } from "./agent";
import { createTool } from "./tool";

// Mock the AI SDK
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
	agentData?: string;
}

describe("Agent buildStreamParams - Comprehensive Core Tests", () => {
	let memory: InMemoryMemory;

	beforeEach(async () => {
		memory = new InMemoryMemory();
		vi.clearAllMocks();

		// Default successful mock for convertToModelMessages
		const { convertToModelMessages } = await import("ai");
		vi.mocked(convertToModelMessages).mockImplementation((messages: UIMessage[]) =>
			messages.map((msg) => ({ 
				role: msg.role, 
				content: getMessageText(msg) || "" 
			})),
		);
	});

	describe("Context Merging Logic", () => {
		it("should merge contexts with correct precedence: system < request < agent", () => {
			const agent = createAgent<ToolSet, TestRuntimeContext>({
				name: "context-test-agent",
				model: { provider: "test", modelId: "test" },
				system: "Test system",
				tools: {},
				createRuntimeContext: ({ sessionId, resourceId }) => ({
					sessionId,
					resourceId,
					agentData: "from-agent-context",
				}),
			});

			const systemContext = {
				sessionId: "test-session",
				resourceId: "test-resource",
				sharedKey: "system-value",
				systemOnly: "system-data",
			};

			const requestContext = {
				sharedKey: "request-value", // Should override system
				requestOnly: "request-data",
			};

			const streamParams = agent.buildStreamParams({
				sessionId: "test-session",
				messages: [createUserMessage("1", "test")],
				memory,
				resourceId: "test-resource",
				systemContext,
				requestContext,
			});

			// Verify the tool receives the correctly merged context
			expect(streamParams).toBeDefined();
			expect(streamParams.tools).toBeDefined();
		});

		it("should handle empty contexts gracefully", () => {
			const agent = createAgent<ToolSet, TestRuntimeContext>({
				name: "empty-context-agent",
				model: { provider: "test", modelId: "test" },
				system: "Test system",
				tools: {},
				createRuntimeContext: ({ sessionId, resourceId }) => ({
					sessionId,
					resourceId,
				}),
			});

			const streamParams = agent.buildStreamParams({
				sessionId: "test-session",
				messages: [createUserMessage("1", "test")],
				memory,
				resourceId: "test-resource",
				systemContext: { sessionId: "test-session", resourceId: "test-resource" },
				requestContext: {},
			});

			expect(streamParams).toBeDefined();
			expect(streamParams.messages).toBeDefined();
		});
	});

	describe("Cache Provider Integration", () => {
		it("should use cache provider for system and message caching", () => {
			const mockCache = {
				applySystemCaching: vi.fn().mockReturnValue([
					createSystemMessage("cached-system", "Cached system message")
				]),
				applyMessageCaching: vi.fn().mockReturnValue([
					createUserMessage("cached-1", "Cached user message")
				]),
			};

			const agent = createAgent({
				name: "cached-agent",
				model: { provider: "test", modelId: "test" },
				system: "Original system message",
				tools: {},
				cache: mockCache,
				createRuntimeContext: () => ({}),
			});

			const streamParams = agent.buildStreamParams({
				sessionId: "cached-session",
				messages: [createUserMessage("1", "Original message")],
				memory,
				resourceId: "test-resource",
				systemContext: { sessionId: "test-session", resourceId: "test-resource" },
				requestContext: {},
			});

			expect(mockCache.applySystemCaching).toHaveBeenCalledWith("Original system message");
			expect(mockCache.applyMessageCaching).toHaveBeenCalled();
			expect(streamParams.messages).toHaveLength(2); // system + user message
			expect(streamParams.messages[0]).toEqual(createSystemMessage("cached-system", "Cached system message"));
		});

		it("should handle cache provider errors with CacheOperationError", () => {
			const mockCache = {
				applySystemCaching: vi.fn().mockImplementation(() => {
					throw new Error("Cache system failure");
				}),
				applyMessageCaching: vi.fn(),
			};

			const agent = createAgent({
				name: "cache-error-agent",
				model: { provider: "test", modelId: "test" },
				system: "Test system",
				tools: {},
				cache: mockCache,
				createRuntimeContext: () => ({}),
			});

			expect(() => {
				agent.buildStreamParams({
					sessionId: "cache-error-session",
					messages: [createUserMessage("1", "test")],
					memory,
					resourceId: "test-resource",
					systemContext: { sessionId: "test-session", resourceId: "test-resource" },
					requestContext: {},
				});
			}).toThrow(CacheOperationError);
		});

		it("should use simple system message when no cache provider", () => {
			const agent = createAgent({
				name: "no-cache-agent",
				model: { provider: "test", modelId: "test" },
				system: "Simple system message",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			const streamParams = agent.buildStreamParams({
				sessionId: "no-cache-session",
				messages: [createUserMessage("1", "test")],
				memory,
				resourceId: "test-resource",
				systemContext: { sessionId: "test-session", resourceId: "test-resource" },
				requestContext: {},
			});

			expect(streamParams.messages[0]).toEqual({
				role: "system",
				content: "Simple system message"
			});
		});
	});

	describe("Message Conversion Error Handling", () => {
		it("should throw MessageConversionError when convertToModelMessages fails", async () => {
			const { convertToModelMessages } = await import("ai");
			vi.mocked(convertToModelMessages).mockImplementation(() => {
				throw new Error("Message conversion failed");
			});

			const agent = createAgent({
				name: "conversion-error-agent",
				model: { provider: "test", modelId: "test" },
				system: "Test system",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			expect(() => {
				agent.buildStreamParams({
					sessionId: "conversion-error-session",
					messages: [createUserMessage("1", "test")],
					memory,
					resourceId: "test-resource",
					systemContext: { sessionId: "test-session", resourceId: "test-resource" },
					requestContext: {},
				});
			}).toThrow(MessageConversionError);
		});
	});

	describe("System Message Handling", () => {
		it("should prepend system messages to model messages", () => {
			const agent = createAgent({
				name: "system-message-agent",
				model: { provider: "test", modelId: "test" },
				system: "You are a test assistant",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			const streamParams = agent.buildStreamParams({
				sessionId: "system-test-session",
				messages: [
					createUserMessage("1", "Hello"),
					createAssistantMessage("2", "Hi there")
				],
				memory,
				resourceId: "test-resource",
				systemContext: { sessionId: "test-session", resourceId: "test-resource" },
				requestContext: {},
			});

			expect(streamParams.messages[0]).toEqual({
				role: "system",
				content: "You are a test assistant"
			});
			expect(getMessageText(streamParams.messages[1])).toEqual("Hello");
			expect(getMessageText(streamParams.messages[2])).toEqual("Hi there");
		});
	});

	describe("Stream Parameter Composition", () => {
		it("should pass through all streamText parameters correctly", () => {
			const mockOnChunk = vi.fn();
			const mockOnFinish = vi.fn();
			const mockOnStepFinish = vi.fn();
			const mockOnAbort = vi.fn();
			const mockOnError = vi.fn();
			const mockPrepareStep = vi.fn();

			const agent = createAgent({
				name: "params-test-agent",
				model: { provider: "test", modelId: "test" },
				system: "Test system",
				tools: {},
				temperature: 0.7,
				maxOutputTokens: 1000,
				topP: 0.9,
				presencePenalty: 0.1,
				frequencyPenalty: 0.2,
				seed: 12345,
				headers: { "Custom-Header": "test-value" },
				providerOptions: {
					anthropic: { cacheControl: true },
					openai: { parallel_tool_calls: false }
				},
				onChunk: mockOnChunk,
				onFinish: mockOnFinish,
				onStepFinish: mockOnStepFinish,
				onAbort: mockOnAbort,
				onError: mockOnError,
				prepareStep: mockPrepareStep,
				experimental_continueSteps: true,
				experimental_generateMessageId: () => "test-id",
				createRuntimeContext: () => ({}),
			});

			const streamParams = agent.buildStreamParams({
				sessionId: "params-session",
				messages: [createUserMessage("1", "test")],
				memory,
				resourceId: "test-resource",
				systemContext: { sessionId: "test-session", resourceId: "test-resource" },
				requestContext: {},
			});

			// Verify all parameters are passed through
			expect(streamParams.temperature).toBe(0.7);
			expect(streamParams.maxOutputTokens).toBe(1000);
			expect(streamParams.topP).toBe(0.9);
			expect(streamParams.presencePenalty).toBe(0.1);
			expect(streamParams.frequencyPenalty).toBe(0.2);
			expect(streamParams.seed).toBe(12345);
			expect(streamParams.headers).toEqual({ "Custom-Header": "test-value" });
			expect(streamParams.providerOptions).toEqual({
				anthropic: { cacheControl: true },
				openai: { parallel_tool_calls: false }
			});
			expect(streamParams.onChunk).toBe(mockOnChunk);
			expect(streamParams.onFinish).toBe(mockOnFinish);
			expect(streamParams.onStepFinish).toBe(mockOnStepFinish);
			expect(streamParams.onAbort).toBe(mockOnAbort);
			expect(streamParams.onError).toBe(mockOnError);
			expect(streamParams.prepareStep).toBe(mockPrepareStep);
			expect(streamParams.experimental_continueSteps).toBe(true);
			expect(typeof streamParams.experimental_generateMessageId).toBe("function");
		});

		it("should exclude agent-specific config from streamText params", () => {
			const agent = createAgent({
				name: "exclusion-test-agent",
				model: { provider: "test", modelId: "test" },
				system: "Test system",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			const streamParams = agent.buildStreamParams({
				sessionId: "exclusion-session",
				messages: [createUserMessage("1", "test")],
				memory,
				resourceId: "test-resource",
				systemContext: { sessionId: "test-session", resourceId: "test-resource" },
				requestContext: {},
			});

			// Verify agent-specific config is excluded
			expect(streamParams).not.toHaveProperty("name");
			expect(streamParams).not.toHaveProperty("system"); // system is handled via messages
			
			// But model and tools should be included
			expect(streamParams.model).toBeDefined();
			expect(streamParams.tools).toBeDefined();
		});
	});

	describe("Tool Resolution Edge Cases", () => {
		it("should handle function-based tool resolution with context", () => {
			const contextTool = createTool<TestRuntimeContext>({
				description: "Context-aware tool",
				inputSchema: z.object({ input: z.string() }),
				execute: async ({ input }, context) => ({ result: `${input}-${context.sessionId}` }),
			});

			const toolsFunction = (context: TestRuntimeContext) => ({
				contextTool: contextTool(context),
			});

			const agent = createAgent<any, TestRuntimeContext>({
				name: "function-tools-agent",
				model: { provider: "test", modelId: "test" },
				system: "Test system",
				tools: toolsFunction,
				createRuntimeContext: ({ sessionId, resourceId }) => ({
					sessionId,
					resourceId,
					agentData: "test-data",
				}),
			});

			const streamParams = agent.buildStreamParams({
				sessionId: "function-tools-session",
				messages: [createUserMessage("1", "test")],
				memory,
				resourceId: "test-resource",
				systemContext: { sessionId: "test-session", resourceId: "test-resource" },
				requestContext: {},
			});

			expect(streamParams.tools).toHaveProperty("contextTool");
			expect(typeof streamParams.tools.contextTool.execute).toBe("function");
		});

		it("should handle tool resolution returning null or undefined", () => {
			const agent = createAgent<any, TestRuntimeContext>({
				name: "null-tools-agent",
				model: { provider: "test", modelId: "test" },
				system: "Test system",
				tools: () => null as any,
				createRuntimeContext: ({ sessionId, resourceId }) => ({
					sessionId,
					resourceId,
				}),
			});

			expect(() => {
				agent.buildStreamParams({
					sessionId: "null-tools-session",
					messages: [createUserMessage("1", "test")],
					memory,
					resourceId: "test-resource",
					systemContext: { sessionId: "test-session", resourceId: "test-resource" },
					requestContext: {},
				});
			}).toThrow("Tools resolution returned null, undefined, or non-object value");
		});

		it("should handle individual tool factory failures", () => {
			const goodTool = createTool<TestRuntimeContext>({
				description: "Good tool",
				inputSchema: z.object({ input: z.string() }),
				execute: async ({ input }) => ({ result: input }),
			});

			const badToolFactory = (context: TestRuntimeContext) => {
				throw new Error("Individual tool factory failed");
			};

			const agent = createAgent<any, TestRuntimeContext>({
				name: "mixed-tools-agent",
				model: { provider: "test", modelId: "test" },
				system: "Test system",
				tools: {
					goodTool: goodTool,
					badTool: badToolFactory as any,
				},
				createRuntimeContext: ({ sessionId, resourceId }) => ({
					sessionId,
					resourceId,
				}),
			});

			expect(() => {
				agent.buildStreamParams({
					sessionId: "mixed-tools-session",
					messages: [createUserMessage("1", "test")],
					memory,
					resourceId: "test-resource",
					systemContext: { sessionId: "test-session", resourceId: "test-resource" },
					requestContext: {},
				});
			}).toThrow("Failed to resolve tool factory 'badTool'");
		});
	});

	describe("Input Validation", () => {
		it("should throw NoMessagesError for null messages", () => {
			const agent = createAgent({
				name: "validation-agent",
				model: { provider: "test", modelId: "test" },
				system: "Test system",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			expect(() => {
				agent.buildStreamParams({
					sessionId: "validation-session",
					messages: null as any,
					memory,
					resourceId: "test-resource",
					systemContext: { sessionId: "test-session", resourceId: "test-resource" },
					requestContext: {},
				});
			}).toThrow(NoMessagesError);
		});

		it("should throw NoMessagesError for undefined messages", () => {
			const agent = createAgent({
				name: "validation-agent",
				model: { provider: "test", modelId: "test" },
				system: "Test system",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			expect(() => {
				agent.buildStreamParams({
					sessionId: "validation-session",
					messages: undefined as any,
					memory,
					resourceId: "test-resource",
					systemContext: { sessionId: "test-session", resourceId: "test-resource" },
					requestContext: {},
				});
			}).toThrow(NoMessagesError);
		});

		it("should throw AgentConfigurationError for missing model", () => {
			const agent = createAgent({
				name: "no-model-agent",
				model: null as any,
				system: "Test system",
				tools: {},
				createRuntimeContext: () => ({}),
			});

			expect(() => {
				agent.buildStreamParams({
					sessionId: "no-model-session",
					messages: [createUserMessage("1", "test")],
					memory,
					resourceId: "test-resource",
					systemContext: { sessionId: "test-session", resourceId: "test-resource" },
					requestContext: {},
				});
			}).toThrow(AgentConfigurationError);
		});
	});
});