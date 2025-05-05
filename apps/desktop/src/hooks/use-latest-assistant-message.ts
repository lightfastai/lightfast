import type { SessionChatV1Message } from "@/types/internal";
import { useMemo } from "react";

/**
 * Returns the latest assistant message from a list of messages.
 * @param messages Array of UIMessage objects
 * @returns The most recent assistant message or null if none found
 */
export function useLatestAssistantMessage(
  messages: SessionChatV1Message[],
): SessionChatV1Message | null {
  return useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        return messages[i];
      }
    }
    return null;
  }, [messages]);
}
