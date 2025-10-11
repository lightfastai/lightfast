import type { Memory } from "lightfast/memory";
import { eq, desc } from "drizzle-orm";
import { db } from "@db/deus/client";
import { DeusMessage } from "@db/deus/schema";
import type { LightfastAppDeusUIMessage } from "@repo/deus-types";
import { uuidv4 } from "@repo/lib";

/**
 * Simple Memory implementation for Deus sessions
 * Implements the required Memory interface from lightfast
 */
export class DeusMemory implements Memory<LightfastAppDeusUIMessage, {}> {
	/**
	 * Append a single message to a session
	 */
	async appendMessage({
		sessionId,
		message,
	}: {
		sessionId: string;
		message: LightfastAppDeusUIMessage;
		context: {};
	}): Promise<void> {
		// Calculate character count
		const charCount = message.parts.reduce((acc, part) => {
			if ("text" in part && typeof part.text === "string") {
				return acc + part.text.length;
			}
			return acc;
		}, 0);

		console.log(`[DeusMemory] Appending message to session ${sessionId}:`, {
			messageId: message.id,
			role: message.role,
			partsCount: message.parts.length,
			charCount,
			partTypes: message.parts.map((p) => p.type),
		});

		await db.insert(DeusMessage).values({
			id: message.id,
			sessionId,
			role: message.role,
			parts: message.parts as any,
			charCount,
			modelId: message.modelId ?? null,
			// Let MySQL handle timestamps with CURRENT_TIMESTAMP default
			// createdAt and updatedAt will be set automatically
		});

		console.log(`[DeusMemory] Message saved successfully`);
	}

	/**
	 * Get all messages for a session, ordered by creation time
	 */
	async getMessages(sessionId: string): Promise<LightfastAppDeusUIMessage[]> {
		console.log(`[DeusMemory] Loading messages for session ${sessionId}...`);

		const messages = await db
			.select({
				id: DeusMessage.id,
				role: DeusMessage.role,
				parts: DeusMessage.parts,
				modelId: DeusMessage.modelId,
				createdAt: DeusMessage.createdAt,
			})
			.from(DeusMessage)
			.where(eq(DeusMessage.sessionId, sessionId))
			.orderBy(desc(DeusMessage.createdAt));

		console.log(`[DeusMemory] Loaded ${messages.length} messages from database`);

		// Reverse to get chronological order
		const result = messages.reverse().map(
			(msg): LightfastAppDeusUIMessage => ({
				id: msg.id,
				role: msg.role as "user" | "assistant" | "system",
				parts: msg.parts as LightfastAppDeusUIMessage["parts"],
				modelId: msg.modelId,
			}),
		);

		console.log(`[DeusMemory] Returning ${result.length} messages in chronological order`);

		return result;
	}

	/**
	 * Create or ensure a session exists
	 */
	async createSession({
		sessionId,
	}: {
		sessionId: string;
		resourceId: string;
		context: {};
	}): Promise<void> {
		// Sessions are already created by the CLI, so this is a no-op
		// The session existence is validated in the route handler
	}

	/**
	 * Get session metadata
	 */
	async getSession(
		sessionId: string,
	): Promise<{ resourceId: string; id: string } | null> {
		const session = await db.query.DeusSession.findFirst({
			where: (sessions, { eq }) => eq(sessions.id, sessionId),
		});

		if (!session) {
			return null;
		}

		return {
			id: session.id,
			resourceId: session.userId, // Use userId as resourceId
		};
	}

	/**
	 * Set active stream ID for a session
	 */
	async createStream({
		sessionId,
		streamId,
	}: {
		sessionId: string;
		streamId: string;
		context: {};
	}): Promise<void> {
		// Deus doesn't currently support stream resume, so this is a no-op
		// Can be implemented later if needed
	}

	/**
	 * Get all stream IDs for a session
	 */
	async getSessionStreams(sessionId: string): Promise<string[]> {
		// Deus doesn't currently support stream resume
		return [];
	}

	/**
	 * Get active stream ID for a session
	 */
	async getActiveStream(sessionId: string): Promise<string | null> {
		// Deus doesn't currently support stream resume
		return null;
	}

	/**
	 * Clear active stream ID for a session
	 */
	async clearActiveStream(sessionId: string): Promise<void> {
		// Deus doesn't currently support stream resume, so this is a no-op
	}
}
