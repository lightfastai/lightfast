import { db } from "@vendor/db/client";
import { Session } from "@vendor/db/lightfast/schema";

export async function saveSession({
  workspaceId,
  title,
}: {
  workspaceId: string;
  title: string;
}) {
  try {
    const [session] = await db
      .insert(Session)
      .values({
        workspaceId,
        title,
      })
      .returning();

    if (!session) {
      throw new Error("Failed to save session");
    }

    return session;
  } catch (error) {
    console.error("Failed to save chat in database");
    throw error;
  }
}
