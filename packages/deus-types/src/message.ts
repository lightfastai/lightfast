/**
 * Shared message types for Deus CLI integration.
 *
 * These types follow the Vercel AI SDK UIMessage pattern used in chat.
 */

import type { UIMessage } from "ai";

/**
 * Metadata stored on Deus UI messages.
 */
export interface LightfastAppDeusUIMessageMetadata {
  createdAt?: string;
  sessionId?: string;
  modelId?: string;
  charCount?: number;
  tokenCount?: number;
  agentType?: "deus" | "claude-code" | "codex";
}

/**
 * Tool set definition for Deus CLI interactions.
 * Currently empty but can be extended for future tool calls.
 */
export type LightfastAppDeusToolSet = Record<string, never>;

/**
 * Custom data types for Deus streaming.
 * Currently empty but can be extended for custom streaming events.
 */
export interface LightfastAppDeusUICustomDataTypes {
  [key: string]: unknown;
}

/**
 * Main UI message type for Deus CLI sessions.
 * Follows the same pattern as LightfastAppChatUIMessage from chat-ai-types.
 */
export type LightfastAppDeusUIMessage = UIMessage<
  LightfastAppDeusUIMessageMetadata,
  LightfastAppDeusUICustomDataTypes,
  LightfastAppDeusToolSet
> & {
  modelId?: string | null;
};

/**
 * Shortcut for UI message parts.
 */
export type LightfastAppDeusUIMessagePart =
  LightfastAppDeusUIMessage["parts"][number];
