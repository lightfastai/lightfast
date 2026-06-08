// biome-ignore-all lint/style/useFilenamingConvention: TanStack route params use camelCase file names for camelCase params.

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { ChatLoading } from "~/chat/chat-loading";
import { isPreallocatedConversationId } from "~/chat/conversation-id";
import { WorkspaceAssistantClient } from "~/chat/workspace-assistant-client";
import { useTRPC } from "~/trpc/react";

export const Route = createFileRoute(
  "/_authenticated/$slug/chat/$conversationId"
)({
  head: ({ params }) => ({
    meta: [
      { title: `Chat ${params.conversationId} - ${params.slug} - Lightfast` },
    ],
  }),
  component: WorkspaceConversationPage,
});

function WorkspaceConversationPage() {
  const { conversationId } = Route.useParams();
  const trpc = useTRPC();
  const conversationQuery = useQuery({
    ...trpc.org.workspace.assistant.getConversation.queryOptions({
      id: conversationId,
    }),
    enabled: typeof window !== "undefined",
    retry: false,
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
    maybeCode.code === "NOT_FOUND" ||
    maybeCode.data?.code === "NOT_FOUND" ||
    error.message === "Workspace assistant conversation not found"
  );
}
