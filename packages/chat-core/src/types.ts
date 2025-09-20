import type { UIMessage, UIMessageStreamWriter } from "ai";
import type { LightfastAppChatToolSet } from "@repo/chat-ai-tools/tools";

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

export interface LightfastAppChatUICustomDataTypes {
  kind: string;
  id: string;
  title: string;
  clear: null;
  finish: null;
  codeDelta: string;
  diagramDelta: string;
  [key: string]: unknown;
}

export interface LightfastAppChatUIMessageMetadata {
  createdAt?: string;
  sessionId?: string;
  resourceId?: string;
  modelId?: string;
}

// Re-export from chat-ai-tools for convenience
export type { 
  LightfastAppChatToolDefinition,
  LightfastAppChatToolSet,
  LightfastAppChatToolName,
  LightfastAppChatToolInput
} from "@repo/chat-ai-tools/tools";

export type LightfastAppChatUIMessage = UIMessage<
  LightfastAppChatUIMessageMetadata,
  LightfastAppChatUICustomDataTypes,
  LightfastAppChatToolSet
>;

export type LightfastAppChatUIMessagePart = LightfastAppChatUIMessage["parts"][number];

// Re-export tool UI parts from chat-ai-tools
export type { 
  CreateDocumentToolUIPart,
  WebSearchToolUIPart 
} from "@repo/chat-ai-tools/tools";

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
