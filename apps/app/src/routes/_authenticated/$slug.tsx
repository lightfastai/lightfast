import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceRouteShell } from "~/workspace/workspace-route-shell";

export const Route = createFileRoute("/_authenticated/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} - Lightfast` },
      {
        name: "description",
        content: "Lightfast team workspace shell.",
      },
    ],
  }),
  component: WorkspaceRoute,
});

function WorkspaceRoute() {
  const { slug } = Route.useParams();
  return <WorkspaceRouteShell slug={slug} />;
}
