import { clerkMiddleware, createRouteMatcher } from "@vendor/clerk/server";
import { runMicrofrontendsMiddleware } from "@vercel/microfrontends/next/middleware";
import {
  composeCspOptions,
  createAnalyticsCspDirectives,
  createClerkCspDirectives,
  createKnockCspDirectives,
  createNextjsCspDirectives,
  createSentryCspDirectives,
} from "@vendor/security/csp";
import { securityMiddleware } from "@vendor/security/middleware";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

const securityHeaders = securityMiddleware(
  composeCspOptions(
    createNextjsCspDirectives(),
    createClerkCspDirectives(),
    createAnalyticsCspDirectives(),
    createKnockCspDirectives(),
    createSentryCspDirectives(),
  ),
);

// Fully public — bypass clerkMiddleware entirely (no JWKS fetch, no auth() call)
// Clerk UI components handle auth state client-side for these routes.
const isPublicBypassRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/early-access(.*)",
  "/api/health(.*)",
  "/api/inngest(.*)",
  "/docs(.*)",
  "/monitoring",
  "/ingest(.*)",
  "/manifest.json",
]);

const isTeamCreationRoute = createRouteMatcher([
  "/account(.*)",
  "/provider/vercel/connected",
  "/provider/github/connected",
  "/provider/sentry/connected",
  "/api/organizations(.*)",
]);

const isUserScopedRoute = createRouteMatcher(["/api/trpc/user(.*)"]);
const isOrgScopedRoute = createRouteMatcher(["/api/trpc/org(.*)"]);
const isOrgPageRoute = createRouteMatcher(["/:slug", "/:slug/(.*)"]);

const isApiRoute = createRouteMatcher([
  "/v1/(.*)",
  "/search(.*)",
  "/contents(.*)",
  "/findsimilar(.*)",
  "/related(.*)",
  "/api/cli/(.*)",
  "/api/events/(.*)",
]);

// Only runs for protected routes — public routes bypass this entirely
const clerkHandler = clerkMiddleware(
  async (auth, req: NextRequest) => {
    if (isTeamCreationRoute(req)) {
      if (!(await auth({ treatPendingAsSignedOut: false })).userId)
        await auth.protect();
    } else if (isUserScopedRoute(req)) {
      // let tRPC handle auth
    } else if (isApiRoute(req)) {
      // allow — withDualAuth at route level
    } else if (isOrgScopedRoute(req)) {
      await auth.protect();
    } else if (isOrgPageRoute(req)) {
      await auth.protect();
    } else {
      await auth.protect();
    }

    const headersResponse = await securityHeaders();
    const response = NextResponse.next();
    for (const [key, value] of headersResponse.headers.entries()) {
      response.headers.set(key, value);
    }
    return response;
  },
  {
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
    afterSignInUrl: "/account/welcome",
    afterSignUpUrl: "/account/welcome",
    organizationSyncOptions: {
      organizationPatterns: ["/:slug", "/:slug/(.*)"],
    },
  },
);

export default async function middleware(
  req: NextRequest,
  event: NextFetchEvent,
) {
  const mfeResponse = await runMicrofrontendsMiddleware({
    request: req,
    flagValues: {},
  });
  if (mfeResponse) return mfeResponse;

  // Public routes bypass Clerk entirely — instant response, no JWKS fetch
  if (isPublicBypassRoute(req)) {
    const headersResponse = await securityHeaders();
    const response = NextResponse.next();
    for (const [key, value] of headersResponse.headers.entries()) {
      response.headers.set(key, value);
    }
    return response;
  }

  return clerkHandler(req, event);
}

export const config = {
  matcher: [
    "/.well-known/vercel/microfrontends/client-config",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
