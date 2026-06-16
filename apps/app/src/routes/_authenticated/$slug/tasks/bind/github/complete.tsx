import { createFileRoute } from "@tanstack/react-router";
import { GitHubBindCompleteClient } from "~/org/setup/github-bind-complete-client";

export const Route = createFileRoute(
  "/_authenticated/$slug/tasks/bind/github/complete"
)({
  head: ({ params }) => ({
    meta: [{ title: `Finishing GitHub - ${params.slug} - Lightfast` }],
  }),
  component: GitHubBindCompletePage,
});

function GitHubBindCompletePage() {
  const { slug } = Route.useParams();
  return <GitHubBindCompleteClient orgSlug={slug} />;
}
