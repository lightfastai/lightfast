import type { JSONValue, Message } from "ai";
import { convertToCoreMessages } from "ai";

import type { ExtendedCoreMessage } from "../actions/handle-stream-finish";

export function convertToExtendedCoreMessages(
  messages: Message[],
): ExtendedCoreMessage[] {
  const result: ExtendedCoreMessage[] = [];

  for (const message of messages) {
    // Convert annotations to data messages
    if (message.annotations && message.annotations.length > 0) {
      message.annotations.forEach((annotation) => {
        result.push({
          role: "data",
          content: annotation,
        });
      });
    }

    // Convert reasoning to data message with unified structure (including time)
    if (message.reasoning) {
      const reasoningTime = (message as any).reasoningTime ?? 0;
      const reasoningData =
        typeof message.reasoning === "string"
          ? { reasoning: message.reasoning, time: reasoningTime }
          : {
              ...(message.reasoning as Record<string, unknown>),
              time:
                (message as any).reasoningTime ??
                (message.reasoning as any).time ??
                0,
            };
      result.push({
        role: "data",
        content: {
          type: "reasoning",
          data: reasoningData,
        } as JSONValue,
      });
    }

    // Convert current message
    const converted = convertToCoreMessages([message]);
    result.push(...converted);
  }

  return result;
}
