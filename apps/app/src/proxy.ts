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

const isApiRoute = createRouteMatcher([
  "/v1/(.*)",
  "/search(.*)",
  "/contents(.*)",
  "/findsimilar(.*)",
  "/related(.*)",
  "/api/cli/(.*)",
  "/api/events/(.*)",
]);

const clerkHandler = clerkMiddleware(
  async (auth, req: NextRequest) => {
    const t0 = Date.now();

    const mfeResponse = await runMicrofrontendsMiddleware({
      request: req,
      flagValues: {},
    });
    const tMfe = Date.now() - t0;

    if (mfeResponse) {
      console.log(`[proxy] mfe:${tMfe}ms returned`);
      return mfeResponse;
    }

    if (!isPublicRoute(req) && !isApiRoute(req)) {
      await auth.protect();
    }

    const headersResponse = await securityHeaders();
    const response = NextResponse.next();
    for (const [key, value] of headersResponse.headers.entries()) {
      response.headers.set(key, value);
    }

    const tTotal = Date.now() - t0;
    console.log(`[proxy] ${req.nextUrl.pathname} mfe:${tMfe}ms handler:${tTotal}ms`);
    response.headers.set("x-proxy-timing", `mfe=${tMfe}ms;handler=${tTotal}ms`);
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

// Wrap clerkMiddleware to measure its total overhead (including its own init)
export default async function middleware(
  req: NextRequest,
  event: NextFetchEvent,
) {
  const t0 = Date.now();
  const result = await clerkHandler(req, event);
  const tClerk = Date.now() - t0;
  console.log(`[proxy] clerk-total:${tClerk}ms ${req.nextUrl.pathname}`);
  if (result) {
    result.headers.set("x-proxy-clerk-total", `${tClerk}ms`);
  }
  return result;
}

export const config = {
  matcher: [
    "/.well-known/vercel/microfrontends/client-config",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
