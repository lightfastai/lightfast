import type { UIMessage } from "ai";

// Metadata type for our messages
export interface CloudChatMessageMetadata {
  createdAt?: string;
  agentId?: string;
  sessionId?: string;
  status?: "thinking" | "streaming" | "done";
}

// Custom data types for message parts (empty for now)
export type CloudChatCustomDataTypes = Record<string, unknown>;

// Main UIMessage type for cloud chat
export type CloudChatMessage = UIMessage<CloudChatMessageMetadata, CloudChatCustomDataTypes>;

// Helper type for message parts
export type CloudChatMessagePart = CloudChatMessage["parts"][number];

// Type guards for specific part types
export function isTextPart(part: CloudChatMessagePart): part is Extract<CloudChatMessagePart, { type: "text" }> {
  return part.type === "text";
}

export function isReasoningPart(part: CloudChatMessagePart): part is Extract<CloudChatMessagePart, { type: "reasoning" }> {
  return part.type === "reasoning";
}