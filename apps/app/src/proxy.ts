import type { LightfastLastActiveOrg } from "@vendor/clerk/server";
import {
  clerkClient,
  clerkMiddleware,
  createRouteMatcher,
} from "@vendor/clerk/server";
import {
  composeCspOptions,
  createAnalyticsCspDirectives,
  createClerkCspDirectives,
  createNextjsCspDirectives,
  createSentryCspDirectives,
} from "@vendor/security/csp";
import { securityMiddleware } from "@vendor/security/middleware";
import { runMicrofrontendsMiddleware } from "@vercel/microfrontends/next/middleware";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

const POST_AUTH_FALLBACK_PATH = "/account/teams/new";

const securityHeaders = securityMiddleware({
  ...composeCspOptions(
    createNextjsCspDirectives(),
    createClerkCspDirectives(),
    createAnalyticsCspDirectives(),
    createSentryCspDirectives()
  ),
  referrerPolicy: { policy: ["strict-origin-when-cross-origin"] },
});

// Public routes — clerkMiddleware still runs (required for ClerkProvider server-side context),
// but auth is not enforced, so no JWKS fetch for unauthenticated visitors.
const isPublicRoute = createRouteMatcher([
  "/early-access(.*)",
  "/api/health(.*)",
  "/docs(.*)",
  "/monitoring",
  "/ingest(.*)",
  "/manifest.json",
]);

// API routes that handle their own auth at the route handler level.
// Each route is responsible for its own auth + CORS (the Clerk middleware
// would otherwise redirect OPTIONS preflight to /sign-in, which browsers
// reject as ERR_INVALID_REDIRECT).
//   /api/cli/*       — Clerk JWT (verifyCliJwt)
//   /api/desktop/*   — Clerk session (code) / PKCE verifier (exchange)
//   /api/inngest     — Inngest signature
//   /api/trpc/*      — Clerk Bearer or cookie via createTRPCContext
//   /api/v1/*        — Clerk ak_ org API key via oRPC authMiddleware
const isApiRoute = createRouteMatcher([
  "/api/cli/(.*)",
  "/api/auth/(.*)",
  "/api/inngest(.*)",
  "/api/trpc/(.*)",
  "/api/v1/(.*)",
]);

// Auth routes — authenticated users should not see sign-in/sign-up forms.
const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

// Routes accessible during a pending session (signed in but has outstanding tasks
// like choosing an org). Pending users on these routes pass through to complete
// onboarding; on all other protected routes they're sent to the post-auth resolver.
const isPendingAllowedRoute = createRouteMatcher([
  "/account/(.*)",
  // tRPC mutations that must be callable before an org exists (e.g. creating the first org).
  // The tRPC handler's pendingAllowedProcedure enforces its own auth; the middleware must not
  // intercept these with auth.protect() before they reach the handler.
  "/api/trpc/pendingAllowed.organization.create(.*)",
  // Token-handoff routes for CLI / desktop must be reachable during a pending session
  // so first-time users can finish issuing a bearer token before they've picked an org.
  "/cli/auth(.*)",
  "/desktop/auth(.*)",
]);

const isBoundOrgProductRoute = createRouteMatcher(["/:slug"]);

const RESERVED_ORG_ROUTE_SEGMENTS = new Set([
  "account",
  "api",
  "cli",
  "desktop",
  "docs",
  "early-access",
  "ingest",
  "manifest.json",
  "monitoring",
  "sign-in",
  "sign-up",
  "sso-callback",
]);

function getPostAuthPath({
  orgSlug,
  sessionClaims,
  sessionStatus,
}: {
  orgSlug?: string | null;
  sessionClaims?: CustomJwtSessionClaims | null;
  sessionStatus?: string | null;
}) {
  if (orgSlug) {
    return `/${orgSlug}`;
  }

  const lastActiveOrg = sessionClaims?.last_active_org;
  if (
    sessionStatus !== "pending" &&
    lastActiveOrg &&
    typeof lastActiveOrg.slug === "string" &&
    lastActiveOrg.slug.length > 0
  ) {
    return `/${lastActiveOrg.slug}`;
  }

  return POST_AUTH_FALLBACK_PATH;
}

function redirectToPostAuth(
  req: NextRequest,
  authState: Parameters<typeof getPostAuthPath>[0]
) {
  return NextResponse.redirect(new URL(getPostAuthPath(authState), req.url));
}

function getOrgRouteSlug(req: NextRequest) {
  const slug = req.nextUrl.pathname.split("/").filter(Boolean)[0];
  if (!slug || RESERVED_ORG_ROUTE_SEGMENTS.has(slug)) {
    return null;
  }
  return slug;
}

function isSameLastActiveOrg(
  current: CustomJwtSessionClaims["last_active_org"],
  next: LightfastLastActiveOrg
) {
  return current?.id === next.id && current.slug === next.slug;
}

async function persistLastActiveOrg(
  userId: string,
  lastActiveOrg: LightfastLastActiveOrg
) {
  try {
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        last_active_org: lastActiveOrg,
      },
    });
  } catch (err) {
    console.warn("[proxy] Failed to persist last active org", {
      lastActiveOrg,
      message: err instanceof Error ? err.message : String(err),
      name: err instanceof Error ? err.name : "unknown",
      userId,
    });
  }
}

export default clerkMiddleware(
  async (auth, req: NextRequest, event: NextFetchEvent) => {
    const mfeResponse = await runMicrofrontendsMiddleware({
      request: req,
      flagValues: {},
    });
    if (mfeResponse) {
      return mfeResponse;
    }

    // Auth routes: authenticated users go through post-auth routing; unauthenticated users pass through.
    if (isAuthRoute(req)) {
      const { orgSlug, sessionClaims, sessionStatus, userId } = await auth({
        treatPendingAsSignedOut: false,
      });
      if (userId) {
        return redirectToPostAuth(req, {
          orgSlug,
          sessionClaims,
          sessionStatus,
        });
      }
    } else if (!(isPublicRoute(req) || isApiRoute(req))) {
      const { orgId, orgSlug, sessionClaims, sessionStatus, userId } =
        await auth({
          treatPendingAsSignedOut: false,
        });
      if (!userId) {
        const url = new URL("/sign-in", req.url);
        url.searchParams.set(
          "redirect_url",
          `${req.nextUrl.pathname}${req.nextUrl.search}`
        );
        return NextResponse.redirect(url);
      }
      if (req.nextUrl.pathname === "/") {
        return redirectToPostAuth(req, {
          orgSlug,
          sessionClaims,
          sessionStatus,
        });
      }
      if (sessionStatus === "pending" && !isPendingAllowedRoute(req)) {
        return redirectToPostAuth(req, {
          orgSlug,
          sessionClaims,
          sessionStatus,
        });
      }
      const orgRouteSlug = getOrgRouteSlug(req);
      if (orgId && orgRouteSlug) {
        const nextLastActiveOrg = { id: orgId, slug: orgRouteSlug };
        if (
          !isSameLastActiveOrg(
            sessionClaims?.last_active_org,
            nextLastActiveOrg
          )
        ) {
          event.waitUntil(persistLastActiveOrg(userId, nextLastActiveOrg));
        }
      }
      const bindingStatus = sessionClaims?.lf_binding_status;
      if (orgId && isBoundOrgProductRoute(req) && bindingStatus !== "bound") {
        return NextResponse.redirect(
          new URL(`/${req.nextUrl.pathname.split("/")[1]}/tasks/bind`, req.url)
        );
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
    afterSignInUrl: "/",
    afterSignUpUrl: "/",
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
