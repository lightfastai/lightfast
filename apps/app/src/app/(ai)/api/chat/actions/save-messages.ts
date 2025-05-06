import { db } from "@vendor/db/client";
import { DBMessage } from "@vendor/db/lightfast/schema";

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(DBMessage).values(messages);
  } catch (error) {
    console.error("Failed to save messages in database", error);
    throw error;
  }
}
