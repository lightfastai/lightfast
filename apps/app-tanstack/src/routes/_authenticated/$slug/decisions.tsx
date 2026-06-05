import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "~/components/workspace-page";

export const Route = createFileRoute("/_authenticated/$slug/decisions")({
  head: ({ params }) => ({
    meta: [{ title: `Decisions - ${params.slug} - Lightfast` }],
  }),
  component: DecisionsPage,
});

function DecisionsPage() {
  const { slug } = Route.useParams();
  return (
    <WorkspacePage
      description="Decision routes are mounted in the TanStack workspace shell. The paginated decision feed can be migrated behind this page."
      eyebrow={`/${slug}/decisions`}
      title="Decisions"
    />
  );
}
