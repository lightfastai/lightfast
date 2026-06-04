import { clerkMiddleware } from "@clerk/tanstack-react-start/server";
import {
  sentryGlobalFunctionMiddleware,
  sentryGlobalRequestMiddleware,
} from "@sentry/tanstackstart-react";
import { createMiddleware, createStart } from "@tanstack/react-start";
import { applySecurityHeaders } from "~/security/headers";

const securityHeadersMiddleware = createMiddleware().server(
  async ({ next }) => {
    const result = await next();

    return {
      ...result,
      response: applySecurityHeaders(result.response),
    };
  }
);

export const startInstance = createStart(() => ({
  requestMiddleware: [
    sentryGlobalRequestMiddleware,
    clerkMiddleware({
      publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
      signInUrl: "/sign-in",
      signUpUrl: "/sign-up",
    }),
    securityHeadersMiddleware,
  ],
  functionMiddleware: [sentryGlobalFunctionMiddleware],
}));
