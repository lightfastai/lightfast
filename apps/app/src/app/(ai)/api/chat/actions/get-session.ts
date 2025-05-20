import { eq } from "@vendor/db";
import { db } from "@vendor/db/client";
import { Session } from "@vendor/db/lightfast/schema";

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
