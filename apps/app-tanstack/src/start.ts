import { clerkMiddleware } from "@clerk/tanstack-react-start/server";
import {
  sentryGlobalFunctionMiddleware,
  sentryGlobalRequestMiddleware,
} from "@sentry/tanstackstart-react";
import { createMiddleware, createStart } from "@tanstack/react-start";
import { applySecurityHeaders } from "~/security/headers";

export const APP_OWNED_API_PREFIXES = [
  "/api/connectors/x/mcp",
  "/api/inngest",
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
    clerkMiddlewareWithAppOwnedApiBypass,
    securityHeadersMiddleware,
  ],
  functionMiddleware: [sentryGlobalFunctionMiddleware],
}));
