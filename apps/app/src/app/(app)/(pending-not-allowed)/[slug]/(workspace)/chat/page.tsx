import { randomUUID } from "node:crypto";
import { WorkspaceAssistantClient } from "../_components/workspace-assistant-client";

export const dynamic = "force-dynamic";

export default function WorkspaceAssistantChatPage() {
  // Generate the conversation id up-front so `useChat` has a stable identity
  // from the first render. `force-dynamic` regenerates it per request, so each
  // visit to /chat (including the "New chat" button) starts a fresh thread.
  const conversationId = `conv_${randomUUID()}`;
  return (
    <WorkspaceAssistantClient
      conversationId={conversationId}
      key={conversationId}
    />
  );
}
