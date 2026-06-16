import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$slug/")({
  component: WorkspaceIndexRedirect,
});

function WorkspaceIndexRedirect() {
  const { slug } = Route.useParams();
  return <Navigate params={{ slug }} replace to="/$slug/chat" />;
}
