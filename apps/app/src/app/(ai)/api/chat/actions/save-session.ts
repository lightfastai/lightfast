import { db } from "@vendor/db/client";
import { Session } from "@vendor/db/lightfast/schema";

export async function saveSession({ title }: { title: string }) {
  try {
    const [session] = await db
      .insert(Session)
      .values({
        title,
      })
      .returning();

    if (!session) {
      throw new Error("Failed to save session");
    }

    return session;
  } catch (error) {
    console.error("Failed to save session in database");
    throw error;
  }
}
