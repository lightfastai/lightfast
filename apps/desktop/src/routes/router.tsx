import { createMemoryHistory, createRouter } from "@tanstack/react-router";

import { composerTree } from "./routes";

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}

const history = createMemoryHistory({
  initialEntries: ["/"],
});

// Custom router for composer network
export const composerRouter = createRouter({
  routeTree: composerTree,
  history: history,
});

export type AppRouter = typeof composerRouter;
