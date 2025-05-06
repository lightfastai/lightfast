import { asc, eq } from "@vendor/db";
import { db } from "@vendor/db/client";
import { DBMessage } from "@vendor/db/lightfast/schema";

export async function getMessagesBySessionId({
  sessionId,
}: {
  sessionId: string;
}) {
  try {
    const messages = await db
      .select()
      .from(DBMessage)
      .where(eq(DBMessage.sessionId, sessionId))
      .orderBy(asc(DBMessage.createdAt));

    return messages;
  } catch (error) {
    console.error("Failed to get messages by session id");
    throw error;
  }
}
