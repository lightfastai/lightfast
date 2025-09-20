import {
  browserProfilingIntegration,
  browserTracingIntegration,
  captureRouterTransitionStart,
  init as initSentry,
  replayIntegration,
} from "@sentry/nextjs";
import { consoleLoggingIntegration } from "@sentry/core";

import { env } from "~/env";

initSentry({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,

  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,
  // Enable CPU profiling for sampled transactions
  profilesSampleRate: 1.0,
  // Forward console.* calls as log events
  enableLogs: true,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  /*
   * This sets the sample rate to be 10%. You may want this to be 100% while
   * in development and sample at a lower rate in production
   */
  replaysSessionSampleRate:
    env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === "production" ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
    browserTracingIntegration(),
    browserProfilingIntegration(),
    replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

export const onRouterTransitionStart = captureRouterTransitionStart;
