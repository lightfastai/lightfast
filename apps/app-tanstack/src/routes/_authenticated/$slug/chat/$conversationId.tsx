// biome-ignore-all lint/style/useFilenamingConvention: TanStack route params use camelCase file names for camelCase params.

import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "~/components/workspace-page";

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
  const { conversationId, slug } = Route.useParams();

  return (
    <WorkspacePage
      description="This conversation route is wired into the TanStack workspace shell. The chat runtime can be migrated into this page next."
      eyebrow={`/${slug}/chat/${conversationId}`}
      title="Chat"
    />
  );
}
