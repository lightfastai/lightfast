import { clerkMiddleware } from "@clerk/tanstack-react-start/server";
import {
  sentryGlobalFunctionMiddleware,
  sentryGlobalRequestMiddleware,
} from "@sentry/tanstackstart-react";
import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";
import { applySecurityHeaders } from "~/security/headers";

export const APP_OWNED_API_PREFIXES = [
  "/api/cli/rpc",
  "/api/connectors/x/mcp",
  "/api/desktop/rpc",
  "/api/inngest",
  "/api/internal/mcp/proxy",
  "/api/internal/mcp/signals",
  "/api/v1",
] as const;

export function isAppOwnedApiRoute(pathname: string) {
  return APP_OWNED_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

const securityHeadersMiddleware = createMiddleware().server(
  async ({ next }) => {
    const result = await next();

    return {
      ...result,
      response: applySecurityHeaders(result.response),
    };
  }
);

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const clerkRequestMiddleware = clerkMiddleware({
  publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  signInUrl: "/sign-in",
  signUpUrl: "/sign-up",
});

const clerkMiddlewareWithAppOwnedApiBypass = createMiddleware().server(
  async (options) => {
    if (isAppOwnedApiRoute(options.pathname)) {
      return options.next();
    }

    const clerkRequestHandler = clerkRequestMiddleware.options.server;
    if (!clerkRequestHandler) {
      return options.next();
    }

    return clerkRequestHandler(options);
  }
);

export const startInstance = createStart(() => ({
  requestMiddleware: [
    sentryGlobalRequestMiddleware,
    csrfMiddleware,
    clerkMiddlewareWithAppOwnedApiBypass,
    securityHeadersMiddleware,
  ],
  functionMiddleware: [sentryGlobalFunctionMiddleware],
}));
