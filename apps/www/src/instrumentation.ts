import {
  captureConsoleIntegration,
  captureRequestError,
  extraErrorDataIntegration,
  init,
  spotlightIntegration,
} from "@sentry/nextjs";

import { env } from "~/env";

const sharedIntegrations = () => [
  captureConsoleIntegration({ levels: ["error", "warn"] }),
  extraErrorDataIntegration({ depth: 3 }),
];

const register = () => {
  // eslint-disable-next-line turbo/no-undeclared-env-vars, no-restricted-properties
  if (process.env.NEXT_RUNTIME === "nodejs") {
    init({
      dsn: env.NEXT_PUBLIC_SENTRY_DSN,
      environment: env.NEXT_PUBLIC_VERCEL_ENV,
      tracesSampleRate: 1,
      profilesSampleRate: 0,
      debug: false,
      _experiments: {
        enableLogs: true,
      },
      integrations: [
        ...sharedIntegrations(),
        ...(env.NEXT_PUBLIC_VERCEL_ENV === "development"
          ? [spotlightIntegration()]
          : []),
      ],
    });
  }

  // eslint-disable-next-line turbo/no-undeclared-env-vars, no-restricted-properties
  if (process.env.NEXT_RUNTIME === "edge") {
    init({
      dsn: env.NEXT_PUBLIC_SENTRY_DSN,
      environment: env.NEXT_PUBLIC_VERCEL_ENV,
      tracesSampleRate: 1,
      profilesSampleRate: 0,
      debug: false,
      _experiments: {
        enableLogs: true,
      },
      integrations: sharedIntegrations(),
    });
  }
};

register();

export const onRequestError = captureRequestError;
