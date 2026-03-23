// perf/sign-in-isolation — STEP 4: full proxy WITH runMicrofrontendsMiddleware
import { createNEMO } from "@rescale/nemo";
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

const isPublicRoute = createRouteMatcher([
  "/api/health(.*)",
  "/api/inngest(.*)",
  "/docs(.*)",
  "/monitoring",
  "/ingest(.*)",
  "/manifest.json",
  "/sign-in",
  "/sign-in/sso-callback",
  "/sign-up",
  "/sign-up/sso-callback",
  "/early-access",
]);

const isAuthRoute = createRouteMatcher(["/sign-in", "/sign-up"]);

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

const composedMiddleware = createNEMO({}, { before: [] });

export default clerkMiddleware(
  async (auth, req: NextRequest, event) => {
    // STEP 4: runMicrofrontendsMiddleware re-added
    const mfeResponse = await runMicrofrontendsMiddleware({
      request: req,
      flagValues: {},
    });
    if (mfeResponse) return mfeResponse;

    const skipAuth = isPublicRoute(req) && !isAuthRoute(req);
    // For auth pages (sign-in, sign-up): skip JWKS fetch when no session cookie exists.
    // Unauthenticated users have no JWT to validate — auth() is only needed to detect
    // authenticated users who should be redirected away. Without __session there is no
    // active session, so we short-circuit and avoid the ~1.5-2s Clerk FAPI round-trip
    // on every cold function instance (which is every request at low sign-in traffic).
    const skipAuthNoSession =
      isAuthRoute(req) && !req.cookies.has("__session");
    const { userId, orgId, orgSlug } = skipAuth || skipAuthNoSession
      ? { userId: null, orgId: null, orgSlug: null }
      : await auth({ treatPendingAsSignedOut: false });
    const isPending = Boolean(userId && !orgId);

    const createRedirectResponse = async (url: URL) => {
      const redirectResponse = NextResponse.redirect(url);
      const headersResponse = await securityHeaders();
      for (const [key, value] of headersResponse.headers.entries()) {
        redirectResponse.headers.set(key, value);
      }
      return redirectResponse;
    };

    if (isAuthRoute(req) && userId) {
      if (isPending) {
        return await createRedirectResponse(new URL("/account/teams/new", req.url));
      }
      if (orgSlug) {
        return await createRedirectResponse(new URL(`/${orgSlug}`, req.url));
      }
    }

    if (isPublicRoute(req)) {
      // allow
    } else if (isTeamCreationRoute(req)) {
      if (!userId) await auth.protect();
    } else if (isUserScopedRoute(req)) {
      const { userId } = await auth({ treatPendingAsSignedOut: false });
      if (!userId) { /* let tRPC handle */ }
    } else if (isApiRoute(req)) {
      // allow — withDualAuth at route level
    } else if (isOrgScopedRoute(req)) {
      await auth.protect();
    } else if (isOrgPageRoute(req)) {
      await auth.protect();
    } else if (isPending) {
      return await createRedirectResponse(new URL("/account/teams/new", req.url));
    } else {
      await auth.protect();
    }

    const headersResponse = await securityHeaders();
    const middlewareResponse = await composedMiddleware(req, event);
    const finalResponse = middlewareResponse ?? NextResponse.next();
    for (const [key, value] of headersResponse.headers.entries()) {
      finalResponse.headers.set(key, value);
    }
    return finalResponse;
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
