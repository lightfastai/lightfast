import { createRootRoute, Outlet } from "@tanstack/react-router";

export const RootRoute = createRootRoute({
  component: Root,
});

function Root() {
  return <Outlet />;
}
