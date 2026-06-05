import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "~/components/workspace-page";

export const Route = createFileRoute("/_authenticated/$slug/chat")({
  head: ({ params }) => ({
    meta: [{ title: `Chat - ${params.slug} - Lightfast` }],
  }),
  component: WorkspaceChatPage,
});

function WorkspaceChatPage() {
  const { slug } = Route.useParams();
  return (
    <WorkspacePage
      description="The workspace assistant route is now mounted in TanStack. The chat runtime and conversation history can move into this shell next."
      eyebrow={`/${slug}/chat`}
      title="Chat"
    />
  );
}
