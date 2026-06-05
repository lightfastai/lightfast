import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "~/components/workspace-page";

export const Route = createFileRoute("/_authenticated/$slug/signals")({
  head: ({ params }) => ({
    meta: [{ title: `Signals - ${params.slug} - Lightfast` }],
  }),
  component: SignalsPage,
});

function SignalsPage() {
  const { slug } = Route.useParams();
  return (
    <WorkspacePage
      description="Signal routes are mounted in the TanStack workspace shell. The working set and signal list can be migrated behind this page."
      eyebrow={`/${slug}/signals`}
      title="Signals"
    />
  );
}
