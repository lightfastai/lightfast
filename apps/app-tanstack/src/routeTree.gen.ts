/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file is intentionally minimal until the TanStack shell routes are added.
// It will be overwritten by the TanStack Router generator in the runtime shell task.

import type { Route as ApiHealthRouteImport } from "./routes/api/health";
import type { startInstance } from "./start";

declare module "@tanstack/react-router" {
  interface FileRoutesByPath {
    "/api/health": {
      id: "/api/health";
      path: "/api/health";
      fullPath: "/api/health";
      preLoaderRoute: typeof ApiHealthRouteImport;
      parentRoute: never;
    };
  }
}

declare module "@tanstack/react-start" {
  interface Register {
    ssr: true;
    config: Awaited<ReturnType<typeof startInstance.getOptions>>;
  }
}
