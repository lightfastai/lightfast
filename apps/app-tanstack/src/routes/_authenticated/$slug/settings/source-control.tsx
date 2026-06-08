import { createFileRoute } from "@tanstack/react-router";
import { SourceControlSettingsClient } from "~/org/settings/source-control/source-control-settings-client";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/source-control"
)({
  loader: () =>
    loadRoutePrefetch({ data: { route: "org.settings.sourceControl" } }),
  head: ({ params }) => ({
    meta: [
      { title: `Source Control Settings - ${params.slug} - Lightfast` },
      {
        name: "description",
        content: "Manage workspace source-control settings.",
      },
    ],
  }),
  component: WorkspaceSourceControlSettingsPage,
});

function WorkspaceSourceControlSettingsPage() {
  const prefetchState = Route.useLoaderData();
  const { slug } = Route.useParams();

  return (
    <RoutePrefetchBoundary state={prefetchState}>
      <SourceControlSettingsClient slug={slug} />
    </RoutePrefetchBoundary>
  );
}
