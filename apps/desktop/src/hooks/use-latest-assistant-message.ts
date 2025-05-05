import { useMemo } from "react";
import { SessionChatV1Roles } from "@/types/internal";

/**
 * Returns the latest message with the specified role from a list of messages.
 * @param messages Array of message objects with a 'role' property
 * @param role The role to search for (default: 'assistant')
 * @returns The most recent message with the given role, or null if none found
 */
export function useMostRecentMessageByRole<
  T extends { role: SessionChatV1Roles },
>(messages: T[], role: SessionChatV1Roles): T | null {
  return useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === role) {
        return messages[i];
      }
    }
    return null;
  }, [messages, role]);
}
