import type { RuntimeContext } from "@lightfast/core/agent/server/adapters/types";
import type { InferUITool, UIMessage } from "ai";
import type {
  stagehandNavigateTool,
  stagehandActTool,
  stagehandObserveTool,
  stagehandExtractTool,
  stagehandScreenshotTool,
} from "~/app/(agents)/browser";

// Custom data types for message parts (empty for now)
export type PlaygroundUICustomDataTypes = Record<string, unknown>;

// Helper type to extract the tool type from a tool factory function
// This handles the RuntimeContext injection pattern
type ExtractToolType<T> = T extends (context: RuntimeContext<any>) => infer R ? R : never;

// Define the tool set type for browser automation tools
export interface PlaygroundToolSet {
  stagehandNavigate: InferUITool<ExtractToolType<typeof stagehandNavigateTool>>;
  stagehandAct: InferUITool<ExtractToolType<typeof stagehandActTool>>;
  stagehandObserve: InferUITool<ExtractToolType<typeof stagehandObserveTool>>;
  stagehandExtract: InferUITool<ExtractToolType<typeof stagehandExtractTool>>;
  stagehandScreenshot: InferUITool<ExtractToolType<typeof stagehandScreenshotTool>>;
}

// Metadata type for our messages
export interface PlaygroundUIMessageMetadata {
  createdAt?: string;
  sessionId?: string;
  resourceId?: string;
  status?: "thinking" | "streaming" | "done";
}

// Main UIMessage type with our custom generics
export type PlaygroundUIMessage = UIMessage<PlaygroundUIMessageMetadata, PlaygroundUICustomDataTypes, PlaygroundToolSet>;

// Helper type for message parts
export type PlaygroundUIMessagePart = PlaygroundUIMessage["parts"][number];

// Type guards for specific part types
export function isTextPart(part: PlaygroundUIMessagePart): part is Extract<PlaygroundUIMessagePart, { type: "text" }> {
  return part.type === "text";
}

export function isReasoningPart(
  part: PlaygroundUIMessagePart,
): part is Extract<PlaygroundUIMessagePart, { type: "reasoning" }> {
  return part.type === "reasoning";
}

export function isToolPart(part: PlaygroundUIMessagePart): boolean {
  return typeof part.type === "string" && part.type.startsWith("tool-");
}

// Utility type to extract tool names
export type PlaygroundToolName = keyof PlaygroundToolSet;

// Utility type to get input for a specific tool
export type PlaygroundToolInput<T extends PlaygroundToolName> = PlaygroundToolSet[T]["input"];