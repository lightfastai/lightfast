import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "~/components/workspace-page";

export const Route = createFileRoute("/_authenticated/$slug/settings")({
  head: ({ params }) => ({
    meta: [{ title: `Settings - ${params.slug} - Lightfast` }],
  }),
  component: WorkspaceSettingsPage,
});

function WorkspaceSettingsPage() {
  const { slug } = Route.useParams();
  return (
    <WorkspacePage
      description="Workspace settings now have a TanStack route target. Team profile, members, and integration settings can be migrated into this shell."
      eyebrow={`/${slug}/settings`}
      title="Settings"
    />
  );
}
