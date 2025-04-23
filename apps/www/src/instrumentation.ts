import { captureRequestError, init } from "@sentry/nextjs";

import { env } from "~/env";

export const register = () => {
  // eslint-disable-next-line turbo/no-undeclared-env-vars, no-restricted-properties
  if (process.env.NEXT_RUNTIME === "nodejs") {
    init({
      dsn: env.NEXT_PUBLIC_SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: 1,
      debug: false,
    });
  }

  // eslint-disable-next-line turbo/no-undeclared-env-vars, no-restricted-properties
  if (process.env.NEXT_RUNTIME === "edge") {
    init({
      dsn: env.NEXT_PUBLIC_SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: 1,
      debug: false,
    });
  }
};

export const onRequestError = captureRequestError;
