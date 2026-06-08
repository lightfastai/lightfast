import { createRouter } from "@tanstack/react-router";
import type { PrimaryRouteContext } from "./react/primary-router";
import { routeTree } from "./routeTree.gen";

export function createPrimaryRouter(context: PrimaryRouteContext) {
  return createRouter({
    context,
    routeTree,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createPrimaryRouter>;
  }
}
