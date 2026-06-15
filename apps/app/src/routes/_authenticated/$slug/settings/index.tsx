import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$slug/settings/")({
  component: WorkspaceSettingsIndexRedirect,
});

function WorkspaceSettingsIndexRedirect() {
  const { slug } = Route.useParams();

  return <Navigate params={{ slug }} replace to="/$slug/settings/general" />;
}
