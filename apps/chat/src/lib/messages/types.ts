import type { LightfastAppChatUIMessage } from "@repo/chat-ai-types";

export interface MessageCursor {
  createdAt: string;
  id: string;
}

export interface MessageRecord {
  id: string;
  role: LightfastAppChatUIMessage["role"];
  parts: LightfastAppChatUIMessage["parts"];
  modelId: string | null;
}

export interface MessagePage {
  items: MessageRecord[];
  nextCursor: MessageCursor | null;
}
