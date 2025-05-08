import { createRoute } from "@tanstack/react-router";

import { ComposerRootRoute } from "./__root";
import ComposerPage from "./pages/composer-page";

export const ComposerRoute = createRoute({
  getParentRoute: () => ComposerRootRoute,
  path: "/",
  component: ComposerPage,
});

export const ComposerSessionRoute = createRoute({
  getParentRoute: () => ComposerRoute,
  path: "/$sessionId",
  component: ComposerPage,
});

export const composerTree = ComposerRootRoute.addChildren([
  ComposerRoute,
  ComposerSessionRoute,
]);
