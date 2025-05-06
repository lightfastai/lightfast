import { sql } from "drizzle-orm";

import { db } from "@vendor/db/client";
import { DBMessage } from "@vendor/db/lightfast/schema";

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    // Use upsert operation to handle existing messages
    return await db
      .insert(DBMessage)
      .values(messages)
      .onConflictDoUpdate({
        target: DBMessage.id,
        set: {
          content: sql`excluded.content`,
          parts: sql`excluded.parts`,
          attachments: sql`excluded.attachments`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  } catch (error) {
    console.error("Failed to save messages in database", error);
    throw error;
  }
}
