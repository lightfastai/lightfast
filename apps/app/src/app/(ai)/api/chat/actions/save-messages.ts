import { db } from "@vendor/db/client";
import { Message } from "@vendor/db/lightfast/schema";

export async function saveMessages({ messages }: { messages: Message[] }) {
  try {
    return await db.insert(Message).values(messages);
  } catch (error) {
    console.error("Failed to save messages in database", error);
    throw error;
  }
}
