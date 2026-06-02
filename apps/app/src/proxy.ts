import type { LightfastLastActiveOrg } from "@repo/app-clerk-claim";
import {
  orgSetupRequirementSchema,
  pathForSetupRequirement,
} from "@repo/app-setup-contract";
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
const USERNAME_TASK_PATH = "/account/tasks/username";
const LIGHTFAST_PATHNAME_HEADER = "x-lightfast-pathname";

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
const GITHUB_BINDING_ROUTE_PATTERNS = [
  "/api/github/setup",
  "/api/github/oauth/callback",
  "/api/github/user/oauth/callback",
  "/api/github/webhook",
] as const;

const PUBLIC_ROUTE_PATTERNS = [
  "/.well-known/oauth-authorization-server",
  "/api/oauth/(.*)",
  "/api/trpc/(.*)",
  "/api/health(.*)",
  "/docs(.*)",
  "/monitoring",
  "/ingest(.*)",
  "/manifest.json",
  "/oauth/jwks",
  "/oauth/register(.*)",
  "/oauth/revoke",
  "/oauth/token",
  ...GITHUB_BINDING_ROUTE_PATTERNS,
] as const;

const isPublicRoute = createRouteMatcher([...PUBLIC_ROUTE_PATTERNS]);

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

function isRetiredEarlyAccessPath(pathname: string) {
  return pathname === "/early-access" || pathname.startsWith("/early-access/");
}

// Auth routes — authenticated users should not see sign-in/sign-up forms.
const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

// Browser routes accessible during a pending session (signed in but has
// outstanding tasks like choosing an org). API auth remains owned by route
// handlers / tRPC procedure builders, not by proxy path allowlisting.
const isAppOwnedSignedInRoute = createRouteMatcher([
  "/account/(.*)",
  "/oauth(.*)",
]);

const ORG_ROUTE_POLICIES = [
  { clerkSync: true, pattern: "/:slug", setupExempt: false },
  { clerkSync: true, pattern: "/:slug/signals(.*)", setupExempt: false },
  { clerkSync: true, pattern: "/:slug/people(.*)", setupExempt: false },
  { clerkSync: true, pattern: "/:slug/automations(.*)", setupExempt: false },
  { clerkSync: true, pattern: "/:slug/settings(.*)", setupExempt: true },
  { clerkSync: true, pattern: "/:slug/tasks/bind(.*)", setupExempt: true },
  {
    clerkSync: true,
    pattern: "/:slug/tasks/github/lightfast-repo(.*)",
    setupExempt: true,
  },
] as const;

const ORG_PRODUCT_ROUTE_PATTERNS = ["/:slug", "/:slug/(.*)"] as const;
const ORG_SETUP_EXEMPT_ROUTE_PATTERNS = ORG_ROUTE_POLICIES.filter(
  (policy) => policy.setupExempt
).map((policy) => policy.pattern);

const isOrgProductRoute = createRouteMatcher([...ORG_PRODUCT_ROUTE_PATTERNS]);
const isOrgSetupExemptRoute = createRouteMatcher([
  ...ORG_SETUP_EXEMPT_ROUTE_PATTERNS,
]);
const organizationSyncOptions = {
  organizationPatterns: ORG_ROUTE_POLICIES.filter(
    (policy) => policy.clerkSync
  ).map((policy) => policy.pattern),
};

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

function isUsernameTaskRoute(req: NextRequest) {
  return req.nextUrl.pathname === USERNAME_TASK_PATH;
}

async function redirectToUsernameTaskIfNeeded(
  req: NextRequest,
  userId: string,
  options: { returnTo?: string } = {}
) {
  if (isUsernameTaskRoute(req)) {
    return null;
  }

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    if (user.username) {
      return null;
    }
  } catch (err) {
    console.warn("[proxy] Failed to resolve username setup gate", {
      message: err instanceof Error ? err.message : String(err),
      name: err instanceof Error ? err.name : "unknown",
      userId,
    });
    return null;
  }

  const url = new URL(USERNAME_TASK_PATH, req.url);
  const returnTo =
    options.returnTo ?? `${req.nextUrl.pathname}${req.nextUrl.search}`;
  if (returnTo) {
    url.searchParams.set("return_to", returnTo);
  }
  return NextResponse.redirect(url);
}

function getSetupPathFromClaims(input: {
  orgSlug: string;
  sessionClaims?: CustomJwtSessionClaims | null;
}) {
  const parsed = orgSetupRequirementSchema.safeParse(
    input.sessionClaims?.lf_next_setup_requirement
  );
  return pathForSetupRequirement({
    orgSlug: input.orgSlug,
    requirement: parsed.success ? parsed.data : "github_org",
  });
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

function isActiveOrgPath(req: NextRequest, orgSlug: string) {
  const prefix = `/${orgSlug}`;
  return (
    req.nextUrl.pathname === prefix ||
    req.nextUrl.pathname.startsWith(`${prefix}/`)
  );
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

function nextWithRequestContext(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(LIGHTFAST_PATHNAME_HEADER, req.nextUrl.pathname);
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
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
        const usernameSetupRedirect = await redirectToUsernameTaskIfNeeded(
          req,
          userId,
          {
            returnTo: getPostAuthPath({
              orgSlug,
              sessionClaims,
              sessionStatus,
            }),
          }
        );
        if (usernameSetupRedirect) {
          return usernameSetupRedirect;
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
      const usernameSetupRedirect = await redirectToUsernameTaskIfNeeded(
        req,
        userId
      );
      if (usernameSetupRedirect) {
        return usernameSetupRedirect;
      }
      if (req.nextUrl.pathname === "/") {
        return redirectToPostAuth(req, {
          orgSlug,
          sessionClaims,
          sessionStatus,
        });
      }
      if (sessionStatus === "pending" && !isAppOwnedSignedInRoute(req)) {
        return redirectToPostAuth(req, {
          orgSlug,
          sessionClaims,
          sessionStatus,
        });
      }
      const isActiveOrgProductRoute =
        !!orgSlug && isActiveOrgPath(req, orgSlug) && isOrgProductRoute(req);
      if (
        !isAppOwnedSignedInRoute(req) &&
        orgId &&
        orgSlug &&
        isActiveOrgProductRoute
      ) {
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
        !isAppOwnedSignedInRoute(req) &&
        orgId &&
        orgSlug &&
        isActiveOrgProductRoute &&
        !isOrgSetupExemptRoute(req) &&
        bindingStatus !== "bound"
      ) {
        return NextResponse.redirect(
          new URL(getSetupPathFromClaims({ orgSlug, sessionClaims }), req.url)
        );
      }
    }

    const response = nextWithRequestContext(req);
    return applySecurityHeaders(response);
  },
  {
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
    afterSignInUrl: "/",
    afterSignUpUrl: "/",
    organizationSyncOptions,
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
  if (isRetiredEarlyAccessPath(req.nextUrl.pathname)) {
    return applySecurityHeaders(
      NextResponse.redirect(new URL("/sign-up", req.url), 308)
    );
  }

  if (isApiRoute(req)) {
    return applySecurityHeaders(nextWithRequestContext(req));
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
