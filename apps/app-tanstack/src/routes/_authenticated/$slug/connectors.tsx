import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "~/components/workspace-page";

export const Route = createFileRoute("/_authenticated/$slug/connectors")({
  head: ({ params }) => ({
    meta: [{ title: `Connectors - ${params.slug} - Lightfast` }],
  }),
  component: ConnectorsPage,
});

function ConnectorsPage() {
  const { slug } = Route.useParams();
  return (
    <WorkspacePage
      description="Connector navigation now resolves inside the TanStack workspace shell. The connector list and callback handling can move next."
      eyebrow={`/${slug}/connectors`}
      title="Connectors"
    />
  );
}
