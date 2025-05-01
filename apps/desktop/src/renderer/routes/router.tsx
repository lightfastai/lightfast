import { NotFound } from "@/renderer/pages/nomatch";
import { routeTree } from "@/renderer/routes/routes";
import {
  createHashHistory,
  createRouter as createTanstackRouter,
} from "@tanstack/react-router";

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}

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

export const router = createRouter();
