import { createFileRoute } from "@tanstack/react-router";
import { AutomationsClient } from "~/automations/automations-client";

export const Route = createFileRoute("/_authenticated/$slug/automations/")({
  head: ({ params }) => ({
    meta: [{ title: `Automations - ${params.slug} - Lightfast` }],
  }),
  component: AutomationsPage,
});

function AutomationsPage() {
  const { slug } = Route.useParams();
  return <AutomationsClient slug={slug} />;
}
