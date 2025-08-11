import type { Memory } from "@lightfast/core/memory";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import { db } from "@vendor/db/client";
import {
	LightfastChatSession,
	LightfastChatMessage,
	LightfastChatStream,
} from "@vendor/db/lightfast/schema";
import { eq, desc } from "drizzle-orm";

/**
 * PlanetScale implementation of Memory interface for chat persistence
 * Uses the vendor/db PlanetScale connection with Drizzle ORM
 */
export class PlanetScaleMemory implements Memory<LightfastAppChatUIMessage> {
	/**
	 * Append a single message to a session
	 */
	async appendMessage({
		sessionId,
		message,
	}: {
		sessionId: string;
		message: LightfastAppChatUIMessage;
	}): Promise<void> {
		await db.insert(LightfastChatMessage).values({
			sessionId,
			role: message.role,
			parts: message.parts,
			id: message.id,
		});
	}

	/**
	 * Create multiple messages for a session
	 * This is typically used for initial message loading or bulk operations
	 */
	async createMessages({
		sessionId,
		messages,
	}: {
		sessionId: string;
		messages: LightfastAppChatUIMessage[];
	}): Promise<void> {
		if (messages.length === 0) return;

		const messagesToInsert = messages.map((message) => ({
			sessionId,
			role: message.role,
			parts: message.parts,
			id: message.id,
		}));

		await db.insert(LightfastChatMessage).values(messagesToInsert);
	}

	/**
	 * Get all messages for a session, ordered by creation time
	 */
	async getMessages(sessionId: string): Promise<LightfastAppChatUIMessage[]> {
		const messages = await db
			.select()
			.from(LightfastChatMessage)
			.where(eq(LightfastChatMessage.sessionId, sessionId))
			.orderBy(LightfastChatMessage.createdAt);

		return messages.map((msg) => ({
			id: msg.id,
			role: msg.role,
			parts: msg.parts,
		})) as LightfastAppChatUIMessage[];
	}

	/**
	 * Create a new session
	 */
	async createSession({
		sessionId,
		resourceId,
	}: {
		sessionId: string;
		resourceId: string;
	}): Promise<void> {
		// Check if session already exists
		const existingSession = await db
			.select()
			.from(LightfastChatSession)
			.where(eq(LightfastChatSession.id, sessionId))
			.limit(1);

		if (existingSession.length > 0) {
			return; // Session already exists
		}

		await db.insert(LightfastChatSession).values({
			id: sessionId,
			clerkUserId: resourceId, // resourceId is the Clerk user ID
		});

		// Note: We don't store agentId in the session table currently
		// If needed, we could add an agentId column to the schema
	}

	/**
	 * Get session by ID
	 */
	async getSession(sessionId: string): Promise<{ resourceId: string } | null> {
		const sessions = await db
			.select()
			.from(LightfastChatSession)
			.where(eq(LightfastChatSession.id, sessionId))
			.limit(1);

		if (sessions.length === 0) {
			return null;
		}

		const firstSession = sessions[0];
		if (!firstSession) {
			return null;
		}
		return {
			resourceId: firstSession.clerkUserId,
		};
	}

	/**
	 * Create a stream ID for a session
	 * This is used to track active streaming sessions for resume functionality
	 */
	async createStream({
		sessionId,
		streamId,
	}: {
		sessionId: string;
		streamId: string;
	}): Promise<void> {
		await db.insert(LightfastChatStream).values({
			id: streamId,
			sessionId,
		});
	}

	/**
	 * Get all stream IDs for a session, ordered by creation time (newest first)
	 * Returns the most recent streams for resume functionality
	 */
	async getSessionStreams(sessionId: string): Promise<string[]> {
		const streams = await db
			.select()
			.from(LightfastChatStream)
			.where(eq(LightfastChatStream.sessionId, sessionId))
			.orderBy(desc(LightfastChatStream.createdAt))
			.limit(100); // Keep last 100 streams

		return streams.map((stream) => stream.id);
	}
}
