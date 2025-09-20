import type { ToolUIPart, UIMessage, UIMessageStreamWriter, UITool, UITools } from "ai";

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

export interface LightfastAppChatToolDefinition<Input = unknown, Output = unknown>
  extends UITool {
  input: Input;
  output: Output;
}

export interface LightfastAppChatToolSet extends UITools {
  webSearch: LightfastAppChatToolDefinition<{
    query: string;
    useAutoprompt?: boolean;
    numResults?: number;
    contentType?: "highlights" | "summary" | "text";
    summaryQuery?: string;
    includeDomains?: string[];
    excludeDomains?: string[];
    maxCharacters?: number;
  }>;
  createDocument: LightfastAppChatToolDefinition<{
    title?: string;
    kind?: string;
    body?: string;
  }, { id?: string }>;
}

export type LightfastAppChatToolName = keyof LightfastAppChatToolSet & string;

export type LightfastAppChatToolInput<T extends LightfastAppChatToolName> =
  LightfastAppChatToolSet[T]["input"];

export type LightfastAppChatUIMessage = UIMessage<
  LightfastAppChatUIMessageMetadata,
  LightfastAppChatUICustomDataTypes,
  LightfastAppChatToolSet
>;

export type LightfastAppChatUIMessagePart = LightfastAppChatUIMessage["parts"][number];

export type CreateDocumentToolUIPart = ToolUIPart & { type: "tool-createDocument" };

export type WebSearchToolUIPart = ToolUIPart & { type: "tool-webSearch" };

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
