import type { LightfastAnswerUIMessage } from "@repo/console-ai-types";

/** Context passed through memory operations */
export interface AnswerMemoryContext {
  workspaceId: string;
}

/** Answer-specific message type */
export type AnswerMessage = LightfastAnswerUIMessage;
