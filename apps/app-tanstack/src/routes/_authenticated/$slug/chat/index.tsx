import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { WorkspaceAssistantClient } from "~/chat/workspace-assistant-client";

const createNewWorkspaceAssistantConversationId = createServerFn({
  method: "GET",
}).handler(async () => {
  const { createWorkspaceAssistantConversationId } = await import("@db/app");
  return createWorkspaceAssistantConversationId();
});

export const Route = createFileRoute("/_authenticated/$slug/chat/")({
  loader: () => createNewWorkspaceAssistantConversationId(),
  component: WorkspaceChatPage,
});

function WorkspaceChatPage() {
  const conversationId = Route.useLoaderData();

  return (
    <WorkspaceAssistantClient
      conversationId={conversationId}
      key={conversationId}
    />
  );
}
