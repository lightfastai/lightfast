import { SignInForm } from "@/renderer/components/SignIn/SignInForm";
import { SSOCallback } from "@/renderer/components/SSOCallback";
import { AuthLayout } from "@/renderer/pages/auth/AuthLayout";
import { Signout } from "@/renderer/pages/auth/signout";
import Home from "@/renderer/pages/home";
import { App, PageLayout } from "@/renderer/pages/layout";
import { NotFound } from "@/renderer/pages/nomatch";
import { useSession } from "@clerk/clerk-react";
import { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  Outlet,
  redirect,
} from "@tanstack/react-router";

interface RouteContext {
  session: ReturnType<typeof useSession>;
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouteContext>()({
  component: () => (
    <>
      <Outlet />
    </>
  ),
});

const authenticatedVirtualRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_authenticated",
  beforeLoad: async ({ location, context }) => {
    if (!context.session?.isSignedIn) {
      throw redirect({
        to: "/signin",
        search: {
          // Use the current location to power a redirect after login
          // (Do not use `router.state.resolvedLocation` as it can
          // potentially lag behind the actual current location)
          redirect: location.href,
        },
      });
    }
  },
  component: () => {
    return (
      <>
        <Outlet />
      </>
    );
  },
  notFoundComponent: () => {
    return <NotFound />;
  },
});

export const signoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "signout",
  component: Signout,
});

export const appVirtualRoute = createRoute({
  getParentRoute: () => authenticatedVirtualRoute,
  id: "app",
  component: App,
});

export const pageLayoutRoute = createRoute({
  getParentRoute: () => appVirtualRoute,
  id: "pageLayout",
  component: PageLayout,
});

export const homeLayoutRoute = createRoute({
  getParentRoute: () => pageLayoutRoute,
  path: "/home",
  component: Home,
});

export const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authentication",
  component: AuthLayout,
});

export const signinRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "signin",
  component: SignInForm,
});

export const signupRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "signup",
  component: SignInForm,
});

export const ssoCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "sso-callback",
  component: SSOCallback,
});

export const routeTree = rootRoute.addChildren([
  authLayoutRoute.addChildren([signinRoute, signupRoute]),
  signoutRoute,
  authenticatedVirtualRoute.addChildren([
    appVirtualRoute.addChildren([
      pageLayoutRoute.addChildren([homeLayoutRoute]),
    ]),
    ssoCallbackRoute,
  ]),
]);
