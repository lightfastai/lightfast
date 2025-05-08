import { sql } from "drizzle-orm";

import { db } from "@vendor/db/client";
import { Session } from "@vendor/db/lightfast/schema";

export async function saveSession({
  id,
  title,
}: {
  id?: string;
  title: string;
}) {
  try {
    const [session] = await db
      .insert(Session)
      .values({
        ...(id ? { id } : {}),
        title,
      })
      .onConflictDoUpdate({
        target: Session.id,
        set: {
          title: sql.raw(`excluded.title`),
          updatedAt: sql.raw(`now()`),
        },
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
