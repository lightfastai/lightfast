import { createRoute } from "@tanstack/react-router";

import { ComposerRootRoute } from "./__root";
import ComposerPageExisting from "./pages/composer-page-existing";
import ComposerPageNew from "./pages/composer-page-new";

export const ComposerRoute = createRoute({
  getParentRoute: () => ComposerRootRoute,
  path: "/",
  component: ComposerPageNew,
});

export const ComposerSessionRoute = createRoute({
  getParentRoute: () => ComposerRoute,
  path: "/$sessionId",
  component: ComposerPageExisting,
});

export const composerTree = ComposerRootRoute.addChildren([
  ComposerRoute,
  ComposerSessionRoute,
]);
