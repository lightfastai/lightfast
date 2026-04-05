import {
  captureConsoleIntegration,
  captureRequestError,
  extraErrorDataIntegration,
  init,
  spotlightIntegration,
} from "@sentry/nextjs";
import { TRPCError } from "@trpc/server";

import { env } from "~/env";

const EXPECTED_TRPC_CODES = new Set([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "BAD_REQUEST",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "PARSE_ERROR",
  "UNPROCESSABLE_CONTENT",
  "TOO_MANY_REQUESTS",
  "CLIENT_CLOSED_REQUEST",
]);

const sharedIntegrations = () => [
  captureConsoleIntegration({ levels: ["error", "warn"] }),
  extraErrorDataIntegration({ depth: 3 }),
];

const beforeSend: NonNullable<Parameters<typeof init>[0]["beforeSend"]> = (
  event,
  hint
) => {
  const err = hint?.originalException;
  if (err instanceof TRPCError && EXPECTED_TRPC_CODES.has(err.code)) {
    return null;
  }
  return event;
};

const register = () => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    init({
      dsn: env.NEXT_PUBLIC_SENTRY_DSN,
      environment: env.NEXT_PUBLIC_VERCEL_ENV,
      sendDefaultPii: true,
      tracesSampleRate: env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.2 : 1.0,
      debug: false,
      enableLogs: true,
      includeLocalVariables: true,
      beforeSend,
      integrations: [
        ...sharedIntegrations(),
        ...(env.NEXT_PUBLIC_VERCEL_ENV === "development"
          ? [spotlightIntegration()]
          : []),
      ],
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    init({
      dsn: env.NEXT_PUBLIC_SENTRY_DSN,
      environment: env.NEXT_PUBLIC_VERCEL_ENV,
      sendDefaultPii: true,
      tracesSampleRate: env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.2 : 1.0,
      debug: false,
      enableLogs: true,
      beforeSend,
      integrations: sharedIntegrations(),
    });
  }
};

register();

export const onRequestError = captureRequestError;
