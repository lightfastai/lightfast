import type { Message } from "ai";
import { z } from "zod";

export interface PostRequestBody {
  workspaceId: string;
  sessionId: string | null;
  message: Message;
}

export const $BaseStreamConfig = z.object({
  workspaceId: z.string().nanoid(),
  sessionId: z.string().nanoid().nullable(),
});

export type BaseStreamConfig = z.infer<typeof $BaseStreamConfig> & {
  messages: Message[];
};
