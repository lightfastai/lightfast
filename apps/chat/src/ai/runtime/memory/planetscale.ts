import type { Memory } from "@lightfast/core/memory";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import { db } from "@vendor/db/client";
import { LightfastChatSession, LightfastChatMessage } from "@vendor/db/lightfast/schema";
import { eq, desc, and } from "drizzle-orm";
import type { UIMessage } from "ai";

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
    agentId,
  }: {
    sessionId: string;
    resourceId: string;
    agentId: string;
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

    return {
      resourceId: sessions[0].clerkUserId,
    };
  }

  /**
   * Create a stream ID for a session
   * This is used to track active streaming sessions
   * 
   * Note: PlanetScale doesn't have a dedicated streams table yet,
   * so this is a no-op for now. You could add a streams table
   * to the schema if stream tracking is needed.
   */
  async createStream({
    sessionId,
    streamId,
  }: {
    sessionId: string;
    streamId: string;
  }): Promise<void> {
    // No-op for now - add streams table if needed
    // Could store in a separate table or as JSON in session
    console.log(`Stream ${streamId} created for session ${sessionId}`);
  }

  /**
   * Get all stream IDs for a session
   * 
   * Note: Returns empty array as we don't track streams yet
   */
  async getSessionStreams(sessionId: string): Promise<string[]> {
    // No-op for now - implement if stream tracking is needed
    return [];
  }
}