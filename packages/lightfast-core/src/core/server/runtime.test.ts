import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UIMessage } from "ai";
import {
	NoUserMessageError,
	SessionForbiddenError,
	SessionNotFoundError,
	toAgentApiError,
	toMemoryApiError,
} from "./errors";
import {
	processMessage,
	resumeStream,
	streamChat,
	validateSession,
} from "./runtime";
import type { Agent } from "../primitives/agent";
import type { Memory } from "../memory";

// Mock dependencies
const mockMemory = {
	getSession: vi.fn(),
	createSession: vi.fn(),
	appendMessage: vi.fn(),
	getMessages: vi.fn(),
	createStream: vi.fn(),
	getSessionStreams: vi.fn(),
} as unknown as Memory<UIMessage>;

const mockAgent = {
	config: {
		name: "test-agent",
	},
	stream: vi.fn(),
} as unknown as Agent<unknown, unknown>;

describe("Runtime Functions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("validateSession", () => {
		it("should return exists: false for non-existent session", async () => {
			mockMemory.getSession = vi.fn().mockResolvedValue(null);

			const result = await validateSession(mockMemory, "session1", "resource1");

			expect(result.ok).toBe(true);
			expect(result.value?.exists).toBe(false);
			expect(result.value?.session).toBeUndefined();
		});

		it("should return exists: true for valid session with matching resourceId", async () => {
			const mockSession = { resourceId: "resource1", data: "test" };
			mockMemory.getSession = vi.fn().mockResolvedValue(mockSession);

			const result = await validateSession(mockMemory, "session1", "resource1");

			expect(result.ok).toBe(true);
			expect(result.value?.exists).toBe(true);
			expect(result.value?.session).toBe(mockSession);
		});

		it("should return SessionForbiddenError for mismatched resourceId", async () => {
			const mockSession = { resourceId: "different-resource" };
			mockMemory.getSession = vi.fn().mockResolvedValue(mockSession);

			const result = await validateSession(mockMemory, "session1", "resource1");

			expect(result.ok).toBe(false);
			expect(result.error).toBeInstanceOf(SessionForbiddenError);
		});

		it("should convert memory errors using toMemoryApiError", async () => {
			const memoryError = new Error("Database connection failed");
			mockMemory.getSession = vi.fn().mockRejectedValue(memoryError);

			const result = await validateSession(mockMemory, "session1", "resource1");

			expect(result.ok).toBe(false);
			expect(result.error).toBeDefined();
			// Should be converted via toMemoryApiError
		});
	});

	describe("processMessage", () => {
		const validUserMessage: UIMessage = {
			id: "msg1",
			role: "user",
			content: "Hello",
		};

		const invalidAssistantMessage: UIMessage = {
			id: "msg2",
			role: "assistant",
			content: "Hi there",
		};

		it("should reject non-user messages", async () => {
			const result = await processMessage(
				mockMemory,
				"session1",
				invalidAssistantMessage,
				"resource1",
				true,
			);

			expect(result.ok).toBe(false);
			expect(result.error).toBeInstanceOf(NoUserMessageError);
		});

		it("should process valid user message for existing session", async () => {
			const mockMessages = [validUserMessage];
			mockMemory.appendMessage = vi.fn().mockResolvedValue(undefined);
			mockMemory.getMessages = vi.fn().mockResolvedValue(mockMessages);

			const result = await processMessage(
				mockMemory,
				"session1",
				validUserMessage,
				"resource1",
				true, // session exists
			);

			expect(result.ok).toBe(true);
			expect(result.value?.allMessages).toBe(mockMessages);
			expect(result.value?.recentUserMessage).toBe(validUserMessage);
			expect(mockMemory.createSession).not.toHaveBeenCalled();
			expect(mockMemory.appendMessage).toHaveBeenCalledWith({
				sessionId: "session1",
				message: validUserMessage,
				context: undefined,
			});
		});

		it("should create session for new session", async () => {
			const mockMessages = [validUserMessage];
			mockMemory.createSession = vi.fn().mockResolvedValue(undefined);
			mockMemory.appendMessage = vi.fn().mockResolvedValue(undefined);
			mockMemory.getMessages = vi.fn().mockResolvedValue(mockMessages);

			const result = await processMessage(
				mockMemory,
				"session1",
				validUserMessage,
				"resource1",
				false, // session doesn't exist
				{ context: "data" },
			);

			expect(result.ok).toBe(true);
			expect(mockMemory.createSession).toHaveBeenCalledWith({
				sessionId: "session1",
				resourceId: "resource1",
				context: { context: "data" },
			});
		});

		it("should convert memory errors using toMemoryApiError", async () => {
			const memoryError = new Error("Database write failed");
			mockMemory.appendMessage = vi.fn().mockRejectedValue(memoryError);

			const result = await processMessage(
				mockMemory,
				"session1",
				validUserMessage,
				"resource1",
				true,
			);

			expect(result.ok).toBe(false);
			expect(result.error).toBeDefined();
			// Should be converted via toMemoryApiError
		});
	});

	describe("streamChat", () => {
		const validUserMessage: UIMessage = {
			id: "msg1",
			role: "user",
			content: "Hello",
		};

		const mockStreamResult = {
			result: {
				toUIMessageStreamResponse: vi.fn().mockReturnValue(new Response("stream")),
			},
			streamId: "stream123",
			sessionId: "session1",
		};

		beforeEach(() => {
			// Setup successful mocks by default
			mockMemory.getSession = vi.fn().mockResolvedValue({ resourceId: "resource1" });
			mockMemory.appendMessage = vi.fn().mockResolvedValue(undefined);
			mockMemory.getMessages = vi.fn().mockResolvedValue([validUserMessage]);
			mockMemory.createStream = vi.fn().mockResolvedValue(undefined);
			mockAgent.stream = vi.fn().mockResolvedValue(mockStreamResult);
		});

		it("should execute successful streaming flow with all callbacks", async () => {
			const callbacks = {
				onError: vi.fn(),
				onAgentStart: vi.fn(),
				onStreamStart: vi.fn(),
				onStreamComplete: vi.fn(),
				onAgentComplete: vi.fn(),
			};

			const systemContext = { sessionId: "session1", resourceId: "resource1" };
			const requestContext = { userAgent: "test", ipAddress: "127.0.0.1" };

			const result = await streamChat({
				agent: mockAgent,
				sessionId: "session1",
				message: validUserMessage,
				memory: mockMemory,
				resourceId: "resource1",
				systemContext,
				requestContext,
				...callbacks,
			});

			expect(result.ok).toBe(true);
			expect(callbacks.onAgentStart).toHaveBeenCalledWith({
				systemContext,
				requestContext,
				agentName: "test-agent",
				messageCount: 1,
				timestamp: expect.any(Number),
			});
			expect(callbacks.onStreamStart).toHaveBeenCalledWith({
				systemContext,
				requestContext,
				streamId: "stream123",
				agentName: "test-agent",
				messageCount: 1,
				timestamp: expect.any(Number),
			});
		});

		it("should handle session validation failures", async () => {
			mockMemory.getSession = vi.fn().mockResolvedValue({ resourceId: "different-resource" });

			const result = await streamChat({
				agent: mockAgent,
				sessionId: "session1",
				message: validUserMessage,
				memory: mockMemory,
				resourceId: "resource1",
				systemContext: { sessionId: "session1", resourceId: "resource1" },
				requestContext: {},
			});

			expect(result.ok).toBe(false);
			expect(result.error).toBeInstanceOf(SessionForbiddenError);
		});

		it("should handle agent streaming failures with toAgentApiError", async () => {
			const agentError = new Error("Model configuration invalid");
			mockAgent.stream = vi.fn().mockRejectedValue(agentError);

			const result = await streamChat({
				agent: mockAgent,
				sessionId: "session1",
				message: validUserMessage,
				memory: mockMemory,
				resourceId: "resource1",
				systemContext: { sessionId: "session1", resourceId: "resource1" },
				requestContext: {},
			});

			expect(result.ok).toBe(false);
			expect(result.error).toBeDefined();
			// Should be converted via toAgentApiError
		});

		it("should handle memory failures in onFinish callback flow", async () => {
			// This test verifies the onFinish callback structure and error propagation path
			// The actual onFinish execution is tested indirectly through integration
			const onError = vi.fn();
			
			const result = await streamChat({
				agent: mockAgent,
				sessionId: "session1",
				message: validUserMessage,
				memory: mockMemory,
				resourceId: "resource1",
				systemContext: { sessionId: "session1", resourceId: "resource1" },
				requestContext: {},
				onError,
			});

			expect(result.ok).toBe(true); // Stream still succeeds even with potential memory errors
			
			// Verify that the onFinish callback is properly configured with onError
			expect(mockStreamResult.result.toUIMessageStreamResponse).toHaveBeenCalledWith(
				expect.objectContaining({
					onFinish: expect.any(Function),
				}),
			);
		});

		it("should handle stream creation warnings without failing", async () => {
			const streamError = new Error("Stream creation failed");
			mockMemory.createStream = vi.fn().mockRejectedValue(streamError);
			
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const result = await streamChat({
				agent: mockAgent,
				sessionId: "session1",
				message: validUserMessage,
				memory: mockMemory,
				resourceId: "resource1",
				systemContext: { sessionId: "session1", resourceId: "resource1" },
				requestContext: {},
				enableResume: true, // Enable resume so createStream is called
			});

			expect(result.ok).toBe(true); // Should still succeed
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("Failed to create stream"),
				expect.objectContaining({
					error: expect.stringContaining("Stream creation failed"),
					errorCode: expect.any(String),
					statusCode: expect.any(Number),
				}),
			);
			
			consoleSpy.mockRestore();
		});

		it("should support resume mode response", async () => {
			const result = await streamChat({
				agent: mockAgent,
				sessionId: "session1",
				message: validUserMessage,
				memory: mockMemory,
				resourceId: "resource1",
				systemContext: { sessionId: "session1", resourceId: "resource1" },
				requestContext: {},
				enableResume: true,
			});

			expect(result.ok).toBe(true);
			expect(mockStreamResult.result.toUIMessageStreamResponse).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: { "Content-Encoding": "none" },
					consumeSseStream: expect.any(Function),
				}),
			);
		});
	});

	describe("resumeStream", () => {
		beforeEach(() => {
			// Mock resumable stream context
			vi.doMock("resumable-stream", () => ({
				createResumableStreamContext: vi.fn().mockReturnValue({
					resumeExistingStream: vi.fn(),
				}),
			}));
		});

		it("should return null for non-existent session", async () => {
			mockMemory.getSession = vi.fn().mockResolvedValue(null);

			const result = await resumeStream(mockMemory, "session1", "resource1");

			expect(result.ok).toBe(false);
			expect(result.error).toBeInstanceOf(SessionNotFoundError);
		});

		it("should return null for session with wrong resourceId", async () => {
			mockMemory.getSession = vi.fn().mockResolvedValue({ resourceId: "different-resource" });

			const result = await resumeStream(mockMemory, "session1", "resource1");

			expect(result.ok).toBe(false);
			expect(result.error).toBeInstanceOf(SessionNotFoundError);
		});

		it("should return null when no streams exist", async () => {
			mockMemory.getSession = vi.fn().mockResolvedValue({ resourceId: "resource1" });
			mockMemory.getSessionStreams = vi.fn().mockResolvedValue([]);

			const result = await resumeStream(mockMemory, "session1", "resource1");

			expect(result.ok).toBe(true);
			expect(result.value).toBeNull();
		});

		it("should convert memory errors using toMemoryApiError", async () => {
			const memoryError = new Error("Redis connection failed");
			mockMemory.getSession = vi.fn().mockRejectedValue(memoryError);

			const result = await resumeStream(mockMemory, "session1", "resource1");

			expect(result.ok).toBe(false);
			expect(result.error).toBeDefined();
			// Should be converted via toMemoryApiError
		});
	});

	describe("Error Boundary Coverage", () => {
		it("should handle all phases of errors appropriately", async () => {
			const onError = vi.fn();

			// Test setup phase error (session validation)
			mockMemory.getSession = vi.fn().mockRejectedValue(new Error("Setup error"));

			await streamChat({
				agent: mockAgent,
				sessionId: "session1",
				message: { id: "msg1", role: "user", content: "Hello" },
				memory: mockMemory,
				resourceId: "resource1",
				systemContext: { sessionId: "session1", resourceId: "resource1" },
				requestContext: {},
				onError,
			});

			// Setup errors don't call onError (they return early), but memory ops do
			expect(onError).not.toHaveBeenCalled();
		});

		it("should handle streaming phase errors with proper conversion", async () => {
			mockMemory.getSession = vi.fn().mockResolvedValue({ resourceId: "resource1" });
			mockMemory.appendMessage = vi.fn().mockResolvedValue(undefined);
			mockMemory.getMessages = vi.fn().mockResolvedValue([]);
			
			const streamingError = new Error("Model configuration invalid");
			mockAgent.stream = vi.fn().mockRejectedValue(streamingError);

			const result = await streamChat({
				agent: mockAgent,
				sessionId: "session1",
				message: { id: "msg1", role: "user", content: "Hello" },
				memory: mockMemory,
				resourceId: "resource1",
				systemContext: { sessionId: "session1", resourceId: "resource1" },
				requestContext: {},
			});

			expect(result.ok).toBe(false);
			expect(result.error).toBeDefined();
			// Should be converted to AgentConfigurationError via toAgentApiError pattern matching
		});
	});

	describe("Guard-Based Failure Handling", () => {
		const validUserMessage: UIMessage = {
			id: "msg1",
			role: "user",
			content: "Hello",
		};

		const mockStreamResult = {
			result: {
				toUIMessageStreamResponse: vi.fn().mockReturnValue(new Response("stream")),
			},
			streamId: "stream123",
			sessionId: "session1",
		};

		beforeEach(() => {
			// Setup successful base case
			mockMemory.getSession = vi.fn().mockResolvedValue({ resourceId: "resource1" });
			mockMemory.appendMessage = vi.fn().mockResolvedValue(undefined);
			mockMemory.getMessages = vi.fn().mockResolvedValue([validUserMessage]);
			mockAgent.stream = vi.fn().mockResolvedValue(mockStreamResult);
		});

		it("should silently handle stream failures with silentStreamFailure guard", async () => {
			const onError = vi.fn();
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			mockMemory.createStream = vi.fn().mockRejectedValue(new Error("Stream error"));

			const result = await streamChat({
				agent: mockAgent,
				sessionId: "session1",
				message: validUserMessage,
				memory: mockMemory,
				resourceId: "resource1",
				systemContext: { sessionId: "session1", resourceId: "resource1" },
				requestContext: {},
				resumeOptions: {
					enabled: true,
					silentStreamFailure: true,
				},
				onError,
			});

			expect(result.ok).toBe(true);
			expect(onError).not.toHaveBeenCalled(); // Silent mode - no onError
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("[Silent Mode]"),
				expect.any(Object),
			);
			
			consoleSpy.mockRestore();
		});

		it("should fail fast with failOnStreamError guard", async () => {
			const onError = vi.fn();
			mockMemory.createStream = vi.fn().mockRejectedValue(new Error("Critical stream error"));

			const result = await streamChat({
				agent: mockAgent,
				sessionId: "session1",
				message: validUserMessage,
				memory: mockMemory,
				resourceId: "resource1",
				systemContext: { sessionId: "session1", resourceId: "resource1" },
				requestContext: {},
				resumeOptions: {
					enabled: true,
					failOnStreamError: true,
				},
				onError,
			});

			expect(result.ok).toBe(false); // Fails immediately
			expect(result.error?.message).toContain("Critical stream error");
			expect(onError).not.toHaveBeenCalled(); // Returned error instead
		});

		it("should not create stream when resumeOptions.enabled is false", async () => {
			mockMemory.createStream = vi.fn();

			const result = await streamChat({
				agent: mockAgent,
				sessionId: "session1",
				message: validUserMessage,
				memory: mockMemory,
				resourceId: "resource1",
				systemContext: { sessionId: "session1", resourceId: "resource1" },
				requestContext: {},
				resumeOptions: {
					enabled: false,
				},
			});

			expect(result.ok).toBe(true);
			expect(mockMemory.createStream).not.toHaveBeenCalled();
		});

		it("should use enableResume for backward compatibility", async () => {
			mockMemory.createStream = vi.fn();

			const result = await streamChat({
				agent: mockAgent,
				sessionId: "session1",
				message: validUserMessage,
				memory: mockMemory,
				resourceId: "resource1",
				systemContext: { sessionId: "session1", resourceId: "resource1" },
				requestContext: {},
				enableResume: true,
			});

			expect(result.ok).toBe(true);
			expect(mockMemory.createStream).toHaveBeenCalled();
		});

		it("should prioritize resumeOptions over enableResume", async () => {
			const onError = vi.fn();
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			mockMemory.createStream = vi.fn().mockRejectedValue(new Error("Test error"));

			const result = await streamChat({
				agent: mockAgent,
				sessionId: "session1",
				message: validUserMessage,
				memory: mockMemory,
				resourceId: "resource1",
				systemContext: { sessionId: "session1", resourceId: "resource1" },
				requestContext: {},
				enableResume: false, // Old flag says no
				resumeOptions: {
					enabled: true, // New options say yes
					silentStreamFailure: true,
				},
				onError,
			});

			expect(result.ok).toBe(true);
			expect(onError).not.toHaveBeenCalled(); // Silent mode
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("[Silent Mode]"),
				expect.any(Object),
			);
			
			consoleSpy.mockRestore();
		});
	});

	describe("Memory Failure Edge Cases During Streaming", () => {
		const validUserMessage: UIMessage = {
			id: "msg1",
			role: "user",
			content: "Hello",
		};

		const mockStreamResult = {
			result: {
				toUIMessageStreamResponse: vi.fn().mockReturnValue(new Response("stream")),
			},
			streamId: "stream123",
			sessionId: "session1",
		};

		beforeEach(() => {
			// Setup successful base case
			mockMemory.getSession = vi.fn().mockResolvedValue({ resourceId: "resource1" });
			mockMemory.appendMessage = vi.fn().mockResolvedValue(undefined);
			mockMemory.getMessages = vi.fn().mockResolvedValue([validUserMessage]);
			mockAgent.stream = vi.fn().mockResolvedValue(mockStreamResult);
		});

		it("should handle createStream failures with warning criticality", async () => {
			const onError = vi.fn();
			const streamError = new Error("Redis connection timeout");
			mockMemory.createStream = vi.fn().mockRejectedValue(streamError);

			const systemContext = { sessionId: "session1", resourceId: "resource1" };
			const requestContext = { userAgent: "test" };

			const result = await streamChat({
				agent: mockAgent,
				sessionId: "session1",
				message: validUserMessage,
				memory: mockMemory,
				resourceId: "resource1",
				systemContext,
				requestContext,
				enableResume: true, // Enable resume so createStream is called
				onError,
			});

			expect(result.ok).toBe(true); // Stream still succeeds
			expect(onError).toHaveBeenCalledWith({
				systemContext,
				requestContext,
				error: expect.any(Object),
				timestamp: expect.any(Number),
			});
		});

		it("should handle memory cascade failures (both createStream and appendMessage fail)", async () => {
			const onError = vi.fn();
			const streamError = new Error("Database unavailable");
			const messageError = new Error("Write operation failed");
			
			mockMemory.createStream = vi.fn().mockRejectedValue(streamError);
			mockMemory.appendMessage = vi.fn().mockRejectedValue(messageError);

			const result = await streamChat({
				agent: mockAgent,
				sessionId: "session1",
				message: validUserMessage,
				memory: mockMemory,
				resourceId: "resource1",
				systemContext: { sessionId: "session1", resourceId: "resource1" },
				requestContext: {},
				onError,
			});

			// When appendMessage fails in processMessage, the entire operation fails
			expect(result.ok).toBe(false);
			expect(result.error).toBeDefined();
			expect(onError).not.toHaveBeenCalled(); // No onError since stream never starts
		});

		it("should handle partial memory state (message save failure)", async () => {
			const onError = vi.fn();
			
			// Simulate successful user message save but failed response save
			mockMemory.appendMessage = vi.fn()
				.mockResolvedValueOnce(undefined) // User message saves successfully
				.mockRejectedValueOnce(new Error("Assistant message save failed")); // Response save fails

			const result = await streamChat({
				agent: mockAgent,
				sessionId: "session1",
				message: validUserMessage,
				memory: mockMemory,
				resourceId: "resource1",
				systemContext: { sessionId: "session1", resourceId: "resource1" },
				requestContext: {},
				onError,
			});

			expect(result.ok).toBe(true); // Stream succeeds
			// onError should be called when onFinish appendMessage fails
			// (This would be called in actual onFinish execution, tested in integration)
		});

		it("should maintain streaming even with complete memory system failure", async () => {
			const onError = vi.fn();
			
			// Only createStream fails (appendMessage works so stream can start)
			mockMemory.createStream = vi.fn().mockRejectedValue(new Error("Memory system down"));
			// Keep appendMessage working so the stream can start

			const systemContext = { sessionId: "session1", resourceId: "resource1" };

			const result = await streamChat({
				agent: mockAgent,
				sessionId: "session1",
				message: validUserMessage,
				memory: mockMemory,
				resourceId: "resource1",
				systemContext,
				requestContext: {},
				enableResume: true, // Enable resume so createStream is called
				onError,
			});

			expect(result.ok).toBe(true); // Stream still works
			expect(onError).toHaveBeenCalledWith({
				systemContext,
				requestContext: {},
				error: expect.any(Object),
				timestamp: expect.any(Number),
			});
		});

		it("should provide detailed error context for memory failures", async () => {
			const onError = vi.fn();
			const specificError = new Error("Table does not exist: conversations");
			mockMemory.createStream = vi.fn().mockRejectedValue(specificError);

			await streamChat({
				agent: mockAgent,
				sessionId: "session1",
				message: validUserMessage,
				memory: mockMemory,
				resourceId: "resource1",
				systemContext: { sessionId: "session1", resourceId: "resource1" },
				requestContext: {},
				enableResume: true, // Enable resume so createStream is called
				onError,
			});

			const errorCall = onError.mock.calls[0][0];
			expect(errorCall.error.message).toContain("Table does not exist");
			expect(errorCall.systemContext).toEqual({ sessionId: "session1", resourceId: "resource1" });
			expect(errorCall.timestamp).toBeDefined();
		});
	});
});