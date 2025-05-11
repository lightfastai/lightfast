import { desc, eq } from "@vendor/db";
import { db } from "@vendor/db/client";
import { Document } from "@vendor/db/lightfast/schema";

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(Document)
      .where(eq(Document.id, id))
      .orderBy(desc(Document.createdAt));

    return selectedDocument;
  } catch (error) {
    console.error("Failed to get document by id from database");
    throw error;
  }
}
