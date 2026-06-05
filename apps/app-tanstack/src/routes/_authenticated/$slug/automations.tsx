import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "~/components/workspace-page";

export const Route = createFileRoute("/_authenticated/$slug/automations")({
  head: ({ params }) => ({
    meta: [{ title: `Automations - ${params.slug} - Lightfast` }],
  }),
  component: AutomationsPage,
});

function AutomationsPage() {
  const { slug } = Route.useParams();
  return (
    <WorkspacePage
      description="Automation routes are wired into the TanStack workspace shell. The automations client and queries can be migrated behind this route."
      eyebrow={`/${slug}/automations`}
      title="Automations"
    />
  );
}
