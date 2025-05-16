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
  // Check for access token instead of auth_code
  const accessToken = window.localStorage.getItem("auth_access_token");
  console.log("Auth guard check:", { accessToken: !!accessToken });
  if (!accessToken) {
    console.log("No access token found, redirecting to login");
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
