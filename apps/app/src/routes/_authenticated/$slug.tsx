import { organizationRouteExists } from "@api/app/tanstack/organizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { WorkspaceRouteShell } from "~/workspace/workspace-route-shell";

export const Route = createFileRoute("/_authenticated/$slug")({
  loader: async ({ params }) => {
    const exists = await organizationRouteExists({
      data: { slug: params.slug },
    });

    if (!exists) {
      throw notFound();
    }
  },
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
