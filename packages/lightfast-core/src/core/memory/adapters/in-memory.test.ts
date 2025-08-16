import type { UIMessage } from "ai";
import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryMemory } from "./in-memory";

interface TestContext {
	userId: string;
	metadata?: Record<string, unknown>;
}

describe("InMemoryMemory", () => {
	let memory: InMemoryMemory<UIMessage, TestContext>;

	beforeEach(() => {
		memory = new InMemoryMemory<UIMessage, TestContext>();
	});

	describe("session management", () => {
		it("should create a new session", async () => {
			const sessionId = "test-session-1";
			const resourceId = "user-123";
			const context: TestContext = {
				userId: "test-user",
				metadata: { source: "test" },
			};

			await memory.createSession({ sessionId, resourceId, context });

			const session = await memory.getSession(sessionId);
			expect(session).toEqual({ resourceId });
		});

		it("should not overwrite existing session", async () => {
			const sessionId = "test-session-1";
			const resourceId1 = "user-123";
			const resourceId2 = "user-456";

			await memory.createSession({ sessionId, resourceId: resourceId1 });
			await memory.createSession({ sessionId, resourceId: resourceId2 });

			const session = await memory.getSession(sessionId);
			expect(session?.resourceId).toBe(resourceId1);
		});

		it("should return null for non-existent session", async () => {
			const session = await memory.getSession("non-existent");
			expect(session).toBeNull();
		});
	});

	describe("message management", () => {
		it("should append and retrieve messages", async () => {
			const sessionId = "test-session-1";
			const message1: UIMessage = {
				id: "msg-1",
				role: "user",
				content: "Hello",
			};
			const message2: UIMessage = {
				id: "msg-2",
				role: "assistant",
				content: "Hi there!",
			};

			await memory.appendMessage({ sessionId, message: message1 });
			await memory.appendMessage({ sessionId, message: message2 });

			const messages = await memory.getMessages(sessionId);
			expect(messages).toHaveLength(2);
			expect(messages[0]).toEqual(message1);
			expect(messages[1]).toEqual(message2);
		});

		it("should return empty array for session with no messages", async () => {
			const messages = await memory.getMessages("empty-session");
			expect(messages).toEqual([]);
		});

		it("should handle multiple sessions independently", async () => {
			const session1 = "session-1";
			const session2 = "session-2";

			const message1: UIMessage = {
				id: "msg-1",
				role: "user",
				content: "Session 1 message",
			};
			const message2: UIMessage = {
				id: "msg-2",
				role: "user",
				content: "Session 2 message",
			};

			await memory.appendMessage({ sessionId: session1, message: message1 });
			await memory.appendMessage({ sessionId: session2, message: message2 });

			const messages1 = await memory.getMessages(session1);
			const messages2 = await memory.getMessages(session2);

			expect(messages1).toHaveLength(1);
			expect(messages2).toHaveLength(1);
			expect(messages1[0].content).toBe("Session 1 message");
			expect(messages2[0].content).toBe("Session 2 message");
		});

		it("should preserve message order", async () => {
			const sessionId = "order-test";
			const messages: UIMessage[] = [
				{ id: "1", role: "user", content: "First" },
				{ id: "2", role: "assistant", content: "Second" },
				{ id: "3", role: "user", content: "Third" },
				{ id: "4", role: "assistant", content: "Fourth" },
			];

			for (const message of messages) {
				await memory.appendMessage({ sessionId, message });
			}

			const retrieved = await memory.getMessages(sessionId);
			expect(retrieved.map((m) => m.content)).toEqual([
				"First",
				"Second",
				"Third",
				"Fourth",
			]);
		});
	});

	describe("stream management", () => {
		it("should create and retrieve streams for a session", async () => {
			const sessionId = "session-1";
			const streamId1 = "stream-1";
			const streamId2 = "stream-2";

			await memory.createStream({ sessionId, streamId: streamId1 });
			await memory.createStream({ sessionId, streamId: streamId2 });

			const streams = await memory.getSessionStreams(sessionId);
			expect(streams).toContain(streamId1);
			expect(streams).toContain(streamId2);
		});

		it("should return empty array for session with no streams", async () => {
			const streams = await memory.getSessionStreams("empty-session");
			expect(streams).toEqual([]);
		});

		it("should handle multiple sessions independently", async () => {
			const session1 = "session-1";
			const session2 = "session-2";

			await memory.createStream({ sessionId: session1, streamId: "stream-1" });
			await memory.createStream({ sessionId: session2, streamId: "stream-2" });

			const streams1 = await memory.getSessionStreams(session1);
			const streams2 = await memory.getSessionStreams(session2);

			expect(streams1).toEqual(["stream-1"]);
			expect(streams2).toEqual(["stream-2"]);
		});

		it("should maintain stream order and limit to 100", async () => {
			const sessionId = "test-session";

			// Create 105 streams to test the limit
			for (let i = 0; i < 105; i++) {
				await memory.createStream({ sessionId, streamId: `stream-${i}` });
			}

			const streams = await memory.getSessionStreams(sessionId);
			expect(streams).toHaveLength(100);
			// Should keep the latest streams (newest first)
			expect(streams[0]).toBe("stream-104");
			expect(streams[99]).toBe("stream-5");
		});
	});

	describe("integration scenarios", () => {
		it("should handle complete conversation flow", async () => {
			const sessionId = "conversation-test";
			const resourceId = "user-123";
			const context: TestContext = {
				userId: "test-user",
				metadata: { source: "integration-test" },
			};

			// Create session
			await memory.createSession({ sessionId, resourceId, context });

			// Add conversation messages
			const messages: UIMessage[] = [
				{ id: "1", role: "user", content: "What is 2+2?" },
				{ id: "2", role: "assistant", content: "2+2 equals 4." },
				{ id: "3", role: "user", content: "Thanks!" },
				{ id: "4", role: "assistant", content: "You're welcome!" },
			];

			for (const message of messages) {
				await memory.appendMessage({ sessionId, message, context });
			}

			// Verify session and messages
			const session = await memory.getSession(sessionId);
			const retrievedMessages = await memory.getMessages(sessionId);

			expect(session?.resourceId).toBe(resourceId);
			expect(retrievedMessages).toHaveLength(4);
			expect(retrievedMessages.map((m) => m.role)).toEqual([
				"user",
				"assistant",
				"user",
				"assistant",
			]);
		});
	});
});
