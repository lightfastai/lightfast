import type { Message } from "ai";
import { z } from "zod";

export interface PostRequestBody {
  sessionId: string;
  id: string;
  message: Message;
}

export const $BaseStreamConfig = z.object({
  sessionId: z.string().nanoid(),
});

export type BaseStreamConfig = z.infer<typeof $BaseStreamConfig> & {
  userMessage: Message;
  messages: Message[];
};
