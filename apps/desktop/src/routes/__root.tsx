import { createRootRoute, Outlet } from "@tanstack/react-router";

export const ComposerRootRoute = createRootRoute({
  component: ComposerRoot,
});

function ComposerRoot() {
  return <Outlet />;
}
