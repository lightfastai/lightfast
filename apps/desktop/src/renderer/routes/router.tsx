import { NotFound } from "@/renderer/pages/nomatch";
import { routeTree } from "@/renderer/routes/route-tree";
import {
  createHashHistory,
  createRouter as createTanstackRouter,
} from "@tanstack/react-router";

const hashHistory = createHashHistory();

export const createRouter = () =>
  createTanstackRouter({
    routeTree,
    history: hashHistory,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    // defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    context: {
      session: undefined!,
    },
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}

export const router = createRouter();
