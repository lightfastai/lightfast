import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceRoutePending } from "~/components/route-boundaries";
import { SourceControlSettingsClient } from "~/org/settings/source-control/source-control-settings-client";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/source-control"
)({
  head: ({ params }) => ({
    meta: [
      { title: `Source Control Settings - ${params.slug} - Lightfast` },
      {
        name: "description",
        content: "Manage workspace source-control settings.",
      },
    ],
  }),
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: SourceControlRoutePending,
  component: WorkspaceSourceControlSettingsPage,
});

function SourceControlRoutePending() {
  return <WorkspaceRoutePending label="Loading source control" />;
}

function WorkspaceSourceControlSettingsPage() {
  const { slug } = Route.useParams();

  return <SourceControlSettingsClient slug={slug} />;
}
