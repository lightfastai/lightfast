import type { inferRouterInputs } from "@trpc/server";
import type { ChatAppRouter } from "@api/chat";
import { createCaller } from "@repo/chat-trpc/server";

export type SaveDocumentInput = inferRouterInputs<ChatAppRouter>["artifact"]["create"];

export async function saveDocument(input: SaveDocumentInput): Promise<void> {
  const caller = await createCaller();
  await caller.artifact.create(input);
}
