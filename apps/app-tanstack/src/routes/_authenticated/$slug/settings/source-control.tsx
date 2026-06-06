import { createFileRoute } from "@tanstack/react-router";
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
  component: WorkspaceSourceControlSettingsPage,
});

function WorkspaceSourceControlSettingsPage() {
  const { slug } = Route.useParams();

  return <SourceControlSettingsClient slug={slug} />;
}
