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
import { parseSafeAuthRedirectTarget } from "~/auth-redirect";

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
// tRPC stays here because native OAuth Bearer resolution calls auth({ acceptsToken }),
// which requires clerkMiddleware context; auth enforcement remains in procedures.
const isPublicRoute = createRouteMatcher([
  "/early-access(.*)",
  "/api/native-auth/(.*)",
  "/api/trpc/(.*)",
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
//   /api/inngest     — Inngest signature
//   /api/v1/*        — Unkey lf_ org API key via oRPC authMiddleware
const isApiRouteMatcher = createRouteMatcher([
  "/api/inngest(.*)",
  "/api/v1/(.*)",
]);

const APP_OWNED_API_PREFIXES = ["/api/inngest", "/api/v1"];

function isApiRoute(req: NextRequest) {
  return (
    APP_OWNED_API_PREFIXES.some(
      (prefix) =>
        req.nextUrl.pathname === prefix ||
        req.nextUrl.pathname.startsWith(`${prefix}/`)
    ) || isApiRouteMatcher(req)
  );
}

// Auth routes — authenticated users should not see sign-in/sign-up forms.
const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

// Browser routes accessible during a pending session (signed in but has
// outstanding tasks like choosing an org). API auth remains owned by route
// handlers / tRPC procedure builders, not by proxy path allowlisting.
const isPendingSessionAllowedRoute = createRouteMatcher([
  "/account/(.*)",
  "/native-auth(.*)",
]);

const isOrgProductRoute = createRouteMatcher(["/:slug", "/:slug/(.*)"]);
const isOrgSettingsRoute = createRouteMatcher(["/:slug/settings(.*)"]);
const isOrgBindTaskRoute = createRouteMatcher(["/:slug/tasks/bind(.*)"]);

const RESERVED_ORG_ROUTE_SEGMENTS = [
  "account",
  "api",
  "cli",
  "desktop",
  "docs",
  "early-access",
  "ingest",
  "legal",
  "manifest.json",
  "monitoring",
  "native-auth",
  "sign-in",
  "sign-up",
  "sso-callback",
] as const;

const RESERVED_ORG_ROUTE_SEGMENT_SET = new Set<string>(
  RESERVED_ORG_ROUTE_SEGMENTS
);

const RESERVED_ORG_ROUTE_PATTERN = RESERVED_ORG_ROUTE_SEGMENTS.map((segment) =>
  segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
).join("|");
const ORGANIZATION_SLUG_PATTERN = `:slug((?!(?:${RESERVED_ORG_ROUTE_PATTERN})(?:/|$))[^/]+)`;

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

function getClerkOAuthContinuationUrl(req: NextRequest) {
  const redirectTarget = parseSafeAuthRedirectTarget(
    req.nextUrl.searchParams.get("redirect_url")
  );
  if (!redirectTarget?.startsWith("https://")) {
    return null;
  }

  return new URL(redirectTarget);
}

function getOrgRouteSlug(req: NextRequest) {
  const slug = req.nextUrl.pathname.split("/").filter(Boolean)[0];
  if (!slug || RESERVED_ORG_ROUTE_SEGMENT_SET.has(slug)) {
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
        const clerkOAuthContinuationUrl = getClerkOAuthContinuationUrl(req);
        if (clerkOAuthContinuationUrl) {
          return NextResponse.redirect(clerkOAuthContinuationUrl);
        }
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
      organizationPatterns: [
        `/${ORGANIZATION_SLUG_PATTERN}`,
        `/${ORGANIZATION_SLUG_PATTERN}/(.*)`,
      ],
    },
  }
);

const nemoClerkProxyMiddleware: NemoMiddleware = (req, event) =>
  clerkProxyMiddleware(req, event as unknown as NextFetchEvent);

const nemoProxy = createNEMO(
  {
    "/:path*": nemoClerkProxyMiddleware,
  },
  {
    before: [microfrontendsMiddleware],
  }
);

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (isApiRoute(req)) {
    return applySecurityHeaders(NextResponse.next());
  }

  return nemoProxy(req, event);
}

export const config = {
  matcher: [
    "/.well-known/vercel/microfrontends/client-config",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
