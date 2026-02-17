import {
  captureConsoleIntegration,
  captureRequestError,
  extraErrorDataIntegration,
  init as initSentry,
} from "@sentry/nextjs";
import { consoleLoggingIntegration } from "@sentry/core";

import { env } from "~/env";

const sharedIntegrations = () => [
  consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  captureConsoleIntegration({ levels: ["error", "warn"] }),
  extraErrorDataIntegration({ depth: 3 }),
];

const register = async () => {
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // spotlightIntegration and vercelAIIntegration are not available in the edge bundle,
    // so they must be dynamically imported to avoid build errors
    const { spotlightIntegration, vercelAIIntegration } =
      await import("@sentry/nextjs");

    initSentry({
      dsn: env.NEXT_PUBLIC_SENTRY_DSN,
      environment: env.NEXT_PUBLIC_VERCEL_ENV,
      tracesSampleRate: 1,
      debug: false,
      enableLogs: true,
      integrations: [
        ...sharedIntegrations(),
        vercelAIIntegration(),
        ...(env.NEXT_PUBLIC_VERCEL_ENV === "development"
          ? [spotlightIntegration()]
          : []),
      ],
    });
  }

  // eslint-disable-next-line turbo/no-undeclared-env-vars
  if (process.env.NEXT_RUNTIME === "edge") {
    initSentry({
      dsn: env.NEXT_PUBLIC_SENTRY_DSN,
      environment: env.NEXT_PUBLIC_VERCEL_ENV,
      tracesSampleRate: 1,
      debug: false,
      enableLogs: true,
      integrations: sharedIntegrations(),
    });
  }
};

register();

export const onRequestError = captureRequestError;
