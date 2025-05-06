import { asc, eq } from "@vendor/db";
import { db } from "@vendor/db/client";
import { Message } from "@vendor/db/lightfast/schema";

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

    return messages;
  } catch (error) {
    console.error("Failed to get messages by session id");
    throw error;
  }
}
