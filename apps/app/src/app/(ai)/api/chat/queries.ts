import { asc, eq } from "@vendor/db";
import { db } from "@vendor/db/client";
import { Message, Session, Stream } from "@vendor/db/lightfast/schema";

export async function saveSession({
  workspaceId,
  title,
}: {
  workspaceId: string;
  title: string;
}) {
  try {
    const [session] = await db
      .insert(Session)
      .values({
        workspaceId,
        title,
      })
      .returning();

    if (!session) {
      throw new Error("Failed to save session");
    }

    return session;
  } catch (error) {
    console.error("Failed to save chat in database");
    throw error;
  }
}

export async function getSession({ sessionId }: { sessionId: string }) {
  try {
    const [session] = await db
      .select()
      .from(Session)
      .where(eq(Session.id, sessionId))
      .limit(1);

    if (!session) {
      throw new Error("Session not found");
    }

    return session;
  } catch (error) {
    console.error("Failed to get session");
    throw error;
  }
}

export async function getMessagesBySessionId({
  sessionId,
}: {
  sessionId: string;
}) {
  try {
    const messages = await db
      .select()
      .from(Message)
      .where(eq(Message.sessionId, sessionId))
      .orderBy(asc(Message.createdAt));

    if (!messages.length) {
      throw new Error("No messages found");
    }

    return messages;
  } catch (error) {
    console.error("Failed to get messages by session id");
    throw error;
  }
}

export async function saveMessages({ messages }: { messages: Message[] }) {
  try {
    return await db.insert(Message).values(messages);
  } catch (error) {
    console.error("Failed to save messages in database", error);
    throw error;
  }
}

export async function createStreamId({ sessionId }: { sessionId: string }) {
  try {
    const [stream] = await db
      .insert(Stream)
      .values({ sessionId, createdAt: new Date() })
      .returning();

    if (!stream) {
      throw new Error("Failed to create stream");
    }

    return stream;
  } catch (error) {
    console.error("Failed to create stream id", error);
    throw error;
  }
}
