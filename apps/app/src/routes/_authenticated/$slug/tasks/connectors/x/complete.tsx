import { createFileRoute } from "@tanstack/react-router";
import { XConnectorSetupCompleteClient } from "~/org/setup/x-connector-setup-complete-client";

export const Route = createFileRoute(
  "/_authenticated/$slug/tasks/connectors/x/complete"
)({
  head: ({ params }) => ({
    meta: [{ title: `Finish X Connection - ${params.slug} - Lightfast` }],
  }),
  component: XConnectorSetupCompletePage,
});

function XConnectorSetupCompletePage() {
  const { slug } = Route.useParams();

  return <XConnectorSetupCompleteClient orgSlug={slug} />;
}
