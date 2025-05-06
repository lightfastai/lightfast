import type { Message } from "ai";
import { z } from "zod";

export interface PostRequestBody {
  workspaceId: string;
  sessionId: string | null;
  id: string;
  message: Message;
}

export const $BaseStreamConfig = z.object({
  workspaceId: z.string().nanoid(),
  sessionId: z.string().nanoid(),
  userMessageId: z.string().nanoid(),
});

export type BaseStreamConfig = z.infer<typeof $BaseStreamConfig> & {
  userMessage: Message;
  messages: Message[];
};
