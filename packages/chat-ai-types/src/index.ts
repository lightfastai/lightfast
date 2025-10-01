// Re-export all shared types
export * from "./attachments";
export * from "./errors";
export * from "./models";
export * from "./feedback";
export * from "./validation";

import type {
  DeepPartial,
  ProviderMetadata,
  UIMessage,
  UIMessageStreamWriter,
  UITools,
} from "ai";
import type { RuntimeContext } from "lightfast/server/adapters/types";

/**
 * Artifact kinds - extensible for different artifact types.
 */
export const ARTIFACT_KINDS = ["code", "diagram"] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

/**
 * Status values for the Lightfast chat experience.
 */
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

/**
 * Runtime context passed to tool factories for Lightfast chat agents.
 */
/**
 * Shape of the create document tool input.
 */
export interface CreateDocumentToolInput {
  title: string;
  kind: ArtifactKind;
}

/**
 * Shape of the create document tool output.
 */
export interface CreateDocumentToolOutput {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
}

/**
 * Allowed content modes for the web search tool.
 */
export const WEB_SEARCH_CONTENT_TYPES = [
  "highlights",
  "summary",
  "text",
] as const;
export type WebSearchContentType = (typeof WEB_SEARCH_CONTENT_TYPES)[number];

/**
 * Result item returned from the web search tool.
 */
export interface WebSearchResultItem {
  title: string;
  url: string;
  content: string;
  contentType: WebSearchContentType;
  score?: number;
}

/**
 * Citation payload surfaced to the UI for web search results.
 */
export interface WebSearchCitationSource {
  id: string;
  title: string;
  url: string;
  domain: string;
  description: string;
  quote?: string;
}

/**
 * Input accepted by the web search tool.
 */
export interface WebSearchToolInput {
  query: string;
  useAutoprompt?: boolean;
  numResults?: number;
  contentType?: WebSearchContentType;
  maxCharacters?: number;
  summaryQuery?: string;
  includeDomains?: string[];
  excludeDomains?: string[];
}

/**
 * Output returned by the web search tool.
 */
export interface WebSearchToolOutput {
  results: WebSearchResultItem[];
  citationSources: WebSearchCitationSource[];
  query: string;
  autopromptString?: string;
  tokensEstimate: number;
}

/**
 * Tool set definition used in Lightfast chat flows.
 */
export type LightfastAppChatToolSet = {
  webSearch: {
    input: WebSearchToolInput;
    output: WebSearchToolOutput;
  };
  createDocument: {
    input: CreateDocumentToolInput;
    output: CreateDocumentToolOutput;
  };
};

/**
 * Custom data types for artifact streaming - type definitions without 'data-' prefix.
 * Actual streaming prefixes payload types with `data-` at runtime.
 */
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

/**
 * Metadata stored on UI messages.
 */
export interface LightfastAppChatUIMessageMetadata {
  createdAt?: string;
  sessionId?: string;
  resourceId?: string;
  modelId?: string;
  charCount?: number;
  tokenCount?: number;
  previewCharCount?: number;
  tooLarge?: boolean;
  hasFullContent?: boolean;
}

/**
 * Main UI message type for Lightfast chat streams.
 */
export type LightfastAppChatUIMessage = UIMessage<
  LightfastAppChatUIMessageMetadata,
  LightfastAppChatUICustomDataTypes,
  LightfastAppChatToolSet
> & {
  modelId?: string | null;
};

/**
 * Shortcut for UI message parts.
 */
export type LightfastAppChatUIMessagePart =
  LightfastAppChatUIMessage["parts"][number];

/**
 * Tool names available within the chat UI message stream.
 */
export type LightfastAppChatToolName = keyof LightfastAppChatToolSet;

/**
 * Extract the tool input payload for a given tool name.
 */
export type LightfastAppChatToolInput<T extends LightfastAppChatToolName> =
  LightfastAppChatToolSet[T]["input"];

/**
 * Specific typed ToolUIPart definitions for our tools.
 */
type ToolUIPartState<TName extends string, TInput, TOutput> =
  | {
      type: `tool-${TName}`;
      toolCallId: string;
      state: "input-streaming";
      input: DeepPartial<TInput> | undefined;
      providerExecuted?: boolean;
      output?: never;
      errorText?: never;
    }
  | {
      type: `tool-${TName}`;
      toolCallId: string;
      state: "input-available";
      input: TInput;
      providerExecuted?: boolean;
      output?: never;
      errorText?: never;
      callProviderMetadata?: ProviderMetadata;
    }
  | {
      type: `tool-${TName}`;
      toolCallId: string;
      state: "output-available";
      input: TInput;
      output: TOutput;
      errorText?: never;
      providerExecuted?: boolean;
      callProviderMetadata?: ProviderMetadata;
      preliminary?: boolean;
    }
  | {
      type: `tool-${TName}`;
      toolCallId: string;
      state: "output-error";
      input: TInput | undefined;
      rawInput?: unknown;
      output?: never;
      errorText: string;
      providerExecuted?: boolean;
      callProviderMetadata?: ProviderMetadata;
    };

export type CreateDocumentToolUIPart = ToolUIPartState<
  "createDocument",
  CreateDocumentToolInput,
  CreateDocumentToolOutput
>;

export type WebSearchToolUIPart = ToolUIPartState<
  "webSearch",
  WebSearchToolInput,
  WebSearchToolOutput
>;

/**
 * Handler invocation details provided to create document handlers.
 */
export interface CreateDocumentHandlerContext {
  id: string;
  title: string;
  sessionId: string;
  messageId: string;
  dataStream: UIMessageStreamWriter<LightfastAppChatUIMessage>;
}

/**
 * Document handler contract consumed by the create document tool.
 */
export interface CreateDocumentHandler {
  kind: ArtifactKind;
  onCreateDocument: (props: CreateDocumentHandlerContext) => Promise<void>;
}

/**
 * Runtime configuration required by the create document tool.
 */
export interface CreateDocumentToolRuntimeConfig {
  handlers: CreateDocumentHandler[];
}

/**
 * Runtime configuration required by the web search tool.
 */
export interface WebSearchToolRuntimeConfig {
  exaApiKey: string;
}

/**
 * Aggregated runtime configuration for Lightfast tools.
 */
export interface ToolRuntimeConfig {
  createDocument?: CreateDocumentToolRuntimeConfig;
  webSearch?: WebSearchToolRuntimeConfig;
}

/**
 * Runtime context passed to tool factories for Lightfast chat agents.
 */
export interface AppRuntimeContext {
  userId?: string;
  agentId: string;
  messageId?: string;
  dataStream?: UIMessageStreamWriter<UIMessage>;
  tools?: ToolRuntimeConfig;
}

/**
 * Runtime context wrapper consumed by Lightfast tool factories.
 */
export type LightfastRuntimeContext = RuntimeContext<AppRuntimeContext>;

/**
 * Context used when fetching chat transcripts for agents.
 */
export interface ChatFetchContext {
  modelId: string;
  isAnonymous: boolean;
}

/**
 * Lightfast agent identifier currently supported by the chat experience.
 */
export type AgentId = "c010";

/**
 * Type guard that narrows a UI message part to a text part.
 */
export function isTextPart(
  part: LightfastAppChatUIMessagePart,
): part is Extract<LightfastAppChatUIMessagePart, { type: "text" }> {
  return part.type === "text";
}

/**
 * Type guard that narrows a UI message part to a reasoning part.
 */
export function isReasoningPart(
  part: LightfastAppChatUIMessagePart,
): part is Extract<LightfastAppChatUIMessagePart, { type: "reasoning" }> {
  return part.type === "reasoning";
}

/**
 * Type guard that checks for any tool part.
 */
export function isToolPart(part: LightfastAppChatUIMessagePart): boolean {
  return typeof part.type === "string" && part.type.startsWith("tool-");
}

export {
  computeMessageCharCount,
  createPreviewParts,
} from "./message-metrics";
export type {
  MessageCharMetrics,
  MessagePreviewResult,
} from "./message-metrics";

export * from "./message-loading";
