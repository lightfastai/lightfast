import {
  captureConsoleIntegration,
  captureRequestError,
  extraErrorDataIntegration,
  init,
  spotlightIntegration,
} from "@sentry/nextjs";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import { NonRetriableError } from "@vendor/inngest";

import { env } from "~/env";

const sharedIntegrations = () => [
  captureConsoleIntegration({ levels: ["error", "warn"] }),
  extraErrorDataIntegration({ depth: 3 }),
];

const beforeSend: NonNullable<Parameters<typeof init>[0]["beforeSend"]> = (
  event,
  hint
) => {
  const err = hint?.originalException;
  if (err instanceof TRPCError && getHTTPStatusCodeFromError(err) < 500) {
    return null;
  }
  // Drop Inngest business rejections — NonRetriableError is an expected
  // outcome (e.g. no_connection, filtered event). The framework console.errors
  // thrown errors which captureConsoleIntegration intercepts; this filter
  // prevents those from creating Sentry issues.
  if (err instanceof NonRetriableError) {
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
