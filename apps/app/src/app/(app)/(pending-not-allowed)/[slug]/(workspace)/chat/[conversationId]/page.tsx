import { Suspense } from "react";
import { getQueryClient, HydrateClient, trpc } from "~/trpc/server";
import { WorkspaceAssistantClient } from "../../_components/workspace-assistant-client";
import ChatLoading from "../loading";

export const dynamic = "force-dynamic";

export default async function WorkspaceAssistantConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string; slug: string }>;
}) {
  const { conversationId } = await params;
  const qc = getQueryClient();

  const initialConversation = await getInitialConversation(conversationId, qc);

  return (
    <HydrateClient>
      <Suspense fallback={<ChatLoading />}>
        <WorkspaceAssistantClient
          conversationId={conversationId}
          initialConversation={initialConversation}
          key={conversationId}
        />
      </Suspense>
    </HydrateClient>
  );
}

async function getInitialConversation(
  conversationId: string,
  qc: ReturnType<typeof getQueryClient>
) {
  try {
    return await qc.fetchQuery(
      trpc.org.workspace.assistant.getConversation.queryOptions({
        id: conversationId,
      })
    );
  } catch (error) {
    if (isConversationNotFoundError(error)) {
      return;
    }
    throw error;
  }
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
