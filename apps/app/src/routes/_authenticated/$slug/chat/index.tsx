import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { WorkspaceAssistantClient } from "~/chat/workspace-assistant-client";
import {
  WorkspaceRouteErrorPanel,
  WorkspaceRoutePending,
} from "~/components/route-boundaries";

const createNewWorkspaceAssistantConversationId = createServerFn({
  method: "GET",
}).handler(async () => {
  const { createWorkspaceAssistantConversationId } = await import("@db/app");
  return createWorkspaceAssistantConversationId();
});

export const Route = createFileRoute("/_authenticated/$slug/chat/")({
  loader: () => createNewWorkspaceAssistantConversationId(),
  pendingComponent: ChatRoutePending,
  errorComponent: ChatRouteError,
  component: WorkspaceChatPage,
});

function ChatRoutePending() {
  return (
    <WorkspaceRoutePending className="h-full min-h-0" label="Loading chat" />
  );
}

function ChatRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { slug } = Route.useParams();

  return (
    <WorkspaceRouteErrorPanel
      backHref={`/${slug}/chat`}
      backLabel="New chat"
      description="There was a transient error while preparing a new conversation."
      error={error}
      reset={reset}
      route="workspace-chat"
      title="Couldn't load this chat"
    />
  );
}

function WorkspaceChatPage() {
  const conversationId = Route.useLoaderData();

  return (
    <WorkspaceAssistantClient
      conversationId={conversationId}
      key={conversationId}
    />
  );
}
