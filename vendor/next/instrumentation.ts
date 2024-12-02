import { NodeOptions } from "@sentry/nextjs";

import { env } from "./env";

export const sentryOpts = {
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.NODE_ENV,
  tracesSampleRate: 1,
  debug: false,
} satisfies NodeOptions;
