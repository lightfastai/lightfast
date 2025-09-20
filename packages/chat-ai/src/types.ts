import type { UIMessage, UIMessageStreamWriter, InferUITools } from "ai";
import type { RuntimeContext } from "lightfast/server/adapters/types";
import type { webSearchTool } from "./web-search";
import type { createDocumentTool } from "./create-document";

export type LightfastChatStatus =
  | "idle"
  | "preparing"
  | "submitting"
  | "toolExecuting"
  | "streaming"
  | "settling"
  | "ready"
  | "blocked"
  | "error";

export interface AppRuntimeContext {
  userId?: string;
  agentId: string;
  messageId?: string;
  dataStream?: UIMessageStreamWriter<UIMessage>;
}

// Helper type to extract the tool type from a tool factory function
// This handles the RuntimeContext injection pattern
type ExtractToolType<T> = T extends (context: RuntimeContext<AppRuntimeContext>) => infer R ? R : never;

// Define the tool set type using the helper - inferred from actual tool implementations
// This matches the structure passed to streamText() in route.ts
export type LightfastAppChatToolSet = InferUITools<{
  webSearch: ExtractToolType<typeof webSearchTool>;
  createDocument: ExtractToolType<typeof createDocumentTool>;
}>;

// Custom data types for artifact streaming - type definitions without 'data-' prefix
// But actual streaming always uses 'data-' prefix in type field
export interface LightfastAppChatUICustomDataTypes {
  "kind": string;
  "id": string;
  "title": string;
  "clear": null;
  "finish": null;
  "codeDelta": string;
  "diagramDelta": string;
  // Index signature to satisfy UIDataTypes constraint
  [key: string]: unknown;
}

// Metadata type for our messages
export interface LightfastAppChatUIMessageMetadata {
  createdAt?: string;
  sessionId?: string;
  resourceId?: string;
  modelId?: string; // The AI model used for assistant messages
}

// Main UIMessage type with our custom generics
export type LightfastAppChatUIMessage = UIMessage<
  LightfastAppChatUIMessageMetadata,
  LightfastAppChatUICustomDataTypes,
  LightfastAppChatToolSet
>;

// Helper type for message parts
export type LightfastAppChatUIMessagePart = LightfastAppChatUIMessage["parts"][number];

// Utility type to extract tool names
export type LightfastAppChatToolName = keyof LightfastAppChatToolSet;

// Utility type to get input for a specific tool
export type LightfastAppChatToolInput<T extends LightfastAppChatToolName> = 
  LightfastAppChatToolSet[T]["input"];

// Specific typed ToolUIPart definitions for our tools
export type CreateDocumentToolUIPart = Extract<
  LightfastAppChatUIMessagePart,
  { type: "tool-createDocument" }
>;

export type WebSearchToolUIPart = Extract<
  LightfastAppChatUIMessagePart,
  { type: "tool-webSearch" }
>;

export interface ChatFetchContext {
  modelId: string;
  isAnonymous: boolean;
}

export type AgentId = "c010";

export function isTextPart(
  part: LightfastAppChatUIMessagePart,
): part is Extract<LightfastAppChatUIMessagePart, { type: "text" }> {
  return part.type === "text";
}

export function isReasoningPart(
  part: LightfastAppChatUIMessagePart,
): part is Extract<LightfastAppChatUIMessagePart, { type: "reasoning" }> {
  return part.type === "reasoning";
}

export function isToolPart(part: LightfastAppChatUIMessagePart): boolean {
  return typeof part.type === "string" && part.type.startsWith("tool-");
}
