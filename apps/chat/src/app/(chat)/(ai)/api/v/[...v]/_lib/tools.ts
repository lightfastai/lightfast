import type { InferUITools } from "ai";
import type { RuntimeContext } from "lightfast/server/adapters/types";
import type { AppRuntimeContext } from "@repo/chat-ai/types";
import { webSearchTool } from "@repo/chat-ai/web-search";
import { createDocumentTool } from "@repo/chat-ai/create-document";
import { createDocumentHandlersByArtifactKind } from '~/ai/artifacts/server';
import { env } from "~/env";

// Helper type to extract the tool type from a tool factory function
type ExtractToolType<T> = T extends (context: RuntimeContext<AppRuntimeContext>) => infer R ? R : never;

// Complete tools object for c010 agent including artifact tools
export const c010Tools = {
	webSearch: webSearchTool({ exaApiKey: env.EXA_API_KEY }),
	createDocument: createDocumentTool({ createDocumentHandlersByArtifactKind }),
};

// Define the actual tool set type using type inference
export type ActualLightfastAppChatToolSet = InferUITools<{
  webSearch: ExtractToolType<typeof webSearchTool>;
  createDocument: ExtractToolType<typeof createDocumentTool>;
}>;