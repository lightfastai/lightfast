import { db } from "@vendor/db/client";
import { Stream } from "@vendor/db/lightfast/schema";

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
