import type { RuntimeContext } from "@lightfastai/ai-sdk/server/adapters/types";
import type { SearchResponse } from "@repo/app-validation";
import type { DeepPartial, UIMessage } from "ai";

// ─── Tool Input Types ────────────────────────────────────────────

export interface SearchToolInput {
  after?: string;
  before?: string;
  limit: number;
  mode: "fast" | "balanced";
  offset: number;
  query: string;
  sources?: string[];
  types?: string[];
}

// ─── Tool Output Types ───────────────────────────────────────────
// Re-export from @repo/app-validation for single import convenience

export type SearchToolOutput = SearchResponse;

// ─── Tool Set Definition ─────────────────────────────────────────

export interface AnswerToolSet {
  orgSearch: {
    input: SearchToolInput;
    output: SearchToolOutput;
  };
}

export type AnswerToolName = keyof AnswerToolSet;

export type AnswerToolInput<T extends AnswerToolName> =
  AnswerToolSet[T]["input"];
export type AnswerToolOutput<T extends AnswerToolName> =
  AnswerToolSet[T]["output"];

// ─── Tool UI Part State ──────────────────────────────────────────

type ToolUIPartState<TName extends string, TInput, TOutput> =
  | {
      type: `tool-${TName}`;
      toolCallId: string;
      state: "input-streaming";
      input: DeepPartial<TInput> | undefined;
    }
  | {
      type: `tool-${TName}`;
      toolCallId: string;
      state: "input-available";
      input: TInput;
    }
  | {
      type: `tool-${TName}`;
      toolCallId: string;
      state: "output-available";
      input: TInput;
      output: TOutput;
    }
  | {
      type: `tool-${TName}`;
      toolCallId: string;
      state: "output-error";
      input: TInput | undefined;
      errorText: string;
    };

export type SearchToolUIPart = ToolUIPartState<
  "orgSearch",
  SearchToolInput,
  SearchToolOutput
>;

export type AnswerToolUIPart = SearchToolUIPart;

// ─── Message Types ───────────────────────────────────────────────

export interface LightfastAnswerUIMessageMetadata {
  resourceId?: string;
  sessionId?: string;
}

export type LightfastAnswerUIMessage =
  UIMessage<LightfastAnswerUIMessageMetadata>;

// ─── Runtime Context ─────────────────────────────────────────────

/** Handler signature for logic functions injected at runtime */
export type SearchToolHandler = (
  input: SearchToolInput
) => Promise<SearchToolOutput>;

/** Runtime configuration for tool handlers, injected per-request */
export interface AnswerToolRuntimeConfig {
  orgSearch?: { handler: SearchToolHandler };
}

/** Application runtime context for the answer agent */
export interface AnswerAppRuntimeContext {
  authToken?: string;
  clerkOrgId: string;
  tools?: AnswerToolRuntimeConfig;
  userId?: string;
}

/** Full runtime context (SystemContext & RequestContext & AnswerAppRuntimeContext) */
export type LightfastAnswerRuntimeContext =
  RuntimeContext<AnswerAppRuntimeContext>;

// ─── Type Guards ─────────────────────────────────────────────────

export function isTextPart(part: {
  type: string;
}): part is { type: "text"; text: string } {
  return part.type === "text";
}

export function isReasoningPart(part: {
  type: string;
}): part is { type: "reasoning"; reasoning: string } {
  return part.type === "reasoning";
}

export function isToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-");
}
