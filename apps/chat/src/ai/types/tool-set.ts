import type { RuntimeContext } from "lightfast/server/adapters/types";
import type { InferUITools } from "ai";
import type { webSearchTool } from "~/ai/tools/web-search";
import type { createDocumentTool } from "~/ai/tools/create-document";
import type { AppRuntimeContext } from "./app-runtime-context";

// Helper type to extract the tool type from a tool factory function
// This handles the RuntimeContext injection pattern
type ExtractToolType<T> = T extends (context: RuntimeContext<AppRuntimeContext>) => infer R ? R : never;

// Define the tool set type using the helper
// This matches the structure passed to streamText() in route.ts
export type LightfastAppChatToolSet = InferUITools<{
	webSearch: ExtractToolType<typeof webSearchTool>;
	createDocument: ExtractToolType<typeof createDocumentTool>;
}>;