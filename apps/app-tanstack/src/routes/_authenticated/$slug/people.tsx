import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "~/components/workspace-page";

export const Route = createFileRoute("/_authenticated/$slug/people")({
  head: ({ params }) => ({
    meta: [{ title: `People - ${params.slug} - Lightfast` }],
  }),
  component: PeoplePage,
});

function PeoplePage() {
  const { slug } = Route.useParams();
  return (
    <WorkspacePage
      description="People routes are mounted in the TanStack workspace shell. The member directory and invite workflows can move next."
      eyebrow={`/${slug}/people`}
      title="People"
    />
  );
}
