import type { DocumentKind } from "@vendor/db/lightfast/schema";
import { db } from "@vendor/db/client";
import { Document } from "@vendor/db/lightfast/schema";

export async function saveDocument({
  id,
  title,
  kind,
  content,
  sessionId,
}: {
  id: string;
  title: string;
  kind: DocumentKind;
  content: string;
  sessionId: string;
}) {
  try {
    return await db
      .insert(Document)
      .values({
        id,
        title,
        kind,
        content,
        sessionId,
        createdAt: new Date(),
      })
      .returning();
  } catch (error) {
    console.error("Failed to save document in database");
    throw error;
  }
}
