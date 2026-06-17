// biome-ignore-all lint/style/useFilenamingConvention: TanStack route params use camelCase file names for camelCase params.

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { ChatLoading } from "~/chat/chat-loading";
import { isPreallocatedConversationId } from "~/chat/conversation-id";
import { WorkspaceAssistantClient } from "~/chat/workspace-assistant-client";
import { assistantConversationQueryOptions } from "~/chat/workspace-assistant-queries";
import { WorkspaceRouteErrorPanel } from "~/components/route-boundaries";

const conversationNotFoundCode = "WORKSPACE_ASSISTANT_CONVERSATION_NOT_FOUND";

export const Route = createFileRoute(
  "/_authenticated/$slug/chat/$conversationId"
)({
  head: ({ params }) => ({
    meta: [
      { title: `Chat ${params.conversationId} - ${params.slug} - Lightfast` },
    ],
  }),
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: ChatRoutePending,
  errorComponent: ChatRouteError,
  component: WorkspaceConversationPage,
});

function ChatRoutePending() {
  return <ChatLoading />;
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
      description="There was a transient error while loading the conversation."
      error={error}
      reset={reset}
      route="workspace-chat"
      title="Couldn't load this chat"
    />
  );
}

function WorkspaceConversationPage() {
  const { conversationId } = Route.useParams();
  const conversationQuery = useQuery({
    ...assistantConversationQueryOptions({ conversationId }),
  });

  if (conversationQuery.isPending) {
    return <ChatLoading />;
  }

  if (conversationQuery.error) {
    if (
      isConversationNotFoundError(conversationQuery.error) &&
      isPreallocatedConversationId(conversationId)
    ) {
      return (
        <WorkspaceAssistantClient
          conversationId={conversationId}
          key={conversationId}
        />
      );
    }
    if (isConversationNotFoundError(conversationQuery.error)) {
      throw notFound();
    }
    throw conversationQuery.error;
  }

  return (
    <WorkspaceAssistantClient
      conversationId={conversationId}
      initialConversation={conversationQuery.data}
      key={conversationId}
    />
  );
}

function isConversationNotFoundError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const maybeCode = error as {
    code?: unknown;
    data?: { code?: unknown };
  };

  return (
    maybeCode.code === conversationNotFoundCode ||
    maybeCode.data?.code === conversationNotFoundCode ||
    maybeCode.code === "NOT_FOUND" ||
    maybeCode.data?.code === "NOT_FOUND"
  );
}
