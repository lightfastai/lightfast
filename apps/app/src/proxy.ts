import { clerkMiddleware, createRouteMatcher } from "@vendor/clerk/server";
import {
  composeCspOptions,
  createAnalyticsCspDirectives,
  createClerkCspDirectives,
  createKnockCspDirectives,
  createNextjsCspDirectives,
  createSentryCspDirectives,
} from "@vendor/security/csp";
import { securityMiddleware } from "@vendor/security/middleware";
import { runMicrofrontendsMiddleware } from "@vercel/microfrontends/next/middleware";
import type { NextRequest } from "next/server";
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

// Public routes — clerkMiddleware still runs (required for ClerkProvider server-side context),
// but auth.protect() is NOT called, so no JWKS fetch for unauthenticated visitors.
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/early-access(.*)",
  "/api/health(.*)",
  "/docs(.*)",
  "/monitoring",
  "/ingest(.*)",
  "/manifest.json",
]);

// API routes that handle their own auth (withDualAuth at route level)
const isApiRoute = createRouteMatcher([
  "/v1/(.*)",
  "/search(.*)",
  "/contents(.*)",
  "/findsimilar(.*)",
  "/related(.*)",
  "/api/cli/(.*)",
  "/api/events/(.*)",
]);

// Routes accessible during a pending session (user signed in but has outstanding tasks
// like choosing an org). auth.protect() always redirects pending sessions to /sign-in/tasks,
// so these routes skip protect() and do a manual userId check instead.
const isPendingAllowedRoute = createRouteMatcher([
  "/account/(.*)",
  // tRPC mutations that must be callable before an org exists (e.g. creating the first org).
  // The tRPC handler's userScopedProcedure enforces its own auth; the middleware must not
  // intercept these with auth.protect() before they reach the handler.
  "/api/trpc/organization.create(.*)",
]);

export default clerkMiddleware(
  async (auth, req: NextRequest) => {
    const mfeResponse = await runMicrofrontendsMiddleware({
      request: req,
      flagValues: {},
    });
    if (mfeResponse) {
      return mfeResponse;
    }

    if (isPendingAllowedRoute(req)) {
      // Allow pending sessions through without redirecting to /sign-in/tasks.
      // Redirect only truly unauthenticated users (userId is null even with treatPendingAsSignedOut: false).
      const { userId } = await auth({ treatPendingAsSignedOut: false });
      if (!userId) {
        const url = new URL("/sign-in", req.url);
        url.searchParams.set("redirect_url", req.nextUrl.href);
        return NextResponse.redirect(url);
      }
    } else if (!(isPublicRoute(req) || isApiRoute(req))) {
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

export const config = {
  matcher: [
    "/.well-known/vercel/microfrontends/client-config",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
