import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { PrimaryRouteContext } from "../react/primary-router";

export const Route = createRootRouteWithContext<PrimaryRouteContext>()({
  component: Outlet,
});
