import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import { getQueryClient, HydrateClient, trpc } from "~/trpc/server";
import { WorkspaceAssistantClient } from "../../_components/workspace-assistant-client";

export const dynamic = "force-dynamic";

export default async function WorkspaceAssistantConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string; slug: string }>;
}) {
  const { conversationId } = await params;
  const qc = getQueryClient();

  const initialConversation = await qc.fetchQuery(
    trpc.org.workspace.assistant.getConversation.queryOptions({
      id: conversationId,
    })
  );

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

function ChatLoading() {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
