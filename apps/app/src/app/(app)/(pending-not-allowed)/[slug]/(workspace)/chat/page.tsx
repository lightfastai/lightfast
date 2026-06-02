import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { WorkspaceAssistantClient } from "../_components/workspace-assistant-client";

export const dynamic = "force-dynamic";

export default function WorkspaceAssistantChatPage() {
  prefetch(
    trpc.org.workspace.skills.list.queryOptions(undefined, { staleTime: 0 })
  );

  return (
    <HydrateClient>
      <Suspense fallback={<ChatLoading />}>
        <WorkspaceAssistantClient />
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
