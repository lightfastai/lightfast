import { captureRequestError, init } from "@sentry/nextjs";

import { env } from "~/env";

const register = () => {
  // eslint-disable-next-line turbo/no-undeclared-env-vars, no-restricted-properties
  if (process.env.NEXT_RUNTIME === "nodejs") {
    init({
      dsn: env.NEXT_PUBLIC_SENTRY_DSN,
      environment:
        env.VERCEL_ENV === "production" ? env.VERCEL_ENV : "development",
      tracesSampleRate: 1,
      debug: false,
    });
  }

  // eslint-disable-next-line turbo/no-undeclared-env-vars, no-restricted-properties
  if (process.env.NEXT_RUNTIME === "edge") {
    init({
      dsn: env.NEXT_PUBLIC_SENTRY_DSN,
      environment:
        env.VERCEL_ENV === "production" ? env.VERCEL_ENV : "development",
      tracesSampleRate: 1,
      debug: false,
    });
  }
};

register();

export const onRequestError = captureRequestError;
