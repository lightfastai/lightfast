import type { InferUITools } from "ai";
import type { RuntimeContext } from "lightfast/server/adapters/types";
import type { ToolFactorySet } from "lightfast/tool";

import type { AppRuntimeContext } from "@repo/chat-ai-types";
import { createDocumentTool } from "@repo/chat-ai/create-document";
import { webSearchTool } from "@repo/chat-ai/web-search";
import { codeInterpreterTool } from "@repo/chat-ai/code-interpreter";

// Helper type to extract the tool type from a tool factory function
type ExtractToolType<T> = T extends (...args: unknown[]) => (
  context: RuntimeContext<AppRuntimeContext>,
) => infer R
  ? R
  : never;

// Complete tools object for c010 agent including artifact tools
export const c010Tools: ToolFactorySet<RuntimeContext<AppRuntimeContext>> = {
	webSearch: webSearchTool(),
	createDocument: createDocumentTool(),
	codeInterpreter: codeInterpreterTool(),
};

// Define the actual tool set type using type inference
export type ActualLightfastAppChatToolSet = InferUITools<{
  webSearch: ExtractToolType<typeof webSearchTool>;
  createDocument: ExtractToolType<typeof createDocumentTool>;
  codeInterpreter: ExtractToolType<typeof codeInterpreterTool>;
}>;
