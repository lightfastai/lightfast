import { sql } from "drizzle-orm";

import { db } from "@vendor/db/client";
import { DBMessage } from "@vendor/db/lightfast/schema";

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db
      .insert(DBMessage)
      .values(messages)
      .onConflictDoUpdate({
        target: DBMessage.id,
        set: {
          parts: sql.raw(`excluded.parts`),
          role: sql.raw(`excluded.role`),
          sessionId: sql.raw(`excluded.session_id`),
          attachments: sql.raw(`excluded.attachments`),
          updatedAt: sql.raw(`now()`),
        },
      })
      .returning();
  } catch (error) {
    console.error("Failed to save messages in database", error);
    throw error;
  }
}
