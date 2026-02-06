import type { UIMessage } from "ai";

/** Runtime context injected per-request into Answer tools */
export interface AnswerRuntimeContext {
  workspaceId: string;
  userId: string;
  authToken?: string;
}

/** Context passed through memory operations */
export interface AnswerMemoryContext {
  workspaceId: string;
}

/** Answer-specific message type (standard UIMessage for V1) */
export type AnswerMessage = UIMessage;
