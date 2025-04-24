import * as Sentry from "@sentry/nextjs";

import { env } from "~/env";

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.VERCEL_ENV === "production" ? env.VERCEL_ENV : "development",

  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: env.VERCEL_ENV === "production" ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: env.VERCEL_ENV !== "production",

  // Capture Replay for 10% of all sessions,
  // plus for 100% of sessions with an error
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/session-replay/configuration/#general-integration-configuration
  replaysSessionSampleRate: env.VERCEL_ENV === "production" ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
