import type { Message } from "ai";
import { z } from "zod";

import type { AgentMode } from "@repo/lightfast-js";

export interface PostRequestBody {
  sessionId: string;
  id: string;
  message: Message;
  sessionMode: AgentMode;
}

export const $BaseStreamConfig = z.object({
  sessionId: z.string().nanoid(),
});

export type BaseStreamConfig = z.infer<typeof $BaseStreamConfig> & {
  userMessage: Message;
  messages: Message[];
  sessionMode: AgentMode;
};
