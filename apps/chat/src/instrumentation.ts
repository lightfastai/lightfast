import * as Sentry from "@sentry/nextjs";

import { env } from "~/env";

const createInitOptions = () => ({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  tracesSampleRate: 1,
  debug: false,
  integrations: [Sentry.vercelAIIntegration()],
});

const register = () => {
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init(createInitOptions());
  }

  // eslint-disable-next-line turbo/no-undeclared-env-vars
  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(createInitOptions());
  }
};

register();

export const onRequestError = Sentry.captureRequestError;
