import type { ToolUIPart, UITool, UITools } from "ai";

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

export type CreateDocumentToolUIPart = ToolUIPart & { type: "tool-createDocument" };

export type WebSearchToolUIPart = ToolUIPart & { type: "tool-webSearch" };