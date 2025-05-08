import { createMemoryHistory, createRouter } from "@tanstack/react-router";

import { composerTree, indexTree } from "./routes";

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}

const history = createMemoryHistory({
  initialEntries: ["/"],
});

export const indexRouter = createRouter({
  routeTree: indexTree,
  history: history,
});

// Custom router for composer network
export const composerRouter = createRouter({
  routeTree: composerTree,
  history: history,
});

export type AppRouter = typeof indexRouter | typeof composerRouter;
