import { createRoute, redirect } from "@tanstack/react-router";

import { ComposerRootRoute } from "./__root";
import ComposerPageExisting from "./pages/composer-page-existing";
import ComposerPageNew from "./pages/composer-page-new";
import LoginPage from "./pages/login";

export const LoginRoute = createRoute({
  getParentRoute: () => ComposerRootRoute,
  path: "/login",
  component: LoginPage,
});

// Auth guard for protected routes
async function authGuard() {
  // This will run on navigation; use a global or context-based session check
  // For now, use localStorage/sessionStorage as a placeholder
  const code = window.localStorage.getItem("auth_code");
  if (!code) {
    throw redirect({ to: "/login" });
  }
}

export const ComposerBaseRoute = createRoute({
  getParentRoute: () => ComposerRootRoute,
  path: "/",
  component: ComposerPageNew,
  beforeLoad: authGuard,
});

export const ComposerSessionRoute = createRoute({
  getParentRoute: () => ComposerRootRoute,
  path: "/$sessionId",
  component: ComposerPageExisting,
  beforeLoad: authGuard,
});

export const composerTree = ComposerRootRoute.addChildren([
  ComposerBaseRoute,
  ComposerSessionRoute,
  LoginRoute,
]);
