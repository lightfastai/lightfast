import { auth } from "@clerk/nextjs/server";
import { RedisMemory } from "lightfast/memory/adapters/redis";
import type { PlaygroundUIMessage } from "~/types/playground-ui-messages";
import { env } from "~/env";

/**
 * Server-side function to fetch messages for a session
 * Validates ownership and returns messages in the correct format
 */
export async function getMessages(sessionId: string): Promise<PlaygroundUIMessage[]> {
  const { userId } = await auth();
  if (!userId) {
    return [];
  }

  const memory = new RedisMemory({
    url: env.KV_REST_API_URL,
    token: env.KV_REST_API_TOKEN,
  });

  try {
    // Check session ownership
    const session = await memory.getSession(sessionId);
    if (!session || session.resourceId !== userId) {
      return [];
    }

    // Get messages from memory
    const messages = await memory.getMessages(sessionId);
    
    // The messages from memory are already in UIMessage format
    return messages as PlaygroundUIMessage[];
  } catch (error) {
    console.error("Failed to fetch messages:", error);
    return [];
  }
}