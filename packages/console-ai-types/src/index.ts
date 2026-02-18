import type { DeepPartial, UIMessage } from "ai";
import type { RuntimeContext } from "@lightfastai/ai-sdk/server/adapters/types";
import type {
  V1SearchResponse,
  V1ContentsResponse,
  V1FindSimilarResponse,
  GraphResponse,
  RelatedResponse,
} from "@repo/console-types";

// ─── Tool Input Types ────────────────────────────────────────────

export interface SearchToolInput {
  query: string;
  mode?: "fast" | "balanced" | "thorough";
  limit?: number;
  filters?: {
    sourceTypes?: string[];
    observationTypes?: string[];
    actorNames?: string[];
  };
}

export interface ContentsToolInput {
  ids: string[];
}

export interface FindSimilarToolInput {
  id: string;
  limit?: number;
  threshold?: number;
}

export interface GraphToolInput {
  id: string;
  depth?: number;
  limit?: number;
}

export interface RelatedToolInput {
  id: string;
  limit?: number;
}

// ─── Tool Output Types ───────────────────────────────────────────
// Re-export from @repo/console-types for single import convenience

export type SearchToolOutput = V1SearchResponse;
export type ContentsToolOutput = V1ContentsResponse;
export type FindSimilarToolOutput = V1FindSimilarResponse;
export type GraphToolOutput = GraphResponse;
export type RelatedToolOutput = RelatedResponse;

// ─── Tool Set Definition ─────────────────────────────────────────

export interface AnswerToolSet {
  workspaceSearch: {
    input: SearchToolInput;
    output: SearchToolOutput;
  };
  workspaceContents: {
    input: ContentsToolInput;
    output: ContentsToolOutput;
  };
  workspaceFindSimilar: {
    input: FindSimilarToolInput;
    output: FindSimilarToolOutput;
  };
  workspaceGraph: {
    input: GraphToolInput;
    output: GraphToolOutput;
  };
  workspaceRelated: {
    input: RelatedToolInput;
    output: RelatedToolOutput;
  };
}

export type AnswerToolName = keyof AnswerToolSet;

export type AnswerToolInput<T extends AnswerToolName> =
  AnswerToolSet[T]["input"];
export type AnswerToolOutput<T extends AnswerToolName> =
  AnswerToolSet[T]["output"];

// ─── Tool UI Part State ──────────────────────────────────────────

type ToolUIPartState<
  TName extends string,
  TInput,
  TOutput,
> =
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
  "workspaceSearch",
  SearchToolInput,
  SearchToolOutput
>;
export type ContentsToolUIPart = ToolUIPartState<
  "workspaceContents",
  ContentsToolInput,
  ContentsToolOutput
>;
export type FindSimilarToolUIPart = ToolUIPartState<
  "workspaceFindSimilar",
  FindSimilarToolInput,
  FindSimilarToolOutput
>;
export type GraphToolUIPart = ToolUIPartState<
  "workspaceGraph",
  GraphToolInput,
  GraphToolOutput
>;
export type RelatedToolUIPart = ToolUIPartState<
  "workspaceRelated",
  RelatedToolInput,
  RelatedToolOutput
>;

export type AnswerToolUIPart =
  | SearchToolUIPart
  | ContentsToolUIPart
  | FindSimilarToolUIPart
  | GraphToolUIPart
  | RelatedToolUIPart;

// ─── Message Types ───────────────────────────────────────────────

export interface LightfastAnswerUIMessageMetadata {
  sessionId?: string;
  resourceId?: string;
}

export type LightfastAnswerUIMessage = UIMessage<
  LightfastAnswerUIMessageMetadata
>;

// ─── Runtime Context ─────────────────────────────────────────────

/** Handler signature for logic functions injected at runtime */
export type SearchToolHandler = (input: SearchToolInput) => Promise<SearchToolOutput>;
export type ContentsToolHandler = (input: ContentsToolInput) => Promise<ContentsToolOutput>;
export type FindSimilarToolHandler = (input: FindSimilarToolInput) => Promise<FindSimilarToolOutput>;
export type GraphToolHandler = (input: GraphToolInput) => Promise<GraphToolOutput>;
export type RelatedToolHandler = (input: RelatedToolInput) => Promise<RelatedToolOutput>;

/** Runtime configuration for tool handlers, injected per-request */
export interface AnswerToolRuntimeConfig {
  workspaceSearch?: { handler: SearchToolHandler };
  workspaceContents?: { handler: ContentsToolHandler };
  workspaceFindSimilar?: { handler: FindSimilarToolHandler };
  workspaceGraph?: { handler: GraphToolHandler };
  workspaceRelated?: { handler: RelatedToolHandler };
}

/** Application runtime context for the answer agent */
export interface AnswerAppRuntimeContext {
  userId?: string;
  workspaceId: string;
  authToken?: string;
  tools?: AnswerToolRuntimeConfig;
}

/** Full runtime context (SystemContext & RequestContext & AnswerAppRuntimeContext) */
export type LightfastAnswerRuntimeContext =
  RuntimeContext<AnswerAppRuntimeContext>;

// ─── Type Guards ─────────────────────────────────────────────────

export function isTextPart(
  part: { type: string },
): part is { type: "text"; text: string } {
  return part.type === "text";
}

export function isReasoningPart(
  part: { type: string },
): part is { type: "reasoning"; reasoning: string } {
  return part.type === "reasoning";
}

export function isToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-");
}
