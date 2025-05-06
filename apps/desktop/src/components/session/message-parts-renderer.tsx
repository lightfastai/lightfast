import type { UIMessage } from "ai";
import { SessionChatV1Status } from "@/types/internal";

import { AssistantMessage } from "./message-parts/assistant-message";
import { UserMessage } from "./message-parts/user-message";

interface MessagePartsRendererProps {
  message: UIMessage;
  status: SessionChatV1Status;
  addToolResult: (args: { toolCallId: string; result: any }) => void;
}

export function MessagePartsRenderer({
  message,
  status,
  addToolResult,
}: MessagePartsRendererProps) {
  switch (message.role) {
    case "user":
      return <UserMessage message={message} addToolResult={addToolResult} />;
    case "assistant":
      return (
        <AssistantMessage
          message={message}
          status={status}
          addToolResult={addToolResult}
        />
      );
    default:
      return null;
  }
}
