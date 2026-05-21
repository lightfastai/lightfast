import type { LightfastLastActiveOrg } from "@repo/app-clerk-claim";
import type { NextMiddleware as NemoMiddleware } from "@rescale/nemo";
import { createNEMO } from "@rescale/nemo";
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
  createStripeCspDirectives,
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
    // Stripe domains — required by Clerk billing, which embeds Stripe Elements.
    createStripeCspDirectives(),
    createAnalyticsCspDirectives(),
    createSentryCspDirectives()
  ),
  referrerPolicy: { policy: ["strict-origin-when-cross-origin"] },
  // Stripe Elements (embedded by Clerk billing) cannot load on a
  // cross-origin-isolated page: js.stripe.com / hooks.stripe.com send no
  // Cross-Origin-Resource-Policy header, so COEP `require-corp` (Nosecone's
  // default, inherited via composeCspOptions) blocks the Stripe iframe before
  // CSP is even evaluated. The app uses no crossOriginIsolated-only APIs
  // (SharedArrayBuffer, high-res timers), so COEP is safe to disable.
  crossOriginEmbedderPolicy: false,
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
  // Unified OAuth callback. Must be reachable both unauthenticated (normal
  // OAuth roundtrip) and authenticated (existingSession branch — Clerk swaps
  // the active session inside the page). If we listed it under isAuthRoute,
  // authenticated users would get bounced before the setActive can run.
  "/sso-callback(.*)",
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

// Browser routes accessible during a pending session (signed in but has
// outstanding tasks like choosing an org). API auth remains owned by route
// handlers / tRPC procedure builders, not by proxy path allowlisting.
const isPendingSessionAllowedRoute = createRouteMatcher([
  "/account/(.*)",
  // Token-handoff routes for CLI / desktop must be reachable during a pending session
  // so first-time users can finish issuing a bearer token before they've picked an org.
  "/cli/auth(.*)",
  "/desktop/auth(.*)",
]);

const isOrgProductRoute = createRouteMatcher(["/:slug", "/:slug/(.*)"]);
const isOrgSettingsRoute = createRouteMatcher(["/:slug/settings(.*)"]);
const isOrgBindTaskRoute = createRouteMatcher(["/:slug/tasks/bind(.*)"]);

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

async function applySecurityHeaders(response: Response) {
  const headersResponse = await securityHeaders();
  try {
    for (const [key, value] of headersResponse.headers.entries()) {
      response.headers.set(key, value);
    }
    return response;
  } catch {
    const headers = new Headers(response.headers);
    for (const [key, value] of headersResponse.headers.entries()) {
      headers.set(key, value);
    }
    return new NextResponse(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  }
}

const microfrontendsMiddleware: NemoMiddleware = async (req) => {
  const mfeResponse = await runMicrofrontendsMiddleware({
    request: req,
    flagValues: {},
  });
  if (mfeResponse) {
    return applySecurityHeaders(mfeResponse);
  }
  return;
};

const clerkProxyMiddleware = clerkMiddleware(
  async (auth, req: NextRequest, event: NextFetchEvent) => {
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
      if (sessionStatus === "pending" && !isPendingSessionAllowedRoute(req)) {
        return redirectToPostAuth(req, {
          orgSlug,
          sessionClaims,
          sessionStatus,
        });
      }
      const orgRouteSlug = getOrgRouteSlug(req);
      if (orgId && orgSlug && orgRouteSlug && orgSlug === orgRouteSlug) {
        const nextLastActiveOrg = { id: orgId, slug: orgSlug };
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
      if (
        orgId &&
        orgRouteSlug &&
        isOrgProductRoute(req) &&
        !isOrgSettingsRoute(req) &&
        !isOrgBindTaskRoute(req) &&
        bindingStatus !== "bound"
      ) {
        return NextResponse.redirect(
          new URL(`/${orgRouteSlug}/tasks/bind`, req.url)
        );
      }
    }

    const response = NextResponse.next();
    return applySecurityHeaders(response);
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

const nemoClerkProxyMiddleware: NemoMiddleware = (req, event) =>
  clerkProxyMiddleware(req, event as unknown as NextFetchEvent);

export default createNEMO(
  {
    "/:path*": nemoClerkProxyMiddleware,
  },
  {
    before: [microfrontendsMiddleware],
  }
);

export const config = {
  matcher: [
    "/.well-known/vercel/microfrontends/client-config",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
