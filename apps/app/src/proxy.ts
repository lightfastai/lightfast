import { clerkMiddleware, createRouteMatcher } from "@vendor/clerk/server";
import {
  composeCspOptions,
  createAnalyticsCspDirectives,
  createClerkCspDirectives,
  createNextjsCspDirectives,
  createSentryCspDirectives,
} from "@vendor/security/csp";
import { securityMiddleware } from "@vendor/security/middleware";
import { runMicrofrontendsMiddleware } from "@vercel/microfrontends/next/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const securityHeaders = securityMiddleware(
  {
    ...composeCspOptions(
      createNextjsCspDirectives(),
      createClerkCspDirectives(),
      createAnalyticsCspDirectives(),
      createSentryCspDirectives()
    ),
    referrerPolicy: { policy: ["strict-origin-when-cross-origin"] },
  }
);

// Public routes — clerkMiddleware still runs (required for ClerkProvider server-side context),
// but auth is not enforced, so no JWKS fetch for unauthenticated visitors.
const isPublicRoute = createRouteMatcher([
  "/early-access(.*)",
  "/api/health(.*)",
  "/api/ingest(.*)",
  "/docs(.*)",
  "/monitoring",
  "/ingest(.*)",
  "/manifest.json",
]);

// API routes that handle their own auth (withDualAuth at route level).
// /api/trpc/(.*) handles auth in createTRPCContext (Bearer token or Clerk
// cookie) and responds to CORS preflight directly. Leaving it in the
// else-branch makes middleware redirect OPTIONS requests to /sign-in, which
// browsers reject with ERR_INVALID_REDIRECT on preflight.
const isApiRoute = createRouteMatcher([
  "/v1/(.*)",
  "/api/cli/(.*)",
  "/api/inngest(.*)",
  "/api/trpc/(.*)",
]);

// Auth routes — authenticated users should not see sign-in/sign-up forms.
const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

// Routes accessible during a pending session (signed in but has outstanding tasks
// like choosing an org). Pending users on these routes pass through to complete
// onboarding; on all other protected routes they're sent to /account/welcome.
const isPendingAllowedRoute = createRouteMatcher([
  "/account/(.*)",
  // tRPC mutations that must be callable before an org exists (e.g. creating the first org).
  // The tRPC handler's userScopedProcedure enforces its own auth; the middleware must not
  // intercept these with auth.protect() before they reach the handler.
  "/api/trpc/organization.create(.*)",
  // Token-handoff routes for CLI / desktop must be reachable during a pending session
  // so first-time users can finish issuing a bearer token before they've picked an org.
  "/cli/auth(.*)",
  "/desktop/auth(.*)",
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

    // Auth routes: authenticated users → /account/welcome; unauthenticated → pass through.
    if (isAuthRoute(req)) {
      const { userId } = await auth({ treatPendingAsSignedOut: false });
      if (userId) {
        return NextResponse.redirect(new URL("/account/welcome", req.url));
      }
    } else if (!(isPublicRoute(req) || isApiRoute(req))) {
      const { userId, sessionStatus } = await auth({
        treatPendingAsSignedOut: false,
      });
      if (!userId) {
        const url = new URL("/sign-in", req.url);
        url.searchParams.set("redirect_url", req.url);
        return NextResponse.redirect(url);
      }
      if (sessionStatus === "pending" && !isPendingAllowedRoute(req)) {
        return NextResponse.redirect(new URL("/account/welcome", req.url));
      }
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
  }
);

export const config = {
  matcher: [
    "/.well-known/vercel/microfrontends/client-config",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
