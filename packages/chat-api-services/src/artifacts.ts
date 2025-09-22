import type { ChatAppRouter } from "@api/chat";
import type { inferRouterInputs } from "@trpc/server";

import { ChatApiService } from "./base-service";

export type SaveDocumentInput =
  inferRouterInputs<ChatAppRouter>["artifact"]["create"];

class ArtifactsService extends ChatApiService {
  async create(input: SaveDocumentInput): Promise<void> {
    await this.call(
      "artifacts.create",
      (caller) => caller.artifact.create(input),
      {
        fallbackMessage: "Failed to create document artifact",
        details: {
          sessionId: input.sessionId,
          artifactId: input.id,
        },
      },
    );
  }
}

const service = new ArtifactsService();

export async function saveDocument(input: SaveDocumentInput): Promise<void> {
  await service.create(input);
}
