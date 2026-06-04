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
  requestMiddleware: [sentryGlobalRequestMiddleware, securityHeadersMiddleware],
  functionMiddleware: [sentryGlobalFunctionMiddleware],
}));
